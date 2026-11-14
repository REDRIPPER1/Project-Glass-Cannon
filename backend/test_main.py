import unittest

from fastapi import HTTPException

from backend.main import get_quest, health_check, list_quests, load_quests


class QuestContentTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        load_quests.cache_clear()
        cls.quest = get_quest("wizard-cyclone-inference")

    def test_health_check(self):
        self.assertEqual(health_check()["status"], "ok")

    def test_seed_quest_has_three_inference_questions(self):
        self.assertEqual(self.quest["questions"][0]["targetSkill"], "making-inferences-from-details")
        self.assertEqual(len(self.quest["questions"]), 3)
        self.assertEqual(self.quest["passageWordCount"], 241)
        self.assertEqual(self.quest["source"]["sourceType"], "public-domain-book-excerpt")
        self.assertEqual(self.quest["source"]["rightsStatus"], "verified")
        self.assertEqual(self.quest["source"]["territory"], "US")

    def test_every_correct_evidence_reference_exists_and_is_offered(self):
        sentence_text_by_id = {
            sentence["id"]: sentence["text"] for sentence in self.quest["passage"]
        }
        sentence_ids = set(sentence_text_by_id)
        for question in self.quest["questions"]:
            choice_ids = {choice["id"] for choice in question["choices"]}
            evidence_ids = {
                evidence["sentenceId"] for evidence in question["evidenceOptions"]
            }
            self.assertIn(question["correctChoiceId"], choice_ids)
            self.assertIn(question["correctEvidenceSentenceId"], sentence_ids)
            self.assertIn(question["correctEvidenceSentenceId"], evidence_ids)
            for evidence in question["evidenceOptions"]:
                self.assertEqual(
                    evidence["text"], sentence_text_by_id[evidence["sentenceId"]]
                )

    def test_list_endpoint_returns_a_compact_card(self):
        cards = list_quests()
        self.assertEqual(cards[0]["id"], self.quest["id"])
        self.assertNotIn("passage", cards[0])

    def test_unknown_quest_returns_a_404(self):
        with self.assertRaises(HTTPException) as error:
            get_quest("not-a-real-quest")
        self.assertEqual(error.exception.status_code, 404)


if __name__ == "__main__":
    unittest.main()
