"""Build the metadata-only Gutenberg reference catalog from its offline CSV.

This is an authoring utility, not an application runtime downloader.  Download
the CSV through Project Gutenberg's documented offline-catalog channel, then
run this script with ``--input``.  It deliberately stores neither eBook text
nor inferred chapter boundaries.  The resulting metadata labels titles as
reference-only until a reviewer clears a specific edition for reuse.
"""

from __future__ import annotations

import argparse
import csv
import gzip
import json
from pathlib import Path
import re


ROOT = Path(__file__).resolve().parents[2]
DEFAULT_OUTPUT = ROOT / "backend" / "data" / "books" / "catalog.json"
METADATA_URL = "https://www.gutenberg.org/ebooks/offline_catalogs.html"
TERMS_URL = "https://www.gutenberg.org/policy/terms_of_use"
LICENSE_URL = "https://www.gutenberg.org/policy/license"
ROBOT_GUIDANCE_URL = "https://www.gutenberg.org/policy/robot_access.html"


def slug(value: str, number: str) -> str:
    compact = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return f"gutenberg-{number}-{compact[:48] or 'untitled'}"


def category_for(subjects: str, shelves: str, number: str) -> str:
    text = f"{subjects}; {shelves}".lower()
    rules = (
        ("Fantasy and folklore", ("fairy", "folklore", "myth", "fantasy", "legend")),
        ("Adventure", ("adventure", "travel", "sea stories", "pirates")),
        ("Mystery", ("mystery", "detective", "crime")),
        ("Science and nature", ("science", "nature", "animals", "plants", "astronomy")),
        ("History and biography", ("history", "biography", "historical")),
        ("Poetry and drama", ("poetry", "drama", "plays")),
    )
    for category, terms in rules:
        if any(term in text for term in terms):
            return category
    fallback = ("Classic fiction", "Family stories", "Humor", "World tales")
    return fallback[int(number) % len(fallback)]


def difficulty_for(subjects: str) -> tuple[str, float]:
    text = subjects.lower()
    if any(term in text for term in ("juvenile", "children", "fairy tales")):
        return "Grades 4-6", 4.0
    return "Grades 6-8", 3.5


def catalog_record(row: dict[str, str]) -> dict[str, object]:
    number = row["Text#"].strip()
    title = " ".join(row["Title"].split())
    authors = " ".join(row["Authors"].split()) or "Author not normalized in source catalog"
    difficulty, stars = difficulty_for(row["Subjects"])
    landing_url = f"https://www.gutenberg.org/ebooks/{number}"
    return {
        "id": slug(title, number),
        "title": title,
        "author": authors,
        "edition": f"Project Gutenberg eBook #{number}; source print edition not normalized in offline catalog",
        "editionStatus": "source-print-edition-not-yet-verified",
        "category": category_for(row["Subjects"], row["Bookshelves"], number),
        "difficultyLabel": difficulty,
        "starRating": stars,
        "ratingBasis": "LitLearn editorial starter rating; not an aggregated reader rating.",
        "sourceUrl": landing_url,
        "chapterBoundaryStatus": "not-extracted",
        "chapterMetadata": [],
        "source": {
            "provider": "Project Gutenberg",
            "ebookId": number,
            "landingUrl": landing_url,
            "metadataUrl": METADATA_URL,
            "downloadGuidance": (
                "Use Project Gutenberg's offline catalog or documented robot guidance for authoring downloads; "
                "do not scrape this record at reader runtime."
            ),
        },
        "rights": {
            "status": "reference-only-unreviewed",
            "textReuseCleared": False,
            "territory": "United States only until a work-specific review confirms other territories.",
            "license": "Project Gutenberg's License and Terms of Use govern its eBook files and trademark; this record contains metadata only.",
            "requiredAttribution": f"{authors}, {title}. Project Gutenberg eBook #{number}; link to {landing_url}.",
            "basis": (
                "Catalog metadata was obtained via Project Gutenberg's published offline catalog. "
                "No book text is bundled and this entry does not assert reuse clearance for a specific print edition."
            ),
            "termsUrl": TERMS_URL,
            "licenseUrl": LICENSE_URL,
            "robotGuidanceUrl": ROBOT_GUIDANCE_URL,
        },
        "accessRules": {
            "mode": "subscription",
            "freeLevelRange": [1, 10],
            "freeChapterIds": [],
            "subscriptionEligible": True,
            "permanentPurchaseEligible": False,
            "publicSourceAvailable": True,
            "premiumNote": "Premium unlocks LitLearn reading levels and tools, never the public Project Gutenberg source itself.",
        },
    }


def select_rows(input_path: Path, count: int) -> list[dict[str, str]]:
    opener = gzip.open if input_path.suffix == ".gz" else open
    with opener(input_path, "rt", encoding="utf-8", newline="") as handle:
        rows = list(csv.DictReader(handle))
    selected: list[dict[str, str]] = []
    seen_titles: set[str] = set()
    suitable_subject_terms = (
        "children", "juvenile", "adventure", "fairy", "fantasy", "mystery fiction",
        "animals", "school stories", "family", "sea stories", "travel", "historical fiction",
        "science fiction", "nature", "folklore", "legends", "tales",
    )
    unsuitable_title_terms = (
        "bible", "constitution", "declaration", "inaugural", "address", "federalist",
        "factbook", "book of mormon", "paradise lost",
    )
    excluded_ids = {"55", "17396"}
    for row in rows:
        if row.get("Type") != "Text" or row.get("Language") != "en":
            continue
        title = " ".join(row.get("Title", "").split())
        discovery = f"{row.get('Subjects', '')}; {row.get('Bookshelves', '')}".lower()
        if (
            not title
            or not row.get("Text#", "").isdigit()
            or row["Text#"] in excluded_ids
            or not any(term in discovery for term in suitable_subject_terms)
            or any(term in title.lower() for term in unsuitable_title_terms)
        ):
            continue
        if title.lower() in seen_titles:
            continue
        seen_titles.add(title.lower())
        selected.append(row)
        if len(selected) == count:
            return selected
    raise ValueError(f"Only found {len(selected)} English catalog records; expected {count}.")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--count", type=int, default=100)
    args = parser.parse_args()
    rows = select_rows(args.input, args.count)
    catalog = {
        "schemaVersion": 1,
        "generatedFrom": METADATA_URL,
        "generationPolicy": "Metadata-only reference entries; do not treat these records as book-text clearance.",
        "books": [catalog_record(row) for row in rows],
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(catalog, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
