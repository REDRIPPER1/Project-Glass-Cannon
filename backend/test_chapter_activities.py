from __future__ import annotations

from copy import deepcopy
import json
from pathlib import Path
import unittest

from backend.catalog import load_catalogs
from backend.chapter_activities import ChapterActivityError, load_chapter_activities, validate_activities
from backend.store import DemoStore, PlatformError


class ChapterActivityAndTransactionTests(unittest.TestCase):
    def setUp(self):
        self.catalog = load_chapter_activities()
        self.store = DemoStore(load_catalogs())
        self.profile_id = self.store.create_profile("Activity Reader", "premium")["id"]

    def test_ten_chapters_have_three_reviewed_source_mapped_activities(self):
        self.assertEqual(len(self.catalog["chapters"]), 10)
        for chapter in self.catalog["chapters"]:
            self.assertEqual(len(chapter["activities"]), 3)
            self.assertEqual(len({item["activityType"] for item in chapter["activities"]}), 3)
            self.assertTrue(all(item["reviewStatus"] == "reviewed" for item in chapter["activities"]))
            self.assertTrue(all(item["source"]["chapterId"] == chapter["chapterId"] for item in chapter["activities"]))

    def test_invalid_source_sentence_is_rejected(self):
        invalid = deepcopy(self.catalog)
        invalid["chapters"][0]["activities"][0]["sourceSentenceIds"] = ["missing"]
        # Generated activity fields are rebuilt from seeds, so corrupt the seed evidence instead.
        seed = json.loads(Path("backend/data/books/alice-activity-seeds.json").read_text(encoding="utf-8"))
        seed["chapters"][0]["mystery"]["evidence"] = ["missing"]
        with self.assertRaisesRegex(ChapterActivityError, "unknown cached sentence"):
            validate_activities(seed)

    def test_completion_reward_is_grounded_and_idempotent(self):
        activity = self.catalog["chapters"][0]["activities"][0]
        task = activity["task"]
        result = self.store.complete_chapter_activity(self.profile_id, activity["id"], {"attemptId": "activity-1", "choiceId": task["correctChoiceId"], "evidenceSentenceIds": task["correctEvidenceSentenceIds"]})
        self.assertEqual(result["completionStatus"], "completed")
        self.assertEqual(result["inventory"]["wishlistPages"], 1)
        retry = self.store.complete_chapter_activity(self.profile_id, activity["id"], {"attemptId": "activity-1", "choiceId": task["correctChoiceId"], "evidenceSentenceIds": task["correctEvidenceSentenceIds"]})
        self.assertTrue(retry["idempotent"])
        self.assertEqual(retry["inventory"]["wishlistPages"], 1)

    def test_purchase_is_trusted_idempotent_and_preserves_failed_balance(self):
        first = self.store.purchase(self.profile_id, "shop-oak-leaf-scarf", "purchase-a")
        retry = self.store.purchase(self.profile_id, "shop-oak-leaf-scarf", "purchase-a")
        self.assertEqual(first["transactionId"], retry["transactionId"])
        self.assertTrue(retry["idempotent"])
        with self.assertRaisesRegex(PlatformError, "already owned"):
            self.store.purchase(self.profile_id, "shop-oak-leaf-scarf", "purchase-b")
        before = deepcopy(self.store.balances(self.profile_id))
        with self.assertRaisesRegex(PlatformError, "not enough currency"):
            self.store.purchase(self.profile_id, "shop-book-secret-garden", "purchase-c")
        self.assertEqual(self.store.balances(self.profile_id), before)


if __name__ == "__main__":
    unittest.main()
