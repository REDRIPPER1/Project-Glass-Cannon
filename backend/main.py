from __future__ import annotations

from collections.abc import Mapping
from copy import deepcopy
from functools import lru_cache
import json
from pathlib import Path
import re

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .book_catalog import BookCatalogError, load_quest_mappings
from .catalog import CatalogError, load_catalogs
from .progression import progression_definition
from .store import DemoStore, PlatformError, create_store

app = FastAPI(
    title="LitLearn API",
    description=(
        "Optional API for reviewed LitLearn content. The React app bundles the same "
        "JSON files and must remain usable when this service is unavailable."
    ),
)

QUEST_DIRECTORY = Path(__file__).resolve().parent / "data"
CATALOGS = load_catalogs()
platform_store: DemoStore = create_store(CATALOGS)
WORD_PATTERN = re.compile(r"[A-Za-z0-9]+(?:[’'-][A-Za-z0-9]+)?")

REQUIRED_QUEST_FIELDS = frozenset(
    {
        "id",
        "title",
        "topic",
        "difficulty",
        "readingTimeMinutes",
        "passageWordCount",
        "skillTags",
        "source",
        "passage",
        "workedExample",
        "questions",
    }
)
REQUIRED_SOURCE_FIELDS = frozenset(
    {
        "sourceType",
        "rightsStatus",
        "license",
        "requiredAttribution",
        "label",
        "territory",
    }
)
REQUIRED_BOOK_SOURCE_FIELDS = frozenset(
    {
        "bookTitle",
        "author",
        "edition",
        "chapter",
        "sourceUrl",
        "publicDomainBasis",
    }
)
REQUIRED_WORKED_EXAMPLE_FIELDS = frozenset(
    {"title", "notice", "think", "prove", "answer", "evidence"}
)
REQUIRED_QUESTION_FIELDS = frozenset(
    {
        "id",
        "type",
        "targetSkill",
        "prompt",
        "choices",
        "correctChoiceId",
        "explanation",
        "evidenceOptions",
        "correctEvidenceSentenceId",
        "storyConsequence",
        "followUpSuggestion",
    }
)
REQUIRED_CONSEQUENCE_FIELDS = frozenset(
    {"strongTitle", "strongMessage", "practiceTitle", "practiceMessage"}
)


class QuestValidationError(ValueError):
    """Raised when a reviewed quest cannot safely enter the API or bundled library."""


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health", summary="Check API availability")
def health_check():
    return {"status": "ok", "service": "LitLearn API"}


def _require_mapping(value: object, context: str) -> Mapping[str, object]:
    if not isinstance(value, Mapping):
        raise QuestValidationError(f"{context} must be an object")
    return value


def _require_fields(
    value: Mapping[str, object], required_fields: frozenset[str], context: str
) -> None:
    missing_fields = sorted(required_fields.difference(value))
    if missing_fields:
        raise QuestValidationError(f"{context} is missing required fields: {missing_fields}")


