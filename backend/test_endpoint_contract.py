"""Dependency-free endpoint-function coverage for the optional local-demo API.

FastAPI's TestClient coverage lives in test_platform.py and runs whenever the
requirements are installed. This suite keeps the local contract executable in
minimal authoring environments too.
"""

from __future__ import annotations

import importlib
import sys
from types import ModuleType
import unittest
from unittest.mock import patch

from backend.catalog import load_catalogs
from backend.store import DemoStore


def _load_main_with_fastapi_stub():
    if "backend.main" in sys.modules:
        return sys.modules["backend.main"]
    fastapi = ModuleType("fastapi")

    class HTTPException(Exception):
        def __init__(self, status_code, detail):
            self.status_code = status_code
            self.detail = detail
            super().__init__(str(detail))

    class FastAPI:
        def __init__(self, *args, **kwargs):
            pass

        def add_middleware(self, *args, **kwargs):
            pass

        @staticmethod
        def _route(*args, **kwargs):
            return lambda function: function

        get = _route
        post = _route
        put = _route
        patch = _route
        delete = _route

    cors = ModuleType("fastapi.middleware.cors")
    cors.CORSMiddleware = object
    sys.modules["fastapi"] = fastapi
    sys.modules["fastapi.middleware"] = ModuleType("fastapi.middleware")
    sys.modules["fastapi.middleware.cors"] = cors
    fastapi.FastAPI = FastAPI
    fastapi.HTTPException = HTTPException
    return importlib.import_module("backend.main")


class EndpointContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.main = _load_main_with_fastapi_stub()

    def setUp(self):
        self.store = DemoStore(load_catalogs())
        self.store_patch = patch.object(self.main, "platform_store", self.store)
        self.store_patch.start()
        self.profile = self.main.create_profile({"displayName": "Contract Reader"})
        self.profile_id = self.profile["id"]

    def tearDown(self):
        self.store_patch.stop()

    def _error_code(self, action):
        with self.assertRaises(self.main.HTTPException) as error:
            action()
        return error.exception.detail["code"]

    def test_profile_pet_accessory_wishlist_and_catalog_contracts(self):
        self.assertEqual(self.main.get_profile(self.profile_id)["id"], self.profile_id)
        balances = self.main.get_currency_balances(self.profile_id)
        self.assertEqual(balances["wallet"], {"gold": 150, "diamonds": 0})
        self.assertEqual(balances["inventory"]["wishlistPages"], 0)
        self.assertEqual(self.main.update_profile(self.profile_id, {"preferences": {"theme": "sky"}})["preferences"]["theme"], "sky")
        starter = self.main.list_rewards(self.profile_id)[0]
        self.main.claim_reward(self.profile_id, starter["id"])
        self.assertEqual(self.main.rename_pet(self.profile_id, "moss-mouse", {"name": "Mossy"})["name"], "Mossy")
        self.assertEqual(self.main.select_active_pet(self.profile_id, "moss-mouse")["activePetId"], "moss-mouse")
        self.assertEqual(self.main.add_book_wishlist_item(self.profile_id, "wizard-of-oz")["bookWishlistIds"], ["wizard-of-oz"])
        self.assertEqual(self.main.get_book_wishlist(self.profile_id)["bookWishlistIds"], ["wizard-of-oz"])
        self.assertEqual(self.main.remove_book_wishlist_item(self.profile_id, "wizard-of-oz")["bookWishlistIds"], [])
        self.assertEqual(len(self.main.list_pets()), 9)
        self.assertEqual(self.main.get_pet("moss-mouse")["rightsStatus"], "original")
        self.assertEqual(len(self.main.list_accessories()), 4)
        self.assertEqual(len(self.main.list_eggs()), 6)
        self.assertEqual(self.main.list_events()[0]["petId"], "seasonal-phoenix")
        self.assertEqual(self._error_code(lambda: self.main.get_pet("missing")), "invalid_catalog_id")

    def test_progress_rewards_shop_and_egg_contracts(self):
        self.assertEqual(self.main.award_xp(self.profile_id, {"amount": 100, "source": "demo-seed"})["level"], 2)
        self.assertEqual(self.main.get_progress(self.profile_id)["xp"], 100)
        self.assertTrue(self.main.list_badges())
        self.assertTrue(self.main.list_achievements())
        self.assertTrue(self.main.list_trophies())
        reward = self.main.list_rewards(self.profile_id)[0]
        self.assertEqual(self.main.claim_reward(self.profile_id, reward["id"])["claimStatus"], "claimed")
        self.main.select_active_pet(self.profile_id, "moss-mouse")
        self.assertEqual(self._error_code(lambda: self.main.claim_reward(self.profile_id, reward["id"])), "duplicate_claim")
        self.assertTrue(self.main.list_shop_items())
        self.assertIn("shop-book-secret-garden", {item["id"] for item in self.main.list_shop_items()})
        scarf = self.main.purchase_item(self.profile_id, {"shopItemId": "shop-oak-leaf-scarf"})
        self.assertTrue(scarf["mocked"])
        self.assertIn("neck", self.main.equip_accessory(self.profile_id, "oak-leaf-scarf")["equippedAccessories"])
        self.main.unequip_accessory(self.profile_id, "neck")
        self.assertTrue(self.main.reverse_purchase(self.profile_id, scarf["id"])["reversed"])
        self.main.award_xp(self.profile_id, {"amount": 500, "source": "demo-seed"})
        self.main.award_xp(self.profile_id, {"amount": 100, "source": "demo-seed"})
        common_egg = next(item for item in self.main.list_rewards(self.profile_id) if item["rewardId"] == "level-common-egg")
        self.main.claim_reward(self.profile_id, common_egg["id"])
        self.assertTrue(self.main.open_egg(self.profile_id, "common-reward-egg", {"deterministicDemo": True})["deterministicDemo"])
        self.assertEqual(self._error_code(lambda: self.main.purchase_item(self.profile_id, {"shopItemId": "missing"})), "invalid_catalog_id")

    def test_books_entitlements_passes_ads_and_analytics_contracts(self):
        self.assertTrue(self.main.list_books())
        wizard = self.main.get_book("wizard-of-oz")
        self.assertEqual(wizard["rightsStatus"], "verified")
        self.assertNotIn("sourceUrl", wizard)
        self.assertEqual(wizard["access"], {"state": "premium", "priceDiamonds": 12})
        self.assertEqual(wizard["chapterMetadata"][0]["readingLevels"][0]["access"], "free")
        self.assertEqual(wizard["source"]["ebookId"], "55")
        free_access = self.main.check_chapter_access(self.profile_id, "wizard-of-oz", "chapter-1-cyclone")
        self.assertTrue(free_access["allowed"])
        self.assertEqual(free_access["state"], "free")
        self.assertFalse(self.main.check_chapter_access(self.profile_id, "wizard-of-oz", "chapter-2-council")["allowed"])
        self.assertTrue(self.main.check_vocabulary_access(self.profile_id, "wizard-of-oz")["allowed"])
        self.assertFalse(self.main.check_vocabulary_tier_access(self.profile_id, "secret-garden", "basic")["allowed"])
        self.assertTrue(self.main.check_quiz_access(self.profile_id, "wizard-of-oz", "basic")["allowed"])
        quiz = self.main.get_book_quiz(self.profile_id, "wizard-of-oz", "wizard-cyclone-inference")
        self.assertEqual(quiz["chapterIds"], ["chapter-1-cyclone"])
        self.assertEqual(quiz["sourceLabel"], "Project Gutenberg eBook #55 · Chapter I: The Cyclone")
        self.assertEqual(quiz["activityType"], "story-quest")
        self.assertEqual(len(quiz["questions"]), 3)
        self.assertEqual(self.main.list_book_activities()[0]["id"], quiz["id"])
        self.assertEqual(self.main.list_book_activities_for_book("wizard-of-oz")[0]["reviewStatus"], "reviewed")
        self.assertEqual(self.main.get_subscription(self.profile_id)["plan"], "free")
        self.assertEqual(self.main.set_demo_entitlement(self.profile_id, {"plan": "premium", "demoEntitlement": True})["plan"], "premium")
        self.assertFalse(self.main.check_vocabulary_tier_access(self.profile_id, "secret-garden", "advanced")["allowed"])
        self.assertTrue(self.main.check_quiz_access(self.profile_id, "wizard-of-oz", "advanced")["allowed"])
        self.assertFalse(self.main.get_ad_placement(self.profile_id, "after-quest")["eligible"])
        with patch("backend.store.is_expired", return_value=False):
            passes = self.main.list_battle_passes(self.profile_id)
            self.assertTrue(passes)
            self.main.add_battle_pass_progress(self.profile_id, "2026-11-basic", {"amount": 100, "source": "quest-complete"})
            claimed = self.main.claim_battle_pass_reward(self.profile_id, "2026-11-basic", "basic-rare-moon-pin")
            self.assertEqual(claimed["reward"]["rarity"], "Rare")
            self.assertEqual(self.main.get_battle_pass(self.profile_id, "2026-11-basic")["plan"], "basic")
        event = self.main.record_analytics(self.profile_id, {"eventType": "return_used", "properties": {"screen": "home"}})
        self.assertEqual(event["eventType"], "return_used")
        self.assertEqual(self._error_code(lambda: self.main.record_analytics(self.profile_id, {"eventType": "return_used", "properties": {"name": "not allowed"}})), "unsafe_analytics_properties")

    def test_web_library_quest_xp_and_collection_contracts(self):
        books = self.main.list_web_books()
        self.assertGreaterEqual(len(books), 100)
        self.assertTrue(all("accessRules" in book and "rights" in book for book in books))
        mapping = self.main.get_quest_book_reference("wizard-cyclone-inference")
        self.assertEqual(mapping["bookId"], "wizard-of-oz")
        chapter = self.main.get_chapter(self.profile_id, "wizard-of-oz", "chapter-1-cyclone")
        self.assertEqual(chapter["content"]["mode"], "bundled-passage")
        self.assertIn("L. Frank Baum", chapter["attribution"]["requiredAttribution"])
        alice = self.main.get_chapter(self.profile_id, "gutenberg-11-alice-s-adventures-in-wonderland", "chapter-1")
        self.assertEqual(alice["content"]["mode"], "cached-chapter")
        self.assertGreaterEqual(len(alice["content"]["sentences"]), 10)
        self.assertNotIn("url", str(alice["content"]).lower())
        self.assertEqual(self.main.get_book_reader_reference(self.profile_id, "gutenberg-13-the-hunting-of-the-snark-an-agony-in-eight-fits")["content"]["mode"], "unavailable")
        self.assertFalse(self.main.check_chapter_access(self.profile_id, "wizard-of-oz", "chapter-2-council")["allowed"])
        self.main.set_demo_entitlement(self.profile_id, {"plan": "premium", "demoEntitlement": True})
        self.assertTrue(self.main.check_chapter_access(self.profile_id, "wizard-of-oz", "chapter-2-council")["allowed"])
        self.assertNotIn("secret-garden", {item["bookId"] for item in self.main.get_library(self.profile_id)})
        self.store.profiles[self.profile_id]["wallet"]["diamonds"] = 24
        purchase = self.main.purchase_book(self.profile_id, "secret-garden")
        self.assertTrue(purchase["mocked"])
        self.assertEqual(purchase["ownership"], "permanent")
        self.assertIn("secret-garden", purchase["ownedBookIds"])
        self.store.profiles[self.profile_id]["entitlement"]["endsAt"] = "2020-01-01T00:00:00Z"
        library = {item["bookId"]: item for item in self.main.get_library(self.profile_id)}
        self.assertEqual(library["secret-garden"]["access"], "permanent")
        self.assertTrue(self.main.get_recommendations(self.profile_id)[0]["bookId"])
        quest = self.main.get_quest("wizard-cyclone-inference")
        responses = [
            {"questionId": question["id"], "choiceId": question["correctChoiceId"], "evidenceSentenceId": question["correctEvidenceSentenceId"]}
            for question in quest["questions"]
        ]
        award = self.main.award_quest_attempt(self.profile_id, quest["id"], {"attemptId": "contract-attempt", "responses": responses})
        self.assertEqual(award["awardedXp"], 90)
        self.assertEqual(self._error_code(lambda: self.main.award_quest_attempt(self.profile_id, quest["id"], {"attemptId": "contract-attempt", "responses": responses})), "duplicate_xp_attempt")
        self.assertEqual(len(self.main.get_progression_catalog()["levels"]), 100)
        self.assertIn("badges", self.main.get_collections(self.profile_id))

    def test_wishlist_page_redemption_contract_is_atomic(self):
        self.main.add_book_wishlist_item(self.profile_id, "wizard-of-oz")
        with self.assertRaises(self.main.HTTPException) as error:
            self.main.redeem_wishlist_pages(self.profile_id)
        self.assertEqual(error.exception.detail["code"], "insufficient_wishlist_pages")
        self.store.profiles[self.profile_id]["inventory"]["wishlistPages"] = 5
        redemption = self.main.redeem_wishlist_pages(self.profile_id)
        self.assertEqual(redemption["selectedBookId"], "wizard-of-oz")
        self.assertEqual(redemption["ownership"], "permanent")
        self.assertEqual(redemption["inventory"]["wishlistPages"], 0)


if __name__ == "__main__":
    unittest.main()
