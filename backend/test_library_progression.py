"""Dependency-free contract coverage for the web library and Level Road."""

from __future__ import annotations

from collections import Counter
from copy import deepcopy
import unittest

from backend.book_catalog import load_book_catalog, load_quest_mappings
from backend.catalog import load_catalogs
from backend.progression import level_nodes
from backend.store import DemoStore, PlatformError


QUEST_FIXTURE = {
    "id": "reviewed-fixture",
    "questions": [
        {"id": "q1", "correctChoiceId": "a", "correctEvidenceSentenceId": "s1"},
        {"id": "q2", "correctChoiceId": "b", "correctEvidenceSentenceId": "s2"},
        {"id": "q3", "correctChoiceId": "c", "correctEvidenceSentenceId": "s3"},
    ],
}


class LibraryAndProgressionTests(unittest.TestCase):
    def setUp(self):
        self.catalogs = load_catalogs()
        self.books = load_book_catalog()
        self.store = DemoStore(self.catalogs, self.books)
        self.profile_id = self.store.create_profile("Library Reader")["id"]

    def test_catalog_has_metadata_only_100_plus_books_and_exact_mappings(self):
        self.assertGreaterEqual(len(self.books["books"]), 100)
        self.assertGreaterEqual(len({book["category"] for book in self.books["books"]}), 5)
        reference_books = [book for book in self.books["books"] if book["rights"]["status"] == "reference-only-unreviewed"]
        self.assertGreaterEqual(len(reference_books), 100)
        self.assertTrue(all(not book["rights"]["textReuseCleared"] for book in reference_books))
        self.assertTrue(all(book["chapterMetadata"] == [] for book in reference_books))
        mappings = {item["id"]: item for item in load_quest_mappings(catalog=self.books)["mappings"]}
        self.assertEqual(mappings["wizard-cyclone-inference"]["bookId"], "wizard-of-oz")
        self.assertEqual(mappings["wizard-cyclone-inference"]["chapterIds"], ["chapter-1-cyclone"])
        self.assertIn("exact 1900", mappings["wizard-cyclone-inference"]["mappingBasis"])

    def test_level_thresholds_progress_through_100_and_all_pets_are_locked(self):
        nodes = level_nodes({int(node["id"].removeprefix("level-")): node["rewardIds"] for node in self.catalogs["levelNodes"]})
        self.assertEqual(len(nodes), 100)
        self.assertEqual(nodes[0]["requiredXp"], 0)
        self.assertGreater(nodes[10]["xpFromPreviousLevel"], nodes[9]["xpFromPreviousLevel"])
        self.assertGreater(nodes[20]["xpFromPreviousLevel"], nodes[19]["xpFromPreviousLevel"])
        self.assertTrue(all(pet["availability"].startswith("level-road") for pet in self.catalogs["pets"]))
        self.assertEqual([pet["unlockLevel"] for pet in self.catalogs["pets"] if pet["starterClaim"]], [1, 2, 3, 4, 5, 6])
        with self.assertRaisesRegex(PlatformError, "must be owned"):
            self.store.set_active_pet(self.profile_id, "page-finch")
        starter = self.store.rewards_for_profile(self.profile_id)[0]
        self.store.claim_reward(self.profile_id, starter["id"])
        self.assertEqual(self.store.set_active_pet(self.profile_id, "moss-mouse")["activePetId"], "moss-mouse")

    def test_verified_xp_breakdown_requires_answers_reasoning_and_no_replay(self):
        responses = [
            {"questionId": "q1", "choiceId": "a", "evidenceSentenceId": "s1"},
            {"questionId": "q2", "choiceId": "b", "evidenceSentenceId": "wrong"},
            {"questionId": "q3", "choiceId": "wrong", "evidenceSentenceId": "s3"},
        ]
        award = self.store.award_quest_attempt(self.profile_id, QUEST_FIXTURE, "attempt-1", responses)
        self.assertEqual(award["awardedXp"], 50)
        self.assertEqual([item["awardedXp"] for item in award["breakdown"]], [30, 20, 0])
        with self.assertRaisesRegex(PlatformError, "already received"):
            self.store.award_quest_attempt(self.profile_id, QUEST_FIXTURE, "attempt-1", responses)
        none = self.store.award_quest_attempt(self.profile_id, QUEST_FIXTURE, "attempt-2", [])
        self.assertEqual(none["awardedXp"], 0)
        with self.assertRaisesRegex(PlatformError, "XP awards"):
            self.store.add_xp(self.profile_id, 10, "quest-complete")

    def test_wallet_claims_and_demo_shop_cannot_duplicate_credit(self):
        self.store.add_xp(self.profile_id, 100, "demo-seed")
        gold_instance = next(item for item in self.store.rewards_for_profile(self.profile_id) if item["rewardId"] == "level-gold-cache")
        self.store.claim_reward(self.profile_id, gold_instance["id"])
        self.assertEqual(self.store.balances(self.profile_id)["currencies"]["gold"], 50)
        with self.assertRaisesRegex(PlatformError, "already been claimed"):
            self.store.claim_reward(self.profile_id, gold_instance["id"])
        self.store.purchase(self.profile_id, "shop-demo-gold-cache")
        self.store.purchase(self.profile_id, "shop-demo-diamond-cache")
        balances = self.store.balances(self.profile_id)["currencies"]
        self.assertEqual(balances["gold"], 51)
        self.assertEqual(balances["diamonds"], 1)

    def test_book_access_source_attribution_purchase_only_and_library_persistence(self):
        self.assertFalse(self.store.book_access(self.profile_id, "wizard-of-oz", "chapter-2-council")["allowed"])
        free_chapter = self.store.chapter(self.profile_id, "wizard-of-oz", "chapter-1-cyclone")
        self.assertEqual(free_chapter["content"]["mode"], "quest-passage-reference")
        self.assertIn("L. Frank Baum", free_chapter["source"]["requiredAttribution"])
        source_only = self.store.reader_reference(self.profile_id, "gutenberg-11-alice-s-adventures-in-wonderland")
        self.assertEqual(source_only["content"]["mode"], "external-reference")
        self.store.set_demo_entitlement(self.profile_id, "premium", True)
        self.assertTrue(self.store.book_access(self.profile_id, "wizard-of-oz", "chapter-2-council")["allowed"])
        self.assertNotIn("lantern-and-lost-index", {item["bookId"] for item in self.store.library(self.profile_id)})
        self.store.profiles[self.profile_id]["currencies"]["gold"] = 120
        purchase = self.store.purchase_book(self.profile_id, "lantern-and-lost-index")
        self.assertTrue(purchase["mocked"])
        self.assertEqual(self.store.reader_reference(self.profile_id, "lantern-and-lost-index")["content"]["reason"], "chapter_content_unavailable")
        self.store.profiles[self.profile_id]["entitlement"]["endsAt"] = "2020-01-01T00:00:00Z"
        library = {item["bookId"]: item for item in self.store.library(self.profile_id)}
        self.assertEqual(library["lantern-and-lost-index"]["access"], "permanent")
        self.assertNotIn("wizard-of-oz", library)

    def test_recommendations_and_collection_contracts_expose_stable_ids(self):
        recommendations = self.store.recommendations(self.profile_id)
        self.assertTrue(recommendations)
        self.assertTrue(all(item["bookId"] in self.store.books for item in recommendations))
        self.store.change_wishlist(self.profile_id, "book", "wizard-of-oz", True)
        collections = self.store.collections(self.profile_id)
        self.assertEqual(collections["wishlist"], [{"itemType": "book", "catalogId": "wizard-of-oz"}])
        self.assertEqual(Counter(item["id"] for item in collections["badges"])["first-quest"], 1)


if __name__ == "__main__":
    unittest.main()
