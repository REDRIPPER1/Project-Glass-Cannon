"""Metadata-only book catalog and exact quest-to-source mappings.

This module intentionally never stores or returns a third-party book's full
text.  A catalog record may point to a public source, a reviewed backend cache,
or an explicitly unavailable chapter.  That distinction keeps a source link
from being mistaken for a distribution or reuse clearance.
"""

from __future__ import annotations

from copy import deepcopy
import json
from pathlib import Path
from typing import Any


BOOK_CATALOG_PATH = Path(__file__).resolve().parent / "data" / "books" / "catalog.json"
REVIEWED_BOOKS_PATH = Path(__file__).resolve().parent / "data" / "books" / "reviewed-books.json"
QUEST_MAPPING_PATH = Path(__file__).resolve().parent / "data" / "books" / "quest-mappings.json"
BOOK_QUIZZES_PATH = Path(__file__).resolve().parent / "data" / "books" / "book-quizzes.json"
DATA_DIRECTORY = Path(__file__).resolve().parent / "data"
VALID_ACCESS_MODES = frozenset({"free", "subscription", "purchase-only"})
VALID_CONTENT_MODES = frozenset({"quest-passage-reference", "unavailable"})
VALID_ACTIVITY_TYPES = frozenset(
    {
        "story-quest",
        "character-map",
        "chapter-choice",
        "evidence-collection",
        "scene-reconstruction",
        "vocabulary-in-context",
        "creative-response",
        "book-world-map",
    }
)
VALID_ACTIVITY_REVIEW_STATUSES = frozenset({"reviewed", "draft", "generated-unreviewed"})


class BookCatalogError(ValueError):
    """Raised when catalog metadata is incomplete or would overstate access."""


