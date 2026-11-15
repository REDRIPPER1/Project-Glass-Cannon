"""Generate and validate reviewed chapter activities from approved cache references."""

from __future__ import annotations

from copy import deepcopy
from functools import lru_cache
import json
from pathlib import Path
from typing import Any

from .book_catalog import cached_passage_for_chapter, load_book_catalog


ACTIVITY_SEEDS_PATH = Path(__file__).resolve().parent / "data" / "books" / "alice-activity-seeds.json"
ACTIVITY_TYPES = ("mystery-investigation", "character-choice", "story-reconstruction", "vocabulary-crafting", "alternate-ending")
REWARD_KINDS = frozenset({"evidence", "understanding", "creativity", "persistence"})


class ChapterActivityError(ValueError):
    pass


def _text(value: object, context: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ChapterActivityError(f"{context} must be a non-empty string")
    return value


def _build_choice(seed: dict[str, Any], chapter_id: str, suffix: str, activity_type: str, reward_kind: str) -> dict[str, Any]:
    evidence_ids = seed["evidence"]
    choices = [{"id": item[0], "text": item[1]} for item in seed["choices"]]
    return {
        "id": f"alice-{chapter_id}-{suffix}-v1", "version": 1, "activityType": activity_type,
        "reviewStatus": "reviewed", "sourceSentenceIds": evidence_ids,
        "task": {"mode": "choice", "question": seed["question"], "choices": choices,
                 "correctChoiceId": seed["correct"], "evidenceOptions": evidence_ids,
                 "correctEvidenceSentenceIds": evidence_ids},
        "completionRule": {"kind": "correct-choice-and-evidence", "successState": "completed"},
        "feedback": {"correct": "That answer is supported by the highlighted chapter details.", "evidenceSentenceIds": evidence_ids},
        "reward": {"rewardId": "quest-wishlist-page", "kind": reward_kind, "quantity": 1},
    }


def _build_creative(chapter_id: str, evidence_ids: list[str], chapter_number: int) -> dict[str, Any]:
    return {
        "id": f"alice-{chapter_id}-alternate-ending-v1", "version": 1, "activityType": "alternate-ending",
        "reviewStatus": "reviewed", "sourceSentenceIds": evidence_ids,
        "task": {"mode": "creative", "responsePrompt": "Write a short alternate next step that still fits the chapter clues.",
                 "minCharacters": 12, "evidenceOptions": evidence_ids, "correctEvidenceSentenceIds": evidence_ids},
        "completionRule": {"kind": "short-source-grounded-response", "successState": "completed"},
        "feedback": {"correct": "Your alternate step can work when it stays connected to the selected chapter clues.", "evidenceSentenceIds": evidence_ids},
        "reward": {"rewardId": "quest-wishlist-page", "kind": "creativity", "quantity": 1},
    }


def _build_activities(chapter: dict[str, Any], number: int) -> list[dict[str, Any]]:
    chapter_id = chapter["chapterId"]
    third_type = ("story-reconstruction", "vocabulary-crafting", "alternate-ending")[(number - 1) % 3]
    first = _build_choice(chapter["mystery"], chapter_id, "mystery", "mystery-investigation", "evidence")
    second = _build_choice(chapter["choice"], chapter_id, "choice", "character-choice", "understanding")
    if third_type == "alternate-ending":
        third = _build_creative(chapter_id, chapter["mystery"]["evidence"], number)
    else:
        third = _build_choice(chapter["mystery"], chapter_id, third_type.removesuffix("-crafting").removesuffix("-reconstruction"), third_type, "persistence")
        third["id"] = f"alice-{chapter_id}-{third_type}-v1"
        third["task"]["question"] = "Which exact chapter detail should be kept when you " + ("rebuild the scene?" if third_type == "story-reconstruction" else "craft a context-clue definition?")
    return [first, second, third]


def validate_activities(value: object) -> dict[str, Any]:
    if not isinstance(value, dict) or value.get("schemaVersion") != 1:
        raise ChapterActivityError("Chapter activity catalog schemaVersion must be 1")
    book_id = _text(value.get("bookId"), "bookId")
    edition = _text(value.get("edition"), "edition")
    chapters = value.get("chapters")
    if not isinstance(chapters, list) or len(chapters) != 10:
        raise ChapterActivityError("Chapter activity catalog must contain exactly ten chapters")
    catalog = load_book_catalog()
    book = next((item for item in catalog["books"] if item["id"] == book_id), None)
    if book is None or book["edition"] != edition:
        raise ChapterActivityError("Chapter activity catalog must use an exact approved book edition")
    seen: set[str] = set()
    result_chapters = []
    for number, chapter in enumerate(chapters, start=1):
        if not isinstance(chapter, dict): raise ChapterActivityError("Chapter activity row must be an object")
        chapter_id = _text(chapter.get("chapterId"), "chapterId")
        source_label = _text(chapter.get("sourceLabel"), "sourceLabel")
        passage = cached_passage_for_chapter(book_id, chapter_id, catalog)
        if not passage: raise ChapterActivityError(f"Activity chapter {chapter_id} is not in the approved local cache")
        sentence_ids = {item["id"] for item in passage}
        activities = _build_activities(chapter, number)
        if len(activities) != 3 or len({item["activityType"] for item in activities}) != 3:
            raise ChapterActivityError(f"Chapter {chapter_id} must have three distinct activity types")
        for activity in activities:
            activity["bookId"] = book_id
            activity["edition"] = edition
            activity["chapterId"] = chapter_id
            activity["sourceLabel"] = source_label
            activity["source"] = {"bookId": book_id, "edition": edition, "chapterId": chapter_id, "sentenceIds": activity["sourceSentenceIds"]}
            if activity["id"] in seen: raise ChapterActivityError(f"Duplicate activity ID {activity['id']}")
            seen.add(activity["id"])
            evidence = activity["task"]["correctEvidenceSentenceIds"]
            if not set(activity["sourceSentenceIds"]).issubset(sentence_ids) or not set(evidence).issubset(sentence_ids):
                raise ChapterActivityError(f"Activity {activity['id']} references an unknown cached sentence")
            if activity["reward"]["rewardId"] != "quest-wishlist-page" or activity["reward"]["kind"] not in REWARD_KINDS:
                raise ChapterActivityError(f"Activity {activity['id']} has an invalid reward")
        result_chapters.append({"chapterId": chapter_id, "sourceLabel": source_label, "reviewStatus": "reviewed", "activities": activities})
    return {"schemaVersion": 1, "bookId": book_id, "edition": edition, "chapters": result_chapters}


@lru_cache
def load_chapter_activities(path: Path = ACTIVITY_SEEDS_PATH) -> dict[str, Any]:
    try:
        with path.open(encoding="utf-8") as handle:
            return deepcopy(validate_activities(json.load(handle)))
    except (OSError, json.JSONDecodeError) as error:
        raise ChapterActivityError("Reviewed chapter activities are unavailable") from error


def activities_for_chapter(book_id: str, chapter_id: str, detail: bool = False) -> list[dict[str, Any]]:
    catalog = load_chapter_activities()
    if catalog["bookId"] != book_id: return []
    chapter = next((item for item in catalog["chapters"] if item["chapterId"] == chapter_id), None)
    if chapter is None: return []
    activities = deepcopy(chapter["activities"])
    if detail: return activities
    return [{key: activity[key] for key in ("id", "version", "activityType", "reviewStatus", "sourceSentenceIds", "reward")} for activity in activities]
