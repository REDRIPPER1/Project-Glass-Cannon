from functools import lru_cache
import json
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="ReadQuest API")

QUEST_DIRECTORY = Path(__file__).resolve().parent / "data"

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health_check():
    return {"status": "ok", "service": "ReadQuest API"}


def _validate_quest(quest: dict) -> None:
    """Fail fast if bundled content cannot support the learner evidence flow."""
    required_fields = {
        "id",
        "title",
        "topic",
        "difficulty",
        "readingTimeMinutes",
        "skillTags",
        "source",
        "passage",
        "workedExample",
        "questions",
    }
    missing_fields = required_fields.difference(quest)
    if missing_fields:
        raise ValueError(f"Quest is missing required fields: {sorted(missing_fields)}")

    source = quest["source"]
    required_source_fields = {
        "sourceType",
        "rightsStatus",
        "license",
        "requiredAttribution",
        "label",
    }
    missing_source_fields = required_source_fields.difference(source)
    if missing_source_fields:
        raise ValueError(
            f"Quest source is missing required fields: {sorted(missing_source_fields)}"
        )
    if source["sourceType"] == "public-domain-book-excerpt":
        required_book_fields = {
            "bookTitle",
            "author",
            "edition",
            "chapter",
            "sourceUrl",
            "publicDomainBasis",
            "territory",
        }
        missing_book_fields = required_book_fields.difference(source)
        if missing_book_fields or source["rightsStatus"] != "verified":
            raise ValueError("Public-domain book excerpts require verified source metadata")

    sentences = quest["passage"]
    if not isinstance(sentences, list):
        raise ValueError("Quest passage must be a list of sentences")
    sentence_ids = {sentence.get("id") for sentence in sentences}
    sentence_text_by_id = {sentence.get("id"): sentence.get("text") for sentence in sentences}
    if not sentences or None in sentence_ids or any(
        not sentence.get("text") for sentence in sentences
    ):
        raise ValueError("Quest passage must have uniquely identified sentences")
    if len(sentence_ids) != len(sentences):
        raise ValueError("Quest passage sentence IDs must be unique")

    for question in quest["questions"]:
        choices = {choice.get("id") for choice in question.get("choices", [])}
        correct_choice = question.get("correctChoiceId")
        evidence_options = question.get("evidenceOptions", [])
        evidence_ids = {evidence.get("sentenceId") for evidence in evidence_options}
        correct_evidence = question.get("correctEvidenceSentenceId")

        if correct_choice not in choices:
            raise ValueError(f"Question {question.get('id')} has an invalid correct choice")
        if correct_evidence not in sentence_ids:
            raise ValueError(f"Question {question.get('id')} has an invalid evidence reference")
        if correct_evidence not in evidence_ids:
            raise ValueError(
                f"Question {question.get('id')} does not offer its correct evidence sentence"
            )
        if any(
            evidence.get("text") != sentence_text_by_id.get(evidence.get("sentenceId"))
            for evidence in evidence_options
        ):
            raise ValueError(
                f"Question {question.get('id')} has evidence text that does not match the passage"
            )


@lru_cache
def load_quests() -> dict[str, dict]:
    quests: dict[str, dict] = {}
    for quest_path in sorted(QUEST_DIRECTORY.glob("*.json")):
        with quest_path.open(encoding="utf-8") as quest_file:
            quest = json.load(quest_file)
        _validate_quest(quest)
        quest_id = quest["id"]
        if quest_id in quests:
            raise ValueError(f"Duplicate quest ID: {quest_id}")
        quests[quest_id] = quest

    if not quests:
        raise ValueError("No bundled quest content is available")
    return quests


def _available_quests() -> dict[str, dict]:
    try:
        return load_quests()
    except (OSError, ValueError, json.JSONDecodeError) as error:
        raise HTTPException(
            status_code=503, detail="Quest content is temporarily unavailable."
        ) from error


@app.get("/api/quests")
def list_quests():
    """Return compact quest cards; the browser can use its bundled JSON fallback."""
    return [
        {
            key: quest[key]
            for key in (
                "id",
                "title",
                "topic",
                "difficulty",
                "readingTimeMinutes",
                "skillTags",
            )
        }
        for quest in _available_quests().values()
    ]


@app.get("/api/quests/{quest_id}")
def get_quest(quest_id: str):
    """Serve the same reviewed seed object that is bundled with the client."""
    quest = _available_quests().get(quest_id)
    if quest is None:
        raise HTTPException(status_code=404, detail="Quest not found.")
    return quest
