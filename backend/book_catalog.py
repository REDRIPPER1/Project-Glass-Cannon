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
VALID_ACCESS_MODES = frozenset({"free", "subscription", "purchase-only"})
VALID_CONTENT_MODES = frozenset({"external-reference", "quest-passage-reference", "unavailable"})


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
        for field in ("provider", "landingUrl", "metadataUrl", "downloadGuidance"):
            _text(source.get(field), f"Book {book_id}.source.{field}")
        rights = _object(book.get("rights"), f"Book {book_id}.rights")
        for field in ("status", "territory", "license", "requiredAttribution", "basis"):
            _text(rights.get(field), f"Book {book_id}.rights.{field}")
        if not isinstance(rights.get("textReuseCleared"), bool):
            raise BookCatalogError(f"Book {book_id}.rights.textReuseCleared must be boolean")

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
        for chapter in item["chapterMetadata"]:
            chapter["accessTier"] = (
                "free-demo" if chapter["id"] in item["accessRules"]["freeChapterIds"]
                else "premium"
            )
        result[item["id"]] = item
    return result
