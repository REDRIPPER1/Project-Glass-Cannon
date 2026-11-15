"""Reviewed, offline-safe Reading Basics lesson catalog."""

from __future__ import annotations

from copy import deepcopy
from functools import lru_cache
import json
from pathlib import Path
from typing import Any


READING_BASICS_PATH = Path(__file__).resolve().parent / "data" / "reading-basics" / "lessons.json"

VALID_ACTIVITY_TYPES = frozenset(
    {
        "clue-hunt",
        "timeline-repair",
        "character-connections",
        "context-clues",
        "prediction-path",
        "scene-reconstruction",
        "story-quest",
        "creative-response",
    }
)


class ReadingBasicsValidationError(ValueError):
    """Raised when a Reading Basics activity cannot safely be published."""


def _object(value: object, context: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise ReadingBasicsValidationError(f"{context} must be an object")
    return value


def _text(value: object, context: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ReadingBasicsValidationError(f"{context} must be a non-empty string")
    return value


def _rows(value: object, context: str) -> list[dict[str, Any]]:
    if not isinstance(value, list) or not value:
        raise ReadingBasicsValidationError(f"{context} must be a non-empty list")
    return [_object(row, context) for row in value]


def _passage(source: dict[str, Any], context: str) -> dict[str, str]:
    sentences = _rows(source.get("passage"), f"{context}.passage")
    sentence_text_by_id: dict[str, str] = {}
    for sentence in sentences:
        sentence_id = _text(sentence.get("id"), f"{context}.passage id")
        text = _text(sentence.get("text"), f"{context}.passage {sentence_id} text")
        if sentence_id in sentence_text_by_id:
            raise ReadingBasicsValidationError(f"{context} has duplicate sentence ID {sentence_id}")
        sentence_text_by_id[sentence_id] = text
    return sentence_text_by_id


def _sentence_ids(value: object, available: dict[str, str], context: str) -> list[str]:
    if not isinstance(value, list) or not value or not all(isinstance(item, str) for item in value):
        raise ReadingBasicsValidationError(f"{context} must be a non-empty list of sentence IDs")
    for sentence_id in value:
        if sentence_id not in available:
            raise ReadingBasicsValidationError(f"{context} references unknown sentence ID {sentence_id}")
    return value


def _validate_source(source_value: object, activity_id: str) -> dict[str, str]:
    source = _object(source_value, f"Activity {activity_id}.source")
    source_type = _text(source.get("sourceType"), f"Activity {activity_id}.source.sourceType")
    rights_status = _text(source.get("rightsStatus"), f"Activity {activity_id}.source.rightsStatus")
    _text(source.get("attribution"), f"Activity {activity_id}.source.attribution")
    available = _passage(source, f"Activity {activity_id}.source")
    if source_type == "original-companion":
        if rights_status != "project-original":
            raise ReadingBasicsValidationError(
                f"Activity {activity_id} original companion content must have project-original rights"
            )
    elif source_type == "approved-book-chapter":
        for field in ("bookId", "edition"):
            _text(source.get(field), f"Activity {activity_id}.source.{field}")
        chapter_ids = source.get("chapterIds")
        if not isinstance(chapter_ids, list) or not chapter_ids or not all(isinstance(item, str) and item for item in chapter_ids):
            raise ReadingBasicsValidationError(f"Activity {activity_id}.source.chapterIds must be a non-empty string list")
        _sentence_ids(source.get("sentenceIds"), available, f"Activity {activity_id}.source.sentenceIds")
    else:
        raise ReadingBasicsValidationError(f"Activity {activity_id} has unsupported sourceType {source_type}")
    return available


def _validate_activity(activity_value: object, lesson_id: str) -> tuple[str, dict[str, str]]:
    activity = _object(activity_value, f"Lesson {lesson_id} activity")
    required = {
        "id", "version", "type", "reviewStatus", "prompt", "hint", "task",
        "correctFeedback", "completionRule", "source",
    }
    missing = sorted(required.difference(activity))
    if missing:
        raise ReadingBasicsValidationError(f"Lesson {lesson_id} activity is missing required fields: {missing}")
    activity_id = _text(activity.get("id"), f"Lesson {lesson_id} activity id")
    if not isinstance(activity["version"], int) or activity["version"] < 1:
        raise ReadingBasicsValidationError(f"Activity {activity_id}.version must be a positive integer")
    if activity["type"] not in VALID_ACTIVITY_TYPES:
        raise ReadingBasicsValidationError(f"Activity {activity_id} has unsupported type")
    if activity["reviewStatus"] != "reviewed":
        raise ReadingBasicsValidationError(f"Activity {activity_id} must be reviewed before publication")
    _text(activity.get("prompt"), f"Activity {activity_id}.prompt")
    _text(activity.get("hint"), f"Activity {activity_id}.hint")
    available = _validate_source(activity["source"], activity_id)

    task = _object(activity["task"], f"Activity {activity_id}.task")
    for field in ("question", "correctChoiceId", "explanation"):
        _text(task.get(field), f"Activity {activity_id}.task.{field}")
    choices = _rows(task.get("choices"), f"Activity {activity_id}.task.choices")
    choice_ids = {_text(choice.get("id"), f"Activity {activity_id} choice id") for choice in choices}
    for choice in choices:
        _text(choice.get("text"), f"Activity {activity_id} choice text")
    if task["correctChoiceId"] not in choice_ids:
        raise ReadingBasicsValidationError(f"Activity {activity_id} has an invalid correct choice")
    evidence_options = _rows(task.get("evidenceOptions"), f"Activity {activity_id}.task.evidenceOptions")
    offered_evidence_ids: set[str] = set()
    for evidence in evidence_options:
        sentence_id = _text(evidence.get("sentenceId"), f"Activity {activity_id} evidence sentenceId")
        text = _text(evidence.get("text"), f"Activity {activity_id} evidence text")
        if sentence_id not in available or text != available[sentence_id]:
            raise ReadingBasicsValidationError(f"Activity {activity_id} evidence must exactly match its source passage")
        offered_evidence_ids.add(sentence_id)
    correct_evidence = _sentence_ids(task.get("correctEvidenceSentenceIds"), available, f"Activity {activity_id}.task.correctEvidenceSentenceIds")
    if not set(correct_evidence).issubset(offered_evidence_ids):
        raise ReadingBasicsValidationError(f"Activity {activity_id} must offer every correct evidence sentence")

    feedback = _object(activity["correctFeedback"], f"Activity {activity_id}.correctFeedback")
    for field in ("title", "message"):
        _text(feedback.get(field), f"Activity {activity_id}.correctFeedback.{field}")
    _sentence_ids(feedback.get("evidenceSentenceIds"), available, f"Activity {activity_id}.correctFeedback.evidenceSentenceIds")
    completion = _object(activity["completionRule"], f"Activity {activity_id}.completionRule")
    if completion.get("successState") != "completed":
        raise ReadingBasicsValidationError(f"Activity {activity_id}.completionRule.successState must be completed")
    _text(completion.get("kind"), f"Activity {activity_id}.completionRule.kind")
    return activity_id, available


def validate_reading_basics(value: object) -> dict[str, Any]:
    catalog = _object(value, "Reading Basics catalog")
    if catalog.get("schemaVersion") != 1:
        raise ReadingBasicsValidationError("Reading Basics catalog schemaVersion must be 1")
    lessons = _rows(catalog.get("lessons"), "Reading Basics lessons")
    lesson_ids: set[str] = set()
    skills: set[str] = set()
    seen_types: set[str] = set()
    for lesson in lessons:
        required = {"id", "version", "skill", "title", "explanation", "workedExample", "activities"}
        missing = sorted(required.difference(lesson))
        if missing:
            raise ReadingBasicsValidationError(f"Lesson is missing required fields: {missing}")
        lesson_id = _text(lesson.get("id"), "Lesson id")
        if lesson_id in lesson_ids:
            raise ReadingBasicsValidationError(f"Duplicate lesson ID {lesson_id}")
        lesson_ids.add(lesson_id)
        if not isinstance(lesson["version"], int) or lesson["version"] < 1:
            raise ReadingBasicsValidationError(f"Lesson {lesson_id}.version must be a positive integer")
        skills.add(_text(lesson.get("skill"), f"Lesson {lesson_id}.skill"))
        _text(lesson.get("title"), f"Lesson {lesson_id}.title")
        _text(lesson.get("explanation"), f"Lesson {lesson_id}.explanation")
        activity_sources: dict[str, dict[str, str]] = {}
        for activity in _rows(lesson["activities"], f"Lesson {lesson_id}.activities"):
            activity_id, source = _validate_activity(activity, lesson_id)
            if activity_id in activity_sources:
                raise ReadingBasicsValidationError(f"Lesson {lesson_id} has duplicate activity ID {activity_id}")
            activity_sources[activity_id] = source
            seen_types.add(activity["type"])
        example = _object(lesson["workedExample"], f"Lesson {lesson_id}.workedExample")
        for field in ("activityId", "title", "notice", "think", "prove", "answer"):
            _text(example.get(field), f"Lesson {lesson_id}.workedExample.{field}")
        activity_id = example["activityId"]
        if activity_id not in activity_sources:
            raise ReadingBasicsValidationError(f"Lesson {lesson_id}.workedExample references an unknown activity")
        _sentence_ids(example.get("evidenceSentenceIds"), activity_sources[activity_id], f"Lesson {lesson_id}.workedExample.evidenceSentenceIds")
    required_skills = {
        "main-idea", "inference", "vocabulary-in-context", "text-evidence",
        "character-motives-and-decisions", "sequencing-and-summarizing", "author-purpose-and-point-of-view",
    }
    if skills != required_skills:
        raise ReadingBasicsValidationError("Reading Basics must include exactly the seven starter skills")
    if seen_types != VALID_ACTIVITY_TYPES:
        raise ReadingBasicsValidationError("Reading Basics must cover every supported activity type")
    return catalog


@lru_cache
def load_reading_basics(path: Path = READING_BASICS_PATH) -> dict[str, Any]:
    try:
        with path.open(encoding="utf-8") as handle:
            return deepcopy(validate_reading_basics(json.load(handle)))
    except (OSError, json.JSONDecodeError) as error:
        raise ReadingBasicsValidationError(f"Could not load Reading Basics data from {path.name}") from error


def lesson_summaries() -> list[dict[str, Any]]:
    return [
        {key: lesson[key] for key in ("id", "version", "skill", "title", "explanation")}
        for lesson in load_reading_basics()["lessons"]
    ]