def _object(value: object, context: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise BookCatalogError(f"{context} must be an object")
    return value


def _text(value: object, context: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise BookCatalogError(f"{context} must be a non-empty string")
    return value


def _rows(value: object, context: str) -> list[dict[str, Any]]:
    if not isinstance(value, list):
        raise BookCatalogError(f"{context} must be a list")
    return [_object(row, context) for row in value]


def _unique(rows: list[dict[str, Any]], context: str) -> set[str]:
    ids: set[str] = set()
    for row in rows:
        item_id = _text(row.get("id"), f"{context} id")
        if item_id in ids:
            raise BookCatalogError(f"{context} has duplicate id '{item_id}'")
        ids.add(item_id)
    return ids


def validate_book_catalog(value: object) -> dict[str, Any]:
    catalog = _object(value, "Book catalog")
    if catalog.get("schemaVersion") != 1:
        raise BookCatalogError("Book catalog schemaVersion must be 1")
    books = _rows(catalog.get("books"), "Book catalog books")
    if len(books) < 100:
        raise BookCatalogError("Book catalog must contain at least 100 books")
    _unique(books, "Book catalog books")

    for book in books:
        book_id = _text(book.get("id"), "Book id")
        for field in ("title", "author", "edition", "category", "difficultyLabel", "sourceUrl"):
            _text(book.get(field), f"Book {book_id}.{field}")
        if not isinstance(book.get("starRating"), (int, float)) or not 0 <= book["starRating"] <= 5:
            raise BookCatalogError(f"Book {book_id}.starRating must be between 0 and 5")
        if not isinstance(book.get("chapterMetadata"), list):
            raise BookCatalogError(f"Book {book_id}.chapterMetadata must be a list")
        if book.get("chapterBoundaryStatus") not in {"verified", "not-extracted", "not-applicable"}:
            raise BookCatalogError(f"Book {book_id} has an invalid chapterBoundaryStatus")
        chapters = _rows(book["chapterMetadata"], f"Book {book_id} chapterMetadata")
        _unique(chapters, f"Book {book_id} chapterMetadata")
        if book["chapterBoundaryStatus"] != "verified" and chapters:
            raise BookCatalogError(
                f"Book {book_id} may not expose chapter boundaries before they are verified"
            )
        for chapter in chapters:
            for field in ("id", "title", "sourceUrl", "contentMode"):
                _text(chapter.get(field), f"Book {book_id} chapter.{field}")
            if chapter["contentMode"] not in VALID_CONTENT_MODES:
                raise BookCatalogError(f"Book {book_id} chapter has an invalid contentMode")

        source = _object(book.get("source"), f"Book {book_id}.source")
        for field in (
            "provider",
            "landingUrl",
            "metadataUrl",
            "downloadGuidance",
            "ebookLicenseReviewStatus",
        ):
            _text(source.get(field), f"Book {book_id}.source.{field}")
        if source["provider"] != "Project Gutenberg":
            raise BookCatalogError(f"Book {book_id} must use Project Gutenberg as its source provider")
        _text(source.get("ebookId"), f"Book {book_id}.source.ebookId")
        if source.get("accessedAt") is not None and (
            not isinstance(source["accessedAt"], str) or len(source["accessedAt"]) != 10
        ):
            raise BookCatalogError(f"Book {book_id}.source.accessedAt must be an ISO date or null")
        if source["ebookLicenseReviewStatus"] not in {"reviewed", "review-needed"}:
            raise BookCatalogError(f"Book {book_id}.source.ebookLicenseReviewStatus is invalid")
        rights = _object(book.get("rights"), f"Book {book_id}.rights")
        for field in (
            "status",
            "territory",
            "license",
            "requiredAttribution",
            "basis",
            "usCopyrightStatus",
            "worldwideCopyrightStatus",
        ):
            _text(rights.get(field), f"Book {book_id}.rights.{field}")
        if not isinstance(rights.get("textReuseCleared"), bool):
            raise BookCatalogError(f"Book {book_id}.rights.textReuseCleared must be boolean")
        if rights["textReuseCleared"] and (
            source.get("accessedAt") is None or source["ebookLicenseReviewStatus"] != "reviewed"
        ):
            raise BookCatalogError(
                f"Book {book_id} may not clear text reuse without an access date and reviewed ebook license"
            )

        access = _object(book.get("accessRules"), f"Book {book_id}.accessRules")
        if access.get("mode") not in VALID_ACCESS_MODES:
            raise BookCatalogError(f"Book {book_id} has an invalid access mode")
        if not isinstance(access.get("freeLevelRange"), list) or len(access["freeLevelRange"]) != 2:
            raise BookCatalogError(f"Book {book_id} must declare a two-value freeLevelRange")
        if not all(isinstance(level, int) and level > 0 for level in access["freeLevelRange"]):
            raise BookCatalogError(f"Book {book_id} has an invalid freeLevelRange")
        if not isinstance(access.get("freeChapterIds"), list) or not all(
            isinstance(chapter_id, str) for chapter_id in access["freeChapterIds"]
        ):
            raise BookCatalogError(f"Book {book_id} has invalid freeChapterIds")
        if not isinstance(access.get("subscriptionEligible"), bool) or not isinstance(
            access.get("permanentPurchaseEligible"), bool
        ):
            raise BookCatalogError(f"Book {book_id} must declare subscription and purchase eligibility")
        if access["mode"] == "purchase-only" and access["subscriptionEligible"]:
            raise BookCatalogError(f"Purchase-only book {book_id} cannot be subscription eligible")
        offer = book.get("mockPurchase")
        if offer is not None:
            offer = _object(offer, f"Book {book_id}.mockPurchase")
            if offer.get("currency") != "diamonds" or not isinstance(offer.get("price"), int) or offer["price"] < 0:
                raise BookCatalogError(f"Book {book_id}.mockPurchase must use a non-negative Diamond price")
    return catalog


def load_book_catalog(
    path: Path = BOOK_CATALOG_PATH, reviewed_path: Path = REVIEWED_BOOKS_PATH
) -> dict[str, Any]:
    try:
        with path.open(encoding="utf-8") as handle:
            generated = _object(json.load(handle), "Generated book catalog")
        with reviewed_path.open(encoding="utf-8") as handle:
            reviewed = _object(json.load(handle), "Reviewed book catalog")
        if generated.get("schemaVersion") != 1 or reviewed.get("schemaVersion") != 1:
            raise BookCatalogError("Book catalog inputs must use schemaVersion 1")
        combined = {
            "schemaVersion": 1,
            "generatedFrom": generated.get("generatedFrom"),
            "generationPolicy": generated.get("generationPolicy"),
            "books": generated.get("books", []) + reviewed.get("books", []),
        }
        return deepcopy(validate_book_catalog(combined))
    except (OSError, json.JSONDecodeError) as error:
        raise BookCatalogError(f"Could not load book catalog from {path.name}") from error


def validate_quest_mappings(value: object, book_ids: set[str]) -> dict[str, Any]:
    mapping_file = _object(value, "Quest mapping file")
    if mapping_file.get("schemaVersion") != 1:
        raise BookCatalogError("Quest mapping schemaVersion must be 1")
    mappings = _rows(mapping_file.get("mappings"), "Quest mappings")
    _unique(mappings, "Quest mappings")
    for mapping in mappings:
        quest_id = _text(mapping.get("id"), "Quest mapping id")
        if _text(mapping.get("bookId"), f"Quest mapping {quest_id}.bookId") not in book_ids:
            raise BookCatalogError(f"Quest mapping {quest_id} references an unknown book")
        for field in ("edition", "mappingBasis"):
            _text(mapping.get(field), f"Quest mapping {quest_id}.{field}")
        chapter_ids = mapping.get("chapterIds")
        if not isinstance(chapter_ids, list) or not all(isinstance(item, str) for item in chapter_ids):
            raise BookCatalogError(f"Quest mapping {quest_id}.chapterIds must be a string list")
        passage_reference = _object(mapping.get("passageReference"), f"Quest mapping {quest_id}.passageReference")
        for field in ("mode", "location"):
            _text(passage_reference.get(field), f"Quest mapping {quest_id}.passageReference.{field}")
    return mapping_file


def load_quest_mappings(
    path: Path = QUEST_MAPPING_PATH, catalog: dict[str, Any] | None = None
) -> dict[str, Any]:
    catalog = catalog or load_book_catalog()
    try:
        with path.open(encoding="utf-8") as handle:
            return deepcopy(
                validate_quest_mappings(
                    json.load(handle), {book["id"] for book in catalog["books"]}
                )
            )
    except (OSError, json.JSONDecodeError) as error:
        raise BookCatalogError(f"Could not load quest mappings from {path.name}") from error


def validate_book_quizzes(value: object, catalog: dict[str, Any] | None = None) -> dict[str, Any]:
    quiz_file = _object(value, "Book quiz file")
    if quiz_file.get("schemaVersion") != 1:
        raise BookCatalogError("Book quiz file schemaVersion must be 1")
    quizzes = _rows(quiz_file.get("quizzes"), "Book quizzes")
    _unique(quizzes, "Book quizzes")
    catalog = catalog or load_book_catalog()
    books_by_id = {book["id"]: book for book in catalog["books"]}
    mappings_by_id = {
        mapping["id"]: mapping
        for mapping in load_quest_mappings(catalog=catalog)["mappings"]
    }
    for quiz in quizzes:
        quiz_id = _text(quiz.get("id"), "Book quiz id")
        book_id = _text(quiz.get("bookId"), f"Book quiz {quiz_id}.bookId")
        book = books_by_id.get(book_id)
        if book is None:
            raise BookCatalogError(f"Book quiz {quiz_id} references an unknown book")
        for field in (
            "edition",
            "questId",
            "targetSkill",
            "reviewStatus",
            "mappingBasis",
            "sourceLabel",
            "activityType",
        ):
            _text(quiz.get(field), f"Book quiz {quiz_id}.{field}")
        chapter_ids = quiz.get("chapterIds")
        if not isinstance(chapter_ids, list) or not chapter_ids:
            raise BookCatalogError(f"Book quiz {quiz_id}.chapterIds must be a non-empty list")
        known_chapter_ids = {chapter["id"] for chapter in book["chapterMetadata"]}
        if not set(chapter_ids).issubset(known_chapter_ids):
            raise BookCatalogError(f"Book quiz {quiz_id} references an unknown chapter")
        if quiz.get("accessTier") not in {"basic", "advanced"}:
            raise BookCatalogError(f"Book quiz {quiz_id} has an invalid accessTier")
        if quiz["activityType"] not in VALID_ACTIVITY_TYPES:
            raise BookCatalogError(f"Book quiz {quiz_id} has an unsupported activityType")
        if quiz["reviewStatus"] not in VALID_ACTIVITY_REVIEW_STATUSES:
            raise BookCatalogError(f"Book quiz {quiz_id} has an invalid reviewStatus")
        mapping = mappings_by_id.get(quiz["questId"])
        if mapping is None:
            raise BookCatalogError(f"Book quiz {quiz_id} must reference an exact quest mapping")
        if (
            mapping["bookId"] != book_id
            or mapping["edition"] != quiz["edition"]
            or mapping["chapterIds"] != chapter_ids
        ):
            raise BookCatalogError(
                f"Book quiz {quiz_id} must match its quest mapping's book, edition, and chapters"
            )
    return quiz_file


def load_book_quizzes(
    path: Path = BOOK_QUIZZES_PATH, catalog: dict[str, Any] | None = None
) -> dict[str, Any]:
    catalog = catalog or load_book_catalog()
    try:
        with path.open(encoding="utf-8") as handle:
            return deepcopy(validate_book_quizzes(json.load(handle), catalog))
    except (OSError, json.JSONDecodeError) as error:
        raise BookCatalogError(f"Could not load book quizzes from {path.name}") from error


def bundled_passage_for_chapter(
    book_id: str, chapter_id: str, catalog: dict[str, Any] | None = None
) -> list[dict[str, str]] | None:
    """Return only a reviewed, already-bundled passage for in-app reading.

    A catalog source URL is never a substitute for bundled content.  This
    function deliberately resolves only the reviewed quest JSON files named in
    the exact mapping contract and returns no answer keys or question data.
    """
    catalog = catalog or load_book_catalog()
    mapping = next(
        (
            item
            for item in load_quest_mappings(catalog=catalog)["mappings"]
            if item["bookId"] == book_id and chapter_id in item["chapterIds"]
        ),
        None,
    )
    if mapping is None or mapping["passageReference"].get("mode") != "bundled-quest":
        return None
    location = mapping["passageReference"]["location"]
    candidate = (Path(__file__).resolve().parent.parent / location).resolve()
    if DATA_DIRECTORY not in candidate.parents or candidate.suffix != ".json":
        raise BookCatalogError("Quest passage mapping points outside reviewed bundled data")
    try:
        with candidate.open(encoding="utf-8") as handle:
            quest = _object(json.load(handle), "Bundled quest")
    except (OSError, json.JSONDecodeError) as error:
        raise BookCatalogError("Could not load mapped bundled passage") from error
    passage = _rows(quest.get("passage"), "Bundled quest passage")
    return [
        {"id": _text(sentence.get("id"), "Bundled passage sentence id"), "text": _text(sentence.get("text"), "Bundled passage sentence text")}
        for sentence in passage
    ]


def book_index(catalog: dict[str, Any] | None = None) -> dict[str, dict[str, Any]]:
    catalog = catalog or load_book_catalog()
    result: dict[str, dict[str, Any]] = {}
    for book in catalog["books"]:
        item = deepcopy(book)
        rights_status = item["rights"]["status"]
        item["rightsStatus"] = (
            "original" if rights_status.startswith("original")
            else "verified" if rights_status.startswith("verified")
            else "review-required"
        )
        item["license"] = item["rights"]["license"]
        item["territory"] = item["rights"]["territory"]
        item["requiredAttribution"] = item["rights"]["requiredAttribution"]
        item["readingLevel"] = item["difficultyLabel"]
        item["topic"] = item["category"]
        item["vocabularyLevel"] = "advanced" if "6-8" in item["difficultyLabel"] else "basic"
        item["accessTier"] = "free-demo" if item["accessRules"]["mode"] == "free" else "premium"
        item["purchaseOnly"] = item["accessRules"]["mode"] == "purchase-only"
        offer = item.get("mockPurchase")
        access_state = (
            "purchase-only"
            if item["accessRules"]["mode"] == "purchase-only"
            else "free"
            if item["accessRules"]["mode"] == "free"
            else "premium"
        )
        item["access"] = {"state": access_state}
        if isinstance(offer, dict) and offer.get("currency") == "diamonds":
            item["access"]["priceDiamonds"] = offer.get("price")
        bundled_chapter_ids = {
            chapter_id
            for mapping in load_quest_mappings(catalog=catalog)["mappings"]
            if mapping["bookId"] == item["id"]
            and mapping["passageReference"].get("mode") == "bundled-quest"
            for chapter_id in mapping["chapterIds"]
        }
        item["contentAvailability"] = "bundled-passage" if bundled_chapter_ids else "unavailable"
        for chapter in item["chapterMetadata"]:
            chapter_state = (
                "purchase-only"
                if item["accessRules"]["mode"] == "purchase-only"
                else "free"
                if chapter["id"] in item["accessRules"]["freeChapterIds"] or item["accessRules"]["mode"] == "free"
                else "premium"
            )
            chapter["accessTier"] = "free-demo" if chapter_state == "free" else chapter_state
            chapter["access"] = {"state": chapter_state}
            if chapter_state == "free":
                start, end = item["accessRules"]["freeLevelRange"]
                chapter["readingLevels"] = [
                    {
                        "id": f"{chapter['id']}-levels-{start}-{end}",
                        "label": f"Levels {start}–{end}",
                        "access": "free",
                    }
                ]
            elif chapter_state == "purchase-only":
                chapter["readingLevels"] = [
                    {
                        "id": f"{chapter['id']}-permanent-purchase",
                        "label": "Permanent purchase",
                        "access": "purchase-only",
                    }
                ]
            else:
                chapter["readingLevels"] = [
                    {"id": f"{chapter['id']}-premium", "label": "Premium", "access": "premium"}
                ]
            chapter["contentAvailability"] = (
                "bundled-passage" if chapter["id"] in bundled_chapter_ids else "unavailable"
            )
        result[item["id"]] = item
    return result
