from __future__ import annotations

from copy import deepcopy
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch

from backend.catalog import CatalogError, load_catalogs, validate_catalogs
from backend.store import DemoStore, PlatformError, SQLiteStore

try:
    from fastapi.testclient import TestClient
    from backend import main
except ModuleNotFoundError:  # Lets core reliability tests run without installed web dependencies.
    TestClient = None
    main = None


class CatalogAndStoreTests(unittest.TestCase):
    def setUp(self):
        self.catalogs = load_catalogs()
        self.store = DemoStore(self.catalogs)
        self.profile = self.store.create_profile("Demo Reader")
        self.profile_id = self.profile["id"]

    def test_catalog_enforces_rights_starter_count_and_egg_odds(self):
        self.assertEqual(len([pet for pet in self.catalogs["pets"] if pet["availability"] == "starter"]), 6)
        self.assertTrue(all(pet["eventOnly"] for pet in self.catalogs["pets"] if pet["rarity"] == "Mythical"))
        invalid = deepcopy(self.catalogs)
        invalid["eggs"][0]["odds"]["Common"] = 0.6
        with self.assertRaisesRegex(CatalogError, "total 1"):
            validate_catalogs(invalid)
        invalid = deepcopy(self.catalogs)
        invalid["books"][0].pop("requiredAttribution")
        with self.assertRaisesRegex(CatalogError, "requiredAttribution"):
            validate_catalogs(invalid)

    def test_profile_mutations_validate_ownership_compatibility_and_wishlist(self):
        renamed = self.store.rename_pet(self.profile_id, "moss-mouse", "Mossy")
        self.assertEqual(renamed["name"], "Mossy")
        with self.assertRaisesRegex(PlatformError, "must be owned"):
            self.store.set_active_pet(self.profile_id, "comet-bat")
        self.store.purchase(self.profile_id, "shop-reading-lamp-cap")
        self.store.set_active_pet(self.profile_id, "quill-tortoise")
        with self.assertRaisesRegex(PlatformError, "cannot be equipped"):
            self.store.equip_accessory(self.profile_id, "reading-lamp-cap")
        self.store.change_wishlist(self.profile_id, "book", "wizard-of-oz", True)
        self.assertEqual(self.store.get_profile(self.profile_id)["wishlist"][0]["catalogId"], "wizard-of-oz")

    def test_mock_purchase_eggs_rewards_and_reversal_are_bounded(self):
        self.store.profiles[self.profile_id]["currencies"]["leafTokens"] = 0
        with self.assertRaisesRegex(PlatformError, "not enough currency"):
            self.store.purchase(self.profile_id, "shop-reading-lamp-cap")
        economic_profile_id = self.store.create_profile("Economy Reader")["id"]
        purchase = self.store.purchase(economic_profile_id, "shop-storybook-egg")
        opened = self.store.open_egg(economic_profile_id, "storybook-egg")
        self.assertTrue(opened["deterministicDemo"])
        with self.assertRaisesRegex(PlatformError, "cannot be reversed"):
            self.store.reverse_purchase(economic_profile_id, purchase["id"])
        accessory_purchase = self.store.purchase(economic_profile_id, "shop-oak-leaf-scarf")
        reversed_purchase = self.store.reverse_purchase(economic_profile_id, accessory_purchase["id"])
        self.assertTrue(reversed_purchase["reversed"])

    def test_progress_rewards_and_battle_pass_prevent_duplicate_claims(self):
        progress = self.store.add_xp(self.profile_id, 100, "quest-complete")
        self.assertEqual(progress["level"], 2)
        reward = self.store.rewards_for_profile(self.profile_id)[0]
        self.store.claim_reward(self.profile_id, reward["id"])
        with self.assertRaisesRegex(PlatformError, "already been claimed"):
            self.store.claim_reward(self.profile_id, reward["id"])
        with patch("backend.store.is_expired", side_effect=lambda timestamp: timestamp.startswith("2026-10")):
            self.store.add_battle_pass_progress(self.profile_id, "2026-11-basic", 100, "quest-complete")
            pass_reward = self.store.claim_battle_pass_reward(self.profile_id, "2026-11-basic", "basic-rare-moon-pin")
            self.assertEqual(pass_reward["reward"]["rarity"], "Rare")
            with self.assertRaisesRegex(PlatformError, "already been claimed"):
                self.store.claim_battle_pass_reward(self.profile_id, "2026-11-basic", "basic-rare-moon-pin")
            with self.assertRaisesRegex(PlatformError, "expired"):
                self.store.add_battle_pass_progress(self.profile_id, "2026-10-basic", 10, "quest-complete")

    def test_access_entitlements_ads_and_safe_analytics(self):
        self.assertTrue(self.store.book_access(self.profile_id, "wizard-of-oz", "chapter-1-cyclone")["allowed"])
        self.assertFalse(self.store.book_access(self.profile_id, "wizard-of-oz", "chapter-2-council")["allowed"])
        self.assertFalse(self.store.book_access(self.profile_id, "secret-garden", None, "vocabulary")["allowed"])
        self.store.set_demo_entitlement(self.profile_id, "premium", True)
        self.assertTrue(self.store.book_access(self.profile_id, "secret-garden", None, "vocabulary")["allowed"])
        self.assertFalse(self.store.ad_placement(self.profile_id, "after-quest")["eligible"])
        event = self.store.record_event(self.profile_id, "evidence_chosen", {"questId": "wizard-cyclone-inference"})
        self.assertEqual(event["eventType"], "evidence_chosen")
        with self.assertRaisesRegex(PlatformError, "non-identifying"):
            self.store.record_event(self.profile_id, "evidence_chosen", {"email": "child@example.com"})

    def test_sqlite_migration_persists_anonymous_profile_state(self):
        with TemporaryDirectory() as directory:
            path = Path(directory) / "demo.sqlite3"
            store = SQLiteStore(self.catalogs, path)
            profile = store.create_profile("Persisted Reader")
            store.purchase(profile["id"], "shop-oak-leaf-scarf")
            store.close()
            reopened = SQLiteStore(self.catalogs, path)
            self.assertEqual(reopened.get_profile(profile["id"])["displayName"], "Persisted Reader")
            self.assertIn("oak-leaf-scarf", reopened.get_profile(profile["id"])["ownedAccessoryIds"])
            reopened.close()