def _require_nonempty_string(value: object, context: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise QuestValidationError(f"{context} must be a non-empty string")
    return value


def _count_words(sentences: list[Mapping[str, object]]) -> int:
    return sum(
        len(WORD_PATTERN.findall(_require_nonempty_string(sentence.get("text"), "passage text")))
        for sentence in sentences
    )


def _validate_source(source_value: object, quest_id: str) -> Mapping[str, object]:
    source = _require_mapping(source_value, f"Quest {quest_id} source")
    _require_fields(source, REQUIRED_SOURCE_FIELDS, f"Quest {quest_id} source")
    for field in REQUIRED_SOURCE_FIELDS:
        _require_nonempty_string(source.get(field), f"Quest {quest_id} source.{field}")

    source_type = source["sourceType"]
    if source_type == "public-domain-book-excerpt":
        _require_fields(source, REQUIRED_BOOK_SOURCE_FIELDS, f"Quest {quest_id} source")
        for field in REQUIRED_BOOK_SOURCE_FIELDS:
            _require_nonempty_string(source.get(field), f"Quest {quest_id} source.{field}")
        if source["rightsStatus"] != "verified":
            raise QuestValidationError(
                f"Quest {quest_id} public-domain book excerpt must have rightsStatus 'verified'"
            )
    elif source_type == "original" and source["rightsStatus"] != "original":
        raise QuestValidationError(
            f"Quest {quest_id} original content must have rightsStatus 'original'"
        )
    return source


def _validate_passage(quest: Mapping[str, object], quest_id: str) -> dict[str, str]:
    passage = quest["passage"]
    if not isinstance(passage, list) or not passage:
        raise QuestValidationError(f"Quest {quest_id} passage must be a non-empty list")

    sentence_text_by_id: dict[str, str] = {}
    for sentence in passage:
        sentence_mapping = _require_mapping(sentence, f"Quest {quest_id} passage sentence")
        sentence_id = _require_nonempty_string(
            sentence_mapping.get("id"), f"Quest {quest_id} passage sentence id"
        )
        sentence_text = _require_nonempty_string(
            sentence_mapping.get("text"), f"Quest {quest_id} passage sentence {sentence_id} text"
        )
        if sentence_id in sentence_text_by_id:
            raise QuestValidationError(f"Quest {quest_id} has duplicate passage sentence ID {sentence_id}")
        sentence_text_by_id[sentence_id] = sentence_text

    declared_word_count = quest["passageWordCount"]
    if not isinstance(declared_word_count, int):
        raise QuestValidationError(f"Quest {quest_id} passageWordCount must be an integer")
    actual_word_count = _count_words([{"text": text} for text in sentence_text_by_id.values()])
    if declared_word_count != actual_word_count:
        raise QuestValidationError(
            f"Quest {quest_id} passageWordCount is {declared_word_count}, not {actual_word_count}"
        )
    if not 200 <= actual_word_count <= 250:
        raise QuestValidationError(
            f"Quest {quest_id} must contain 200–250 words, found {actual_word_count}"
        )
    return sentence_text_by_id


def _validate_worked_example(
    worked_example_value: object, sentence_text_by_id: Mapping[str, str], quest_id: str
) -> None:
    worked_example = _require_mapping(worked_example_value, f"Quest {quest_id} workedExample")
    _require_fields(
        worked_example, REQUIRED_WORKED_EXAMPLE_FIELDS, f"Quest {quest_id} workedExample"
    )
    for field in REQUIRED_WORKED_EXAMPLE_FIELDS:
        _require_nonempty_string(
            worked_example.get(field), f"Quest {quest_id} workedExample.{field}"
        )
    evidence_id = worked_example["evidence"]
    if evidence_id not in sentence_text_by_id:
        raise QuestValidationError(
            f"Quest {quest_id} workedExample evidence ID {evidence_id} is not in its passage"
        )


def _validate_questions(
    questions_value: object, sentence_text_by_id: Mapping[str, str], quest_id: str
) -> None:
    if not isinstance(questions_value, list) or len(questions_value) != 3:
        raise QuestValidationError(f"Quest {quest_id} must contain exactly three questions")

    question_ids: set[str] = set()
    target_skills: set[str] = set()
    for question_value in questions_value:
        question = _require_mapping(question_value, f"Quest {quest_id} question")
        _require_fields(question, REQUIRED_QUESTION_FIELDS, f"Quest {quest_id} question")
        question_id = _require_nonempty_string(
            question.get("id"), f"Quest {quest_id} question id"
        )
        if question_id in question_ids:
            raise QuestValidationError(f"Quest {quest_id} has duplicate question ID {question_id}")
        question_ids.add(question_id)

        for field in (
            "type",
            "targetSkill",
            "prompt",
            "correctChoiceId",
            "explanation",
            "correctEvidenceSentenceId",
            "followUpSuggestion",
        ):
            _require_nonempty_string(
                question.get(field), f"Quest {quest_id} question {question_id}.{field}"
            )
        if question["type"] != "multiple-choice":
            raise QuestValidationError(
                f"Quest {quest_id} question {question_id} must be multiple-choice"
            )
        target_skills.add(question["targetSkill"])

        choices_value = question["choices"]
        if not isinstance(choices_value, list) or len(choices_value) < 2:
            raise QuestValidationError(
                f"Quest {quest_id} question {question_id} must have at least two choices"
            )
        choice_ids: set[str] = set()
        for choice_value in choices_value:
            choice = _require_mapping(choice_value, f"Quest {quest_id} question {question_id} choice")
            choice_id = _require_nonempty_string(
                choice.get("id"), f"Quest {quest_id} question {question_id} choice id"
            )
            _require_nonempty_string(
                choice.get("text"), f"Quest {quest_id} question {question_id} choice text"
            )
            if choice_id in choice_ids:
                raise QuestValidationError(
                    f"Quest {quest_id} question {question_id} has duplicate choice ID {choice_id}"
                )
            choice_ids.add(choice_id)
        if question["correctChoiceId"] not in choice_ids:
            raise QuestValidationError(
                f"Quest {quest_id} question {question_id} has an invalid correct choice"
            )

        evidence_options_value = question["evidenceOptions"]
        if not isinstance(evidence_options_value, list) or not evidence_options_value:
            raise QuestValidationError(
                f"Quest {quest_id} question {question_id} must offer evidence options"
            )
        evidence_ids: set[str] = set()
        for evidence_value in evidence_options_value:
            evidence = _require_mapping(
                evidence_value, f"Quest {quest_id} question {question_id} evidence option"
            )
            evidence_id = _require_nonempty_string(
                evidence.get("sentenceId"),
                f"Quest {quest_id} question {question_id} evidence sentenceId",
            )
            evidence_text = _require_nonempty_string(
                evidence.get("text"),
                f"Quest {quest_id} question {question_id} evidence text",
            )
            if evidence_id not in sentence_text_by_id:
                raise QuestValidationError(
                    f"Quest {quest_id} question {question_id} references unknown evidence ID {evidence_id}"
                )
            if evidence_text != sentence_text_by_id[evidence_id]:
                raise QuestValidationError(
                    f"Quest {quest_id} question {question_id} evidence text does not match {evidence_id}"
                )
            evidence_ids.add(evidence_id)
        if question["correctEvidenceSentenceId"] not in evidence_ids:
            raise QuestValidationError(
                f"Quest {quest_id} question {question_id} does not offer its correct evidence sentence"
            )

        consequence = _require_mapping(
            question["storyConsequence"],
            f"Quest {quest_id} question {question_id} storyConsequence",
        )
        _require_fields(
            consequence,
            REQUIRED_CONSEQUENCE_FIELDS,
            f"Quest {quest_id} question {question_id} storyConsequence",
        )
        for field in REQUIRED_CONSEQUENCE_FIELDS:
            _require_nonempty_string(
                consequence.get(field),
                f"Quest {quest_id} question {question_id} storyConsequence.{field}",
            )

    if len(target_skills) != 1:
        raise QuestValidationError(f"Quest {quest_id} questions must share one target skill")


def validate_quest(quest_value: object) -> dict[str, object]:
    """Validate the stable bundled-quest contract before returning or serving it."""
    quest = dict(_require_mapping(quest_value, "Quest"))
    _require_fields(quest, REQUIRED_QUEST_FIELDS, "Quest")
    quest_id = _require_nonempty_string(quest.get("id"), "Quest id")
    for field in ("title", "topic", "difficulty"):
        _require_nonempty_string(quest.get(field), f"Quest {quest_id} {field}")
    if not isinstance(quest["readingTimeMinutes"], int) or quest["readingTimeMinutes"] <= 0:
        raise QuestValidationError(f"Quest {quest_id} readingTimeMinutes must be a positive integer")
    if not isinstance(quest["skillTags"], list) or not quest["skillTags"]:
        raise QuestValidationError(f"Quest {quest_id} skillTags must be a non-empty list")
    for tag in quest["skillTags"]:
        _require_nonempty_string(tag, f"Quest {quest_id} skill tag")

    _validate_source(quest["source"], quest_id)
    sentence_text_by_id = _validate_passage(quest, quest_id)
    _validate_worked_example(quest["workedExample"], sentence_text_by_id, quest_id)
    _validate_questions(quest["questions"], sentence_text_by_id, quest_id)
    return quest


def load_quests_from(quest_directory: Path) -> dict[str, dict[str, object]]:
    """Load and validate every reviewed quest file from a directory."""
    quests: dict[str, dict[str, object]] = {}
    quest_paths = sorted(quest_directory.glob("quest-*.json"))
    if not quest_paths:
        raise QuestValidationError("No bundled quest content is available")

    for quest_path in quest_paths:
        try:
            with quest_path.open(encoding="utf-8") as quest_file:
                quest = validate_quest(json.load(quest_file))
        except (OSError, json.JSONDecodeError) as error:
            raise QuestValidationError(f"Could not read {quest_path.name}") from error

        quest_id = quest["id"]
        if quest_id in quests:
            raise QuestValidationError(f"Duplicate quest ID: {quest_id}")
        quests[quest_id] = quest
    return quests


@lru_cache
def load_quests() -> dict[str, dict[str, object]]:
    return load_quests_from(QUEST_DIRECTORY)


def _available_quests() -> dict[str, dict[str, object]]:
    try:
        return load_quests()
    except (OSError, ValueError, json.JSONDecodeError) as error:
        raise HTTPException(
            status_code=503,
            detail={
                "code": "quest_content_unavailable",
                "message": "Reviewed quest content is temporarily unavailable.",
            },
        ) from error


def _quest_summary(quest: Mapping[str, object]) -> dict[str, object]:
    source = _require_mapping(quest["source"], f"Quest {quest['id']} source")
    return {
        key: quest[key]
        for key in (
            "id",
            "title",
            "topic",
            "difficulty",
            "readingTimeMinutes",
            "skillTags",
        )
    } | {
        "source": {
            key: source[key]
            for key in ("sourceType", "rightsStatus", "label", "requiredAttribution")
        }
    }


@app.get("/api/quests", summary="List reviewed quest cards")
def list_quests():
    """Return compact cards; detailed content remains available in bundled JSON offline."""
    return [_quest_summary(quest) for quest in _available_quests().values()]


@app.get("/api/quests/{quest_id}", summary="Get one reviewed quest")
def get_quest(quest_id: str):
    """Return the exact reviewed object used by the browser's local fallback."""
    quest = _available_quests().get(quest_id)
    if quest is None:
        raise HTTPException(
            status_code=404,
            detail={
                "code": "quest_not_found",
                "message": f"No reviewed quest exists with ID '{quest_id}'.",
            },
        )
    return quest


@app.get("/api/quests/{quest_id}/book-reference", summary="Get an exact quest-to-book edition and chapter mapping")
def get_quest_book_reference(quest_id: str):
    if quest_id not in _available_quests():
        raise HTTPException(status_code=404, detail={"code": "quest_not_found", "message": f"No reviewed quest exists with ID '{quest_id}'."})
    try:
        mapping = next((item for item in load_quest_mappings(catalog=platform_store.book_catalog)["mappings"] if item["id"] == quest_id), None)
    except BookCatalogError as error:
        raise HTTPException(status_code=503, detail={"code": "book_catalog_unavailable", "message": "Book references are temporarily unavailable."}) from error
    if mapping is None:
        raise HTTPException(status_code=404, detail={"code": "quest_book_mapping_not_found", "message": "This reviewed quest does not yet have a book mapping."})
    return mapping


# The APIs below are optional local-demo services. The browser remains able to
# run the reviewed reading quests from bundled JSON with this service stopped.
def _platform(action):
    try:
        return action()
    except PlatformError as error:
        raise HTTPException(
            status_code=error.status_code,
            detail={"code": error.code, "message": str(error)},
        ) from error
    except (CatalogError, BookCatalogError) as error:
        raise HTTPException(
            status_code=503,
            detail={"code": "catalog_unavailable", "message": "Reviewed demo catalogs are unavailable."},
        ) from error


@app.post("/api/profiles", status_code=201, summary="Create an anonymous local-demo profile")
def create_profile(payload: dict[str, object] | None = None):
    payload = payload or {}
    return _platform(
        lambda: platform_store.create_profile(
            payload.get("displayName") if isinstance(payload.get("displayName"), str) else None,
            payload.get("demoPlan", "free") if isinstance(payload.get("demoPlan", "free"), str) else "",
        )
    )


@app.get("/api/profiles/{profile_id}", summary="Retrieve an anonymous profile")
def get_profile(profile_id: str):
    return _platform(lambda: platform_store.get_profile(profile_id))


@app.get("/api/profiles/{profile_id}/currencies", summary="Get local-demo currency balances")
def get_currency_balances(profile_id: str):
    return _platform(lambda: platform_store.balances(profile_id))


@app.patch("/api/profiles/{profile_id}", summary="Update safe local profile preferences")
def update_profile(profile_id: str, payload: dict[str, object]):
    return _platform(lambda: platform_store.update_profile(profile_id, dict(payload)))


@app.patch("/api/profiles/{profile_id}/pets/{pet_id}/name", summary="Set an owned pet nickname")
def rename_pet(profile_id: str, pet_id: str, payload: dict[str, object]):
    name = payload.get("name")
    return _platform(lambda: platform_store.rename_pet(profile_id, pet_id, name if isinstance(name, str) else ""))


@app.put("/api/profiles/{profile_id}/active-pet/{pet_id}", summary="Select an owned active pet")
def select_active_pet(profile_id: str, pet_id: str):
    return _platform(lambda: platform_store.set_active_pet(profile_id, pet_id))


@app.put("/api/profiles/{profile_id}/accessories/{accessory_id}", summary="Equip a compatible owned accessory")
def equip_accessory(profile_id: str, accessory_id: str):
    return _platform(lambda: platform_store.equip_accessory(profile_id, accessory_id))


@app.delete("/api/profiles/{profile_id}/accessories/{category}", summary="Unequip an accessory category")
def unequip_accessory(profile_id: str, category: str):
    return _platform(lambda: platform_store.unequip_accessory(profile_id, category))


@app.put("/api/profiles/{profile_id}/wishlist/{item_type}/{catalog_id}", summary="Add an item to a wishlist")
def add_wishlist_item(profile_id: str, item_type: str, catalog_id: str):
    return _platform(lambda: platform_store.change_wishlist(profile_id, item_type, catalog_id, True))


@app.delete("/api/profiles/{profile_id}/wishlist/{item_type}/{catalog_id}", summary="Remove an item from a wishlist")
def remove_wishlist_item(profile_id: str, item_type: str, catalog_id: str):
    return _platform(lambda: platform_store.change_wishlist(profile_id, item_type, catalog_id, False))


@app.get("/api/catalog/pets", summary="List companion catalog")
def list_pets():
    return deepcopy(CATALOGS["pets"])


@app.get("/api/catalog/pets/{pet_id}", summary="Get companion details and rights metadata")
def get_pet(pet_id: str):
    return _platform(lambda: platform_store._catalog_item(platform_store.pets, pet_id, "pet"))


@app.get("/api/catalog/accessories", summary="List accessory catalog")
def list_accessories():
    return deepcopy(CATALOGS["accessories"])


@app.get("/api/catalog/eggs", summary="List egg catalog and explicit odds")
def list_eggs():
    return deepcopy(CATALOGS["eggs"])


@app.get("/api/catalog/events", summary="List event-only catalog availability")
def list_events():
    return deepcopy(CATALOGS["events"])


@app.post("/api/profiles/{profile_id}/xp", summary="Record a bounded quest or demo XP award")
def award_xp(profile_id: str, payload: dict[str, object]):
    return _platform(lambda: platform_store.add_xp(profile_id, payload.get("amount"), payload.get("source")))


@app.post("/api/profiles/{profile_id}/quests/{quest_id}/attempts", summary="Award verified answer and evidence XP once")
def award_quest_attempt(profile_id: str, quest_id: str, payload: dict[str, object]):
    quest = _available_quests().get(quest_id)
    if quest is None:
        raise HTTPException(status_code=404, detail={"code": "quest_not_found", "message": f"No reviewed quest exists with ID '{quest_id}'."})
    responses = payload.get("responses")
    return _platform(
        lambda: platform_store.award_quest_attempt(
            profile_id,
            quest,
            payload.get("attemptId") if isinstance(payload.get("attemptId"), str) else "",
            responses if isinstance(responses, list) else [],
        )
    )


@app.get("/api/profiles/{profile_id}/progress", summary="Get levels, badges, achievements, and map nodes")
def get_progress(profile_id: str):
    return _platform(lambda: platform_store.progress(profile_id))


@app.get("/api/catalog/progression", summary="Get all 100 deterministic Level Road thresholds and award policy")
def get_progression_catalog():
    reward_ids_by_level = {
        int(node["id"].removeprefix("level-")): node["rewardIds"]
        for node in CATALOGS["levelNodes"]
        if node["id"].removeprefix("level-").isdigit()
    }
    return progression_definition(reward_ids_by_level)


@app.get("/api/profiles/{profile_id}/collections", summary="Get earned and wishlist collection state")
def get_collections(profile_id: str):
    return _platform(lambda: platform_store.collections(profile_id))


@app.get("/api/catalog/badges", summary="List badge definitions")
def list_badges():
    return deepcopy(CATALOGS["badges"])


@app.get("/api/catalog/achievements", summary="List achievement definitions")
def list_achievements():
    return deepcopy(CATALOGS["achievements"])


@app.get("/api/catalog/trophies", summary="List trophy definitions")
def list_trophies():
    return deepcopy(CATALOGS["trophies"])


@app.get("/api/profiles/{profile_id}/rewards", summary="List issued reward instances")
def list_rewards(profile_id: str):
    return _platform(lambda: platform_store.rewards_for_profile(profile_id))


@app.post("/api/profiles/{profile_id}/rewards/{reward_instance_id}/claim", summary="Claim an issued reward once")
def claim_reward(profile_id: str, reward_instance_id: str):
    return _platform(lambda: platform_store.claim_reward(profile_id, reward_instance_id))


@app.get("/api/catalog/shop", summary="List local mock shop items")
def list_shop_items():
    return platform_store.shop_catalog()


@app.post("/api/profiles/{profile_id}/purchases", summary="Make a reversible local-demo purchase")
def purchase_item(profile_id: str, payload: dict[str, object]):
    shop_item_id = payload.get("shopItemId")
    return _platform(lambda: platform_store.purchase(profile_id, shop_item_id if isinstance(shop_item_id, str) else ""))


@app.post("/api/profiles/{profile_id}/purchases/{purchase_id}/reverse", summary="Reverse an unused mock purchase")
def reverse_purchase(profile_id: str, purchase_id: str):
    return _platform(lambda: platform_store.reverse_purchase(profile_id, purchase_id))


@app.post("/api/profiles/{profile_id}/wishlist/redemptions", summary="Redeem five Wishlist Pages for one permanent wishlisted book")
def redeem_wishlist_pages(profile_id: str):
    return _platform(lambda: platform_store.redeem_wishlist_pages(profile_id))


@app.post("/api/profiles/{profile_id}/eggs/{egg_id}/open", summary="Open a purchased egg with validated demo odds")
def open_egg(profile_id: str, egg_id: str, payload: dict[str, object] | None = None):
    payload = payload or {}
    deterministic = payload.get("deterministicDemo", True)
    return _platform(lambda: platform_store.open_egg(profile_id, egg_id, deterministic is not False))


@app.get("/api/catalog/books", summary="List book metadata and access tiers")
def list_books():
    return platform_store.public_books()


@app.get("/api/catalog/books/{book_id}", summary="Get book rights and chapter metadata")
def get_book(book_id: str):
    return _platform(lambda: platform_store.public_book(book_id))


@app.get("/api/books", summary="List metadata-only web-reader catalog records")
def list_web_books():
    return list_books()


@app.get("/api/books/{book_id}", summary="Get one metadata-only web-reader catalog record")
def get_web_book(book_id: str):
    return get_book(book_id)


@app.get("/api/profiles/{profile_id}/books/{book_id}/access", summary="Check a book's current entitlement without retrieving text")
def check_book_access(profile_id: str, book_id: str):
    book = _platform(lambda: platform_store._catalog_item(platform_store.books, book_id, "book"))
    chapters = book["chapterMetadata"]
    if not chapters:
        return _platform(
            lambda: {
                "bookId": book_id,
                "allowed": book_id in platform_store._profile(profile_id)["ownedBookIds"],
                "reason": "chapter_boundaries_unavailable",
                "inAppContentAvailable": False,
                "attribution": platform_store._book_attribution(book),
            }
        )
    return _platform(lambda: platform_store.book_access(profile_id, book_id, chapters[0]["id"]))


@app.get("/api/profiles/{profile_id}/books/{book_id}/chapters/{chapter_id}/access", summary="Check chapter access")
def check_chapter_access(profile_id: str, book_id: str, chapter_id: str):
    return _platform(lambda: platform_store.book_access(profile_id, book_id, chapter_id, "chapter"))


@app.get("/api/profiles/{profile_id}/books/{book_id}/chapters/{chapter_id}", summary="Retrieve in-app bundled chapter content or a structured unavailable-content result")
def get_chapter(profile_id: str, book_id: str, chapter_id: str):
    return _platform(lambda: platform_store.chapter(profile_id, book_id, chapter_id))


@app.get("/api/profiles/{profile_id}/books/{book_id}/reader", summary="Get an in-app bundled-reader status or unavailable-content result")
def get_book_reader_reference(profile_id: str, book_id: str):
    return _platform(lambda: platform_store.reader_reference(profile_id, book_id))


@app.post("/api/profiles/{profile_id}/books/{book_id}/purchases/demo", summary="Record a local-only permanent book ownership transaction")
def purchase_book(profile_id: str, book_id: str):
    return _platform(lambda: platform_store.purchase_book(profile_id, book_id))


@app.get("/api/profiles/{profile_id}/library", summary="List permanent titles and currently subscribed titles")
def get_library(profile_id: str):
    return _platform(lambda: platform_store.library(profile_id))


@app.get("/api/profiles/{profile_id}/recommendations", summary="Return stable book IDs for direct catalog navigation")
def get_recommendations(profile_id: str, limit: int = 6):
    return _platform(lambda: platform_store.recommendations(profile_id, limit))


@app.get("/api/profiles/{profile_id}/books/{book_id}/vocabulary/access", summary="Check vocabulary access")
def check_vocabulary_access(profile_id: str, book_id: str):
    return _platform(lambda: platform_store.book_access(profile_id, book_id, None, "vocabulary"))


@app.get("/api/profiles/{profile_id}/books/{book_id}/vocabulary/{tier}/access", summary="Check basic or advanced vocabulary access")
def check_vocabulary_tier_access(profile_id: str, book_id: str, tier: str):
    return _platform(lambda: platform_store.book_access(profile_id, book_id, tier, "vocabulary"))


@app.get("/api/profiles/{profile_id}/books/{book_id}/quizzes/{difficulty}/access", summary="Check quiz-difficulty access")
def check_quiz_access(profile_id: str, book_id: str, difficulty: str):
    return _platform(lambda: platform_store.book_access(profile_id, book_id, difficulty, "quiz"))


@app.get("/api/profiles/{profile_id}/subscription", summary="Get Free, Basic, or Premium demo entitlement")
def get_subscription(profile_id: str):
    return _platform(lambda: platform_store.subscription(profile_id))


@app.post("/api/profiles/{profile_id}/subscription/demo", summary="Set an explicit local demo entitlement")
def set_demo_entitlement(profile_id: str, payload: dict[str, object]):
    plan = payload.get("plan")
    return _platform(lambda: platform_store.set_demo_entitlement(profile_id, plan if isinstance(plan, str) else "", payload.get("demoEntitlement") is True))


@app.get("/api/profiles/{profile_id}/battle-passes", summary="List Basic and Premium monthly passes")
def list_battle_passes(profile_id: str):
    return _platform(lambda: [platform_store.battle_pass(profile_id, item["id"]) for item in CATALOGS["battlePasses"]])


@app.get("/api/profiles/{profile_id}/battle-passes/{pass_id}", summary="Get pass progress and claim state")
def get_battle_pass(profile_id: str, pass_id: str):
    return _platform(lambda: platform_store.battle_pass(profile_id, pass_id))


@app.post("/api/profiles/{profile_id}/battle-passes/{pass_id}/progress", summary="Add validated quest progress")
def add_battle_pass_progress(profile_id: str, pass_id: str, payload: dict[str, object]):
    return _platform(lambda: platform_store.add_battle_pass_progress(profile_id, pass_id, payload.get("amount"), payload.get("source")))


@app.post("/api/profiles/{profile_id}/battle-passes/{pass_id}/rewards/{reward_id}/claim", summary="Claim an unlocked pass reward once")
def claim_battle_pass_reward(profile_id: str, pass_id: str, reward_id: str):
    return _platform(lambda: platform_store.claim_battle_pass_reward(profile_id, pass_id, reward_id))


@app.get("/api/profiles/{profile_id}/ads/{placement_id}", summary="Get a non-targeted safe promotional placement")
def get_ad_placement(profile_id: str, placement_id: str):
    return _platform(lambda: platform_store.ad_placement(profile_id, placement_id))


@app.post("/api/profiles/{profile_id}/analytics", status_code=201, summary="Record an approved anonymous product event")
def record_analytics(profile_id: str, payload: dict[str, object]):
    event_type = payload.get("eventType")
    properties = payload.get("properties", {})
    return _platform(lambda: platform_store.record_event(profile_id, event_type if isinstance(event_type, str) else "", properties if isinstance(properties, dict) else {}))
