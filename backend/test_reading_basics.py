from __future__ import annotations

from copy import deepcopy
import unittest

from backend.reading_basics import (
    READING_BASICS_PATH,
    ReadingBasicsValidationError,
    VALID_ACTIVITY_TYPES,
    load_reading_basics,
    validate_reading_basics,
)


class ReadingBasicsContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        load_reading_basics.cache_clear()
        cls.catalog = load_reading_basics()

    def test_starter_skills_and_activity_types_are_reviewed_and_versioned(self):
        lessons = self.catalog["lessons"]
        self.assertEqual(len(lessons), 7)
        self.assertEqual(
            {lesson["skill"] for lesson in lessons},
            {
                "main-idea", "inference", "vocabulary-in-context", "text-evidence",
                "character-motives-and-decisions", "sequencing-and-summarizing",
                "author-purpose-and-point-of-view",
            },
        )
        activities = [activity for lesson in lessons for activity in lesson["activities"]]
        self.assertEqual({activity["type"] for activity in activities}, VALID_ACTIVITY_TYPES)
        self.assertTrue(all(activity["reviewStatus"] == "reviewed" and activity["version"] >= 1 for activity in activities))

    def test_original_sources_and_evidence_references_are_exact(self):
        for lesson in self.catalog["lessons"]:
            for activity in lesson["activities"]:
                source = activity["source"]
                self.assertEqual(source["sourceType"], "original-companion")
                self.assertEqual(source["rightsStatus"], "project-original")
                sentence_text = {sentence["id"]: sentence["text"] for sentence in source["passage"]}
                task = activity["task"]
                self.assertTrue(set(task["correctEvidenceSentenceIds"]).issubset({item["sentenceId"] for item in task["evidenceOptions"]}))
                for evidence in task["evidenceOptions"]:
                    self.assertEqual(evidence["text"], sentence_text[evidence["sentenceId"]])

    def test_validator_rejects_unreviewed_activity_and_missing_evidence(self):
        invalid = deepcopy(self.catalog)
        invalid["lessons"][0]["activities"][0]["reviewStatus"] = "draft"
        with self.assertRaisesRegex(ReadingBasicsValidationError, "must be reviewed"):
            validate_reading_basics(invalid)
        invalid = deepcopy(self.catalog)
        invalid["lessons"][0]["activities"][0]["task"]["correctEvidenceSentenceIds"] = ["s2"]
        with self.assertRaisesRegex(ReadingBasicsValidationError, "must offer every correct evidence"):
            validate_reading_basics(invalid)


if __name__ == "__main__":
    unittest.main()