@unittest.skipIf(main is None or TestClient is None, "FastAPI is not installed in this environment")
class PlatformApiTests(unittest.TestCase):
    def setUp(self):
        self.store = DemoStore(load_catalogs())
        self.patch = patch.object(main, "platform_store", self.store)
        self.patch.start()
        self.client = TestClient(main.app)
        self.profile = self.client.post("/api/profiles", json={"displayName": "API Reader"}).json()
        self.profile_id = self.profile["id"]

    def tearDown(self):
        self.patch.stop()

    def test_profile_catalog_and_pet_endpoints(self):
        self.assertEqual(self.client.get("/api/catalog/pets").status_code, 200)
        self.assertEqual(self.client.get("/api/catalog/pets/moss-mouse").json()["rightsStatus"], "original")
        self.assertEqual(self.client.patch(f"/api/profiles/{self.profile_id}", json={"preferences": {"theme": "sky"}}).status_code, 200)
        self.assertEqual(self.client.patch(f"/api/profiles/{self.profile_id}/pets/moss-mouse/name", json={"name": "Maple"}).status_code, 200)
        self.assertEqual(self.client.put(f"/api/profiles/{self.profile_id}/wishlist/book/wizard-of-oz").status_code, 200)
        self.assertEqual(self.client.delete(f"/api/profiles/{self.profile_id}/wishlist/book/wizard-of-oz").status_code, 200)

    def test_economy_progress_books_pass_ads_and_analytics_endpoints(self):
        purchase = self.client.post(f"/api/profiles/{self.profile_id}/purchases", json={"shopItemId": "shop-oak-leaf-scarf"})
        self.assertEqual(purchase.status_code, 200)
        self.assertEqual(self.client.put(f"/api/profiles/{self.profile_id}/accessories/oak-leaf-scarf").status_code, 200)
        self.assertEqual(self.client.delete(f"/api/profiles/{self.profile_id}/accessories/neck").status_code, 200)
        egg = self.client.post(f"/api/profiles/{self.profile_id}/purchases", json={"shopItemId": "shop-storybook-egg"})
        self.assertEqual(egg.status_code, 200)
        self.assertEqual(self.client.post(f"/api/profiles/{self.profile_id}/eggs/storybook-egg/open", json={"deterministicDemo": True}).status_code, 200)
        self.assertEqual(self.client.post(f"/api/profiles/{self.profile_id}/xp", json={"amount": 100, "source": "quest-complete"}).status_code, 200)
        reward = self.client.get(f"/api/profiles/{self.profile_id}/rewards").json()[0]
        self.assertEqual(self.client.post(f"/api/profiles/{self.profile_id}/rewards/{reward['id']}/claim").status_code, 200)
        self.assertFalse(self.client.get(f"/api/profiles/{self.profile_id}/books/wizard-of-oz/chapters/chapter-2-council/access").json()["allowed"])
        self.assertEqual(self.client.post(f"/api/profiles/{self.profile_id}/subscription/demo", json={"plan": "premium", "demoEntitlement": True}).status_code, 200)
        self.assertFalse(self.client.get(f"/api/profiles/{self.profile_id}/ads/after-quest").json()["eligible"])
        self.assertEqual(self.client.post(f"/api/profiles/{self.profile_id}/analytics", json={"eventType": "return_used", "properties": {"screen": "home"}}).status_code, 201)

    def test_error_shapes_cover_invalid_ids_currency_and_duplicate_claims(self):
        self.assertEqual(self.client.get("/api/profiles/missing").json()["detail"]["code"], "profile_not_found")
        self.assertEqual(self.client.post(f"/api/profiles/{self.profile_id}/purchases", json={"shopItemId": "missing"}).json()["detail"]["code"], "invalid_catalog_id")
        self.assertEqual(self.client.post(f"/api/profiles/{self.profile_id}/xp", json={"amount": -1, "source": "quest-complete"}).json()["detail"]["code"], "invalid_xp_award")
        self.assertEqual(self.client.post(f"/api/profiles/{self.profile_id}/analytics", json={"eventType": "return_used", "properties": {"name": "nope"}}).json()["detail"]["code"], "unsafe_analytics_properties")


if __name__ == "__main__":
    unittest.main()
