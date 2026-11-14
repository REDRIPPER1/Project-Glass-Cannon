from __future__ import annotations

from copy import deepcopy
import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

from backend import main


class QuestApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        main.load_quests.cache_clear()
        cls.quests = main.load_quests()
        cls.quest = cls.quests["wizard-cyclone-inference"]
        cls.client = TestClient(main.app)

    @classmethod
    def tearDownClass(cls):
        main.load_quests.cache_clear()

    def test_health_check(self):
        response = self.client.get("/api/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "ok")

    def test_list_endpoint_returns_compact_cards_for_all_three_quests(self):
        response = self.client.get("/api/quests")
        self.assertEqual(response.status_code, 200)
        cards = response.json()
        self.assertEqual(
            {card["id"] for card in cards},
            {"wizard-cyclone-inference", "night-garden-main-idea", "fix-it-fair-vocabulary"},
        )
        self.assertTrue(all("passage" not in card for card in cards))
        self.assertTrue(all("requiredAttribution" in card["source"] for card in cards))

    def test_detail_endpoint_returns_the_bundled_contract(self):
        response = self.client.get("/api/quests/wizard-cyclone-inference")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), self.quest)

    def test_unknown_quest_returns_a_structured_404(self):
        response = self.client.get("/api/quests/not-a-real-quest")
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()["detail"]["code"], "quest_not_found")

    def _valid_quest(self):
        return deepcopy(self.quest)

    def _assert_invalid(self, quest, expected_message, extra_quests=()):
        with TemporaryDirectory() as directory:
            quest_directory = Path(directory)
            (quest_directory / "quest-a.json").write_text(
                json.dumps(quest), encoding="utf-8"
            )
            for index, extra_quest in enumerate(extra_quests, start=1):
                (quest_directory / f"quest-extra-{index}.json").write_text(
                    json.dumps(extra_quest), encoding="utf-8"
                )
            with self.assertRaisesRegex(main.QuestValidationError, expected_message):
                main.load_quests_from(quest_directory)

    def test_malformed_quest_is_rejected(self):
        self._assert_invalid([], "Quest must be an object")

    def test_duplicate_quest_ids_are_rejected(self):
        duplicate = self._valid_quest()
        self._assert_invalid(self._valid_quest(), "Duplicate quest ID", [duplicate])

    def test_missing_rights_metadata_is_rejected(self):
        quest = self._valid_quest()
        del quest["source"]["rightsStatus"]
        self._assert_invalid(quest, "source is missing required fields")

    def test_invalid_answer_key_is_rejected(self):
        quest = self._valid_quest()
        quest["questions"][0]["correctChoiceId"] = "not-a-choice"
        self._assert_invalid(quest, "invalid correct choice")

    def test_invalid_evidence_id_is_rejected(self):
        quest = self._valid_quest()
        quest["questions"][0]["evidenceOptions"][0]["sentenceId"] = "s999"
        self._assert_invalid(quest, "references unknown evidence ID")

    def test_mismatched_evidence_text_is_rejected(self):
        quest = self._valid_quest()
        quest["questions"][0]["evidenceOptions"][0]["text"] = "Incorrect evidence text."
        self._assert_invalid(quest, "evidence text does not match")

    def test_unavailable_content_returns_a_structured_503(self):
        with TemporaryDirectory() as directory, patch.object(main, "QUEST_DIRECTORY", Path(directory)):
            main.load_quests.cache_clear()
            response = self.client.get("/api/quests")
        main.load_quests.cache_clear()
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json()["detail"]["code"], "quest_content_unavailable")


if __name__ == "__main__":
    unittest.main()
