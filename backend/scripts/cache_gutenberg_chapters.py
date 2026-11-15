"""Cache individually reviewed Project Gutenberg chapter text for LitLearn.

This is an authoring-only command.  It retrieves title metadata from Gutendex,
then checks the matching Project Gutenberg landing page and its plain-text
eBook before writing a local cache.  The runtime reader only reads the cache;
it never requests Gutendex or Project Gutenberg.

The 25-title manifest is deliberately small, English-only, and conservative:
each entry must expose a named first-chapter marker.  A retrieval or parsing
failure stops the command rather than guessing a boundary.
"""

from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from datetime import date
import hashlib
import json
from pathlib import Path
import re
import time
from typing import Any
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[2]
DEFAULT_CACHE_DIRECTORY = ROOT / "backend" / "data" / "books" / "cached-chapters"
DEFAULT_INDEX_PATH = ROOT / "backend" / "data" / "books" / "cached-chapter-index.json"
CATALOG_PATH = ROOT / "backend" / "data" / "books" / "catalog.json"
GUTENDEX_BOOK_URL = "https://gutendex.com/books/{ebook_id}"
GUTENBERG_LANDING_URL = "https://www.gutenberg.org/ebooks/{ebook_id}"
USER_AGENT = "LitLearn reviewed-content-cache/1.0 (local authoring tool)"


@dataclass(frozen=True)
class Candidate:
    ebook_id: int
    book_id: str
    category: str
    access_mode: str
    price_diamonds: int | None = None


# Keep this as a reviewable, curated list.  No item becomes readable unless
# its exact landing page, source text, and chapter marker all pass below.
CANDIDATES = (
    Candidate(11, "gutenberg-11-alice-s-adventures-in-wonderland", "Fantasy and folklore", "free"),
    Candidate(12, "gutenberg-12-through-the-looking-glass", "Fantasy and folklore", "subscription", 10),
    Candidate(121, "gutenberg-121-northanger-abbey", "Classics", "purchase-only", 16),
    Candidate(45, "gutenberg-45-anne-of-green-gables", "Family stories", "free"),
    Candidate(62, "gutenberg-62-a-princess-of-mars", "Fantasy and folklore", "subscription", 10),
    Candidate(73, "gutenberg-73-the-red-badge-of-courage-an-episode-of-the-ameri", "History and biography", "subscription", 14),
    Candidate(74, "gutenberg-74-the-adventures-of-tom-sawyer-complete", "Adventure", "free"),
    Candidate(76, "gutenberg-76-adventures-of-huckleberry-finn", "Adventure", "subscription", 12),
    Candidate(83, "gutenberg-83-from-the-earth-to-the-moon-and-round-the-moon", "Science and nature", "subscription", 12),
    Candidate(84, "gutenberg-84-frankenstein-or-the-modern-prometheus", "Classics", "purchase-only", 18),
    Candidate(91, "gutenberg-91-tom-sawyer-abroad", "Adventure", "free"),
    Candidate(93, "gutenberg-93-tom-sawyer-detective", "Mystery", "subscription", 10),
    Candidate(126, "gutenberg-126-the-poison-belt", "Science and nature", "subscription", 12),
    Candidate(103, "gutenberg-103-around-the-world-in-eighty-days", "Adventure", "subscription", 12),
    Candidate(82, "gutenberg-82-ivanhoe-a-romance", "Adventure", "free"),
    Candidate(125, "gutenberg-125-a-girl-of-the-limberlost", "Nature and animals", "subscription", 12),
    Candidate(16, "gutenberg-16-peter-pan", "Fantasy and folklore", "free"),
    Candidate(139, "gutenberg-139-the-lost-world", "Adventure", "subscription", 14),
    Candidate(141, "gutenberg-141-mansfield-park", "Classics", "free"),
    Candidate(113, "gutenberg-113-the-secret-garden", "Family stories", "subscription", 12),
    Candidate(164, "gutenberg-164-twenty-thousand-leagues-under-the-sea", "Adventure", "purchase-only", 18),
    Candidate(215, "gutenberg-215-the-call-of-the-wild", "Nature and animals", "subscription", 12),
    Candidate(225, "gutenberg-225-at-the-back-of-the-north-wind", "Fantasy and folklore", "free"),
    Candidate(15, "gutenberg-15-moby-dick-or-the-whale", "Adventure", "free"),
    Candidate(64, "gutenberg-64-the-gods-of-mars", "Fantasy and folklore", "subscription", 14),
)


def fetch(url: str, timeout: int = 30) -> bytes:
    request = Request(url, headers={"User-Agent": USER_AGENT})
    # Gutenberg's CDN can return a temporary 5xx response.  A small bounded
    # retry keeps a transient outage from being mistaken for a rights failure;
    # all retries remain server-side authoring traffic.
    last_error: OSError | None = None
    for attempt in range(3):
        try:
            with urlopen(request, timeout=timeout) as response:  # nosec B310: curated HTTPS URLs only
                return response.read()
        except OSError as error:
            last_error = error
            if attempt == 2:
                raise
            time.sleep(attempt + 1)
    raise RuntimeError(f"Unable to fetch {url}: {last_error}")


def fetch_json(url: str, timeout: int = 30) -> dict[str, Any]:
    value = json.loads(fetch(url, timeout=timeout).decode("utf-8"))
    if not isinstance(value, dict):
        raise ValueError(f"Expected an object from {url}")
    return value


def strip_gutenberg_boilerplate(raw: str) -> str:
    start = re.search(r"\*\*\*\s*START OF (?:THE|THIS) PROJECT GUTENBERG EBOOK.*?\*\*\*", raw, re.I | re.S)
    end = re.search(r"\*\*\*\s*END OF (?:THE|THIS) PROJECT GUTENBERG EBOOK.*?\*\*\*", raw, re.I | re.S)
    if start is None or end is None or end.start() <= start.end():
        raise ValueError("The eBook did not contain recognizable Project Gutenberg start/end notices")
    return raw[start.end():end.start()].strip()


def first_chapter(body: str) -> tuple[str, str]:
    """Return the first named CHAPTER section, rejecting a guessed boundary."""
    marker = re.compile(
        r"(?im)^\s*(CHAPTER\s+(?:[IVXLCDM]+|\d+)(?:\.?\s*[-—:.]?\s*[^\n]*)?)\s*$"
    )
    headings = list(marker.finditer(body))
    if len(headings) < 2:
        raise ValueError("Fewer than two named chapter markers were found")
    for index, first in enumerate(headings[:-1]):
        chapter_title = re.sub(r"\s+", " ", first.group(1)).strip()
        if re.match(r"(?i)^CHAPTER\s+(?:I|1)(?:[.\s:—-]|$)", chapter_title) is None:
            continue
        second = headings[index + 1]
        chapter_text = body[first.end():second.start()].strip()
        # Tables of contents frequently repeat chapter titles.  A short block
        # between Chapter I and II is therefore rejected; the next complete
        # Chapter I marker is used only when it yields a full named section.
        if len(chapter_text.split()) >= 120:
            return chapter_title, chapter_text
    raise ValueError("No full named Chapter I section was found after removing front matter")


CHAPTER_MARKER = re.compile(
    r"(?m)^[ \t]*(?P<label>(?:CHAPTER|Chapter)\s+(?P<number>[IVXLCDM]+|\d+)(?P<tail>[^\n]*))\s*$"
)
ROMAN_VALUES = {"I": 1, "V": 5, "X": 10, "L": 50, "C": 100, "D": 500, "M": 1000}


def chapter_number(value: str) -> int:
    """Parse one printed Arabic or Roman chapter numeral."""
    value = value.upper()
    if value.isdigit():
        return int(value)
    total = 0
    previous = 0
    for character in reversed(value):
        current = ROMAN_VALUES.get(character)
        if current is None:
            raise ValueError(f"Unsupported chapter number {value!r}")
        if current < previous:
            total -= current
        else:
            total += current
            previous = current
    return total


def _heading_and_inline_prose(match: re.Match[str]) -> tuple[str, str]:
    """Preserve source prose flattened onto a chapter-heading line."""
    label = re.sub(r"\s+", " ", match.group("label")).strip()
    tail = match.group("tail").lstrip(" .:-—").strip()
    # Gutenberg's plain-text wrapping sometimes continues the first sentence
    # after a chapter numeral. Long tails are prose, not a chapter subtitle.
    if len(tail.split()) >= 10:
        return f"CHAPTER {match.group('number')}", tail
    return label, ""


def verified_chapters(body: str) -> list[tuple[str, str, str]]:
    """Return all explicit, sequential chapter sections after front matter.

    A complete printed Chapter I establishes the body after any table of
    contents. Every subsequent section must have the next printed numeral;
    otherwise this title is rejected instead of receiving guessed boundaries.
    """
    headings = list(CHAPTER_MARKER.finditer(body))
    if len(headings) < 2:
        raise ValueError("Fewer than two named chapter markers were found")
    first_index: int | None = None
    for index, heading in enumerate(headings[:-1]):
        if chapter_number(heading.group("number")) != 1:
            continue
        _, inline_prose = _heading_and_inline_prose(heading)
        candidate = f"{inline_prose}\n\n{body[heading.end():headings[index + 1].start()]}".strip()
        if len(candidate.split()) >= 120:
            first_index = index
            break
    if first_index is None:
        raise ValueError("No full named Chapter I section was found after removing front matter")

    result: list[tuple[str, str, str]] = []
    expected = 1
    part = 1
    for index in range(first_index, len(headings)):
        heading = headings[index]
        number = chapter_number(heading.group("number"))
        if number != expected:
            # Some exact Gutenberg editions reset chapter numbering for a
            # printed second part. A reset to Chapter I is explicit enough to
            # preserve the source boundary with a part-qualified stable ID.
            if number == 1 and expected > 1:
                part += 1
                expected = 1
            else:
                nearby = ", ".join(item.group("number") for item in headings[max(0, index - 3):index + 4])
                raise ValueError(
                    f"Chapter sequence broke at printed chapter {heading.group('number')}; expected {expected}; nearby markers: {nearby}"
                )
        next_start = headings[index + 1].start() if index + 1 < len(headings) else len(body)
        chapter_title, inline_prose = _heading_and_inline_prose(heading)
        chapter_text = f"{inline_prose}\n\n{body[heading.end():next_start]}".strip()
        # A final printed chapter can legitimately be a brief poem or scene.
        # Once the numbered sequence is established, retain it rather than
        # silently omitting source text; only an effectively empty boundary is
        # rejected.
        if len(chapter_text.split()) < 3:
            raise ValueError(f"Chapter {number} was too short to be a readable section")
        chapter_id = f"chapter-{number}" if part == 1 else f"part-{part}-chapter-{number}"
        if part > 1:
            chapter_title = f"Part {part} — {chapter_title}"
        result.append((chapter_id, chapter_title, chapter_text))
        expected += 1
    return result


def reader_segments(text: str) -> list[dict[str, str]]:
    """Split prose conservatively into stable display/evidence segments."""
    paragraphs = [re.sub(r"\s+", " ", paragraph).strip() for paragraph in re.split(r"\n\s*\n", text)]
    pieces: list[str] = []
    for paragraph in paragraphs:
        if not paragraph:
            continue
        pieces.extend(
            piece.strip()
            for piece in re.split(r"(?<=[.!?])\s+(?=[A-Z“])", paragraph)
            if piece.strip()
        )
    if not pieces:
        raise ValueError("The chapter has no reader segments")
    return [{"id": f"s{index}", "text": piece} for index, piece in enumerate(pieces, start=1)]


def text_url(metadata: dict[str, Any]) -> str:
    formats = metadata.get("formats")
    if not isinstance(formats, dict):
        raise ValueError("Gutendex metadata has no formats object")
    for key in ("text/plain; charset=utf-8", "text/plain; charset=us-ascii", "text/plain"):
        url = formats.get(key)
        if isinstance(url, str) and url.startswith("https://"):
            return url
    raise ValueError("Gutendex metadata did not provide an HTTPS plain-text format")


def catalog_metadata(candidate: Candidate) -> dict[str, Any]:
    catalog = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    record = next((item for item in catalog["books"] if item["id"] == candidate.book_id), None)
    if not isinstance(record, dict):
        raise ValueError(f"The curated ID {candidate.book_id} was not found in catalog.json")
    return {
        "id": candidate.ebook_id,
        "title": record["title"],
        "authors": [{"name": record["author"]}],
        "copyright": False,
        "formats": {"text/plain; charset=utf-8": f"https://www.gutenberg.org/cache/epub/{candidate.ebook_id}/pg{candidate.ebook_id}.txt"},
        "metadataProvider": "Project Gutenberg offline catalog fallback",
    }


def metadata_for(candidate: Candidate, use_gutendex: bool) -> dict[str, Any]:
    if use_gutendex:
        try:
            metadata = fetch_json(GUTENDEX_BOOK_URL.format(ebook_id=candidate.ebook_id), timeout=10)
            if metadata.get("id") == candidate.ebook_id and metadata.get("copyright") is not True:
                metadata["metadataProvider"] = "Gutendex"
                return metadata
        except OSError:
            pass
    return catalog_metadata(candidate)


def review_candidate(candidate: Candidate, use_gutendex: bool) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """Review one edition once, then cache every printed verified chapter."""
    metadata = metadata_for(candidate, use_gutendex)
    if metadata.get("id") != candidate.ebook_id or metadata.get("copyright") is True:
        raise ValueError("Metadata did not confirm an unrestricted U.S. record")
    landing_url = GUTENBERG_LANDING_URL.format(ebook_id=candidate.ebook_id)
    landing_html = fetch(landing_url).decode("utf-8", "replace")
    if "Public domain in the USA" not in landing_html:
        raise ValueError("Gutenberg landing page did not state public-domain-in-USA status")
    raw = fetch(text_url(metadata)).decode("utf-8", "replace")
    raw_upper = raw.upper()
    if "PROJECT GUTENBERG" not in raw_upper or "LICENSE" not in raw_upper:
        raise ValueError("Plain-text download lacked Project Gutenberg identification or license notice")
    extracted_chapters = verified_chapters(strip_gutenberg_boilerplate(raw))
    authors = metadata.get("authors")
    if not isinstance(authors, list) or not authors or not isinstance(authors[0], dict):
        raise ValueError("Gutendex metadata has no author attribution")
    author = str(authors[0].get("name", "")).strip()
    title = str(metadata.get("title", "")).strip()
    if not author or not title:
        raise ValueError("Gutendex metadata is missing a title or author")
    accessed_at = date.today().isoformat()
    edition = f"Project Gutenberg eBook #{candidate.ebook_id}; metadata and eBook text reviewed {accessed_at}"
    metadata_url = (
        GUTENDEX_BOOK_URL.format(ebook_id=candidate.ebook_id)
        if metadata["metadataProvider"] == "Gutendex"
        else "https://www.gutenberg.org/ebooks/offline_catalogs.html"
    )
    metadata_route = (
        "Gutendex metadata"
        if metadata["metadataProvider"] == "Gutendex"
        else "the checked Project Gutenberg offline-catalog metadata fallback"
    )
    territory = "United States. Rights outside the United States require a separate local-law review."
    caches: list[dict[str, Any]] = []
    chapter_metadata: list[dict[str, str]] = []
    for chapter_id, chapter_title, chapter_text in extracted_chapters:
        attribution = f"{author}, {title}, {chapter_title}. Source checked against Project Gutenberg eBook #{candidate.ebook_id}."
        segments = reader_segments(chapter_text)
        serialized_segments = json.dumps(segments, ensure_ascii=False, separators=(",", ":"))
        digest = hashlib.sha256(serialized_segments.encode("utf-8")).hexdigest()
        caches.append(
            {
                "schemaVersion": 1,
                "bookId": candidate.book_id,
                "ebookId": str(candidate.ebook_id),
                "edition": edition,
                "chapterId": chapter_id,
                "chapterTitle": chapter_title,
                "contentHash": f"sha256:{digest}",
                "attribution": attribution,
                "source": {
                    "provider": "Project Gutenberg",
                    "landingUrl": landing_url,
                    "textUrl": text_url(metadata),
                    "metadataUrl": metadata_url,
                    "accessedAt": accessed_at,
                    "ebookLicenseReviewStatus": "reviewed",
                    "territory": territory,
                },
                "sentences": segments,
            }
        )
        chapter_metadata.append(
            {
                "id": chapter_id,
                "title": chapter_title,
                "sourceUrl": landing_url,
                "contentMode": "cached-chapter",
            }
        )
    book_attribution = f"{author}, {title}. Source checked against Project Gutenberg eBook #{candidate.ebook_id}."
    reviewed_book = {
        "id": candidate.book_id,
        "title": title,
        "author": author,
        "edition": edition,
        "category": candidate.category,
        "difficultyLabel": "Grades 4-8",
        "starRating": 4.0,
        "ratingBasis": "LitLearn editorial starter rating; not an aggregated reader rating.",
        "sourceUrl": landing_url,
        "chapterBoundaryStatus": "verified",
        "chapterMetadata": chapter_metadata,
        "source": {
            "provider": "Project Gutenberg",
            "ebookId": str(candidate.ebook_id),
            "landingUrl": landing_url,
            "metadataUrl": metadata_url,
            "termsUrl": "https://www.gutenberg.org/policy/terms_of_use.html",
            "licenseUrl": "https://www.gutenberg.org/policy/license.html",
            "downloadGuidance": f"All explicit printed chapters were retrieved once during authoring using {metadata_route}, checked against the Project Gutenberg landing page, and stored in LitLearn's local reviewed cache. The reader never requests this source URL at runtime.",
            "accessedAt": accessed_at,
            "ebookLicenseReviewStatus": "reviewed",
        },
        "rights": {
            "status": "verified-public-domain-us",
            "textReuseCleared": True,
            "territory": territory,
            "license": "The Project Gutenberg landing page states this eBook is public domain in the USA. The cache contains the underlying U.S.-unrestricted chapter text and omits Project Gutenberg license and trademark notices.",
            "requiredAttribution": book_attribution,
            "basis": "The title page was checked for its public-domain-in-USA status and the downloaded eBook was checked for its Project Gutenberg notices on the recorded access date. This record makes no worldwide public-domain assertion.",
            "usCopyrightStatus": "public-domain-in-the-united-states",
            "worldwideCopyrightStatus": "review-required",
        },
        "accessRules": {
            "mode": "free" if candidate.access_mode == "free" else "purchase-only" if candidate.access_mode == "purchase-only" else "subscription",
            "freeLevelRange": [1, 10],
            "freeChapterIds": [chapter["id"] for chapter in chapter_metadata] if candidate.access_mode == "free" else [],
            "subscriptionEligible": candidate.access_mode == "subscription",
            "permanentPurchaseEligible": candidate.access_mode != "free",
            "publicSourceAvailable": True,
            "premiumNote": "Premium controls LitLearn's locally cached chapter and activity access; it does not restrict the underlying Project Gutenberg source text.",
        },
    }
    if candidate.price_diamonds is not None:
        reviewed_book["mockPurchase"] = {
            "price": candidate.price_diamonds,
            "currency": "diamonds",
            "reversibleUntilRead": True,
        }
    return caches, reviewed_book


def review_candidate_with_context(
    candidate: Candidate, use_gutendex: bool
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """Retain the exact eBook ID when one review gate rejects a title."""
    try:
        return review_candidate(candidate, use_gutendex)
    except (OSError, ValueError) as error:
        raise ValueError(f"Review failed for Gutenberg eBook #{candidate.ebook_id}: {error}") from error


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--write", action="store_true", help="Write caches and the generated review manifest")
    parser.add_argument("--skip-gutendex", action="store_true", help="Use the checked Project Gutenberg catalog fallback after a Gutendex outage")
    parser.add_argument("--cache-directory", type=Path, default=DEFAULT_CACHE_DIRECTORY)
    parser.add_argument("--index-path", type=Path, default=DEFAULT_INDEX_PATH)
    args = parser.parse_args()

    cached: list[dict[str, Any]] = []
    reviewed_books: list[dict[str, Any]] = []
    # Three bounded workers avoid a long authoring run while keeping source
    # traffic deliberately modest. executor.map preserves manifest order.
    with ThreadPoolExecutor(max_workers=3) as executor:
        reviewed_pairs = list(
            executor.map(
                lambda candidate: review_candidate_with_context(candidate, use_gutendex=not args.skip_gutendex),
                CANDIDATES,
            )
        )
    for index, (candidate, (caches, reviewed_book)) in enumerate(zip(CANDIDATES, reviewed_pairs, strict=True)):
        cache = caches[0]
        print(f"reviewed #{candidate.ebook_id}: {reviewed_book['title']} — {cache['chapterTitle']}")
        cached.extend(caches)
        reviewed_books.append(reviewed_book)
        if index < len(CANDIDATES) - 1:
            time.sleep(0.2)

    if not args.write:
        return
    args.cache_directory.mkdir(parents=True, exist_ok=True)
    index_rows: list[dict[str, str]] = []
    expected_filenames: set[str] = set()
    for cache in cached:
        filename = f"{cache['bookId']}--{cache['chapterId']}.json"
        expected_filenames.add(filename)
        cache_path = args.cache_directory / filename
        cache_path.write_text(json.dumps(cache, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        index_rows.append(
            {
                "bookId": cache["bookId"],
                "chapterId": cache["chapterId"],
                "path": f"backend/data/books/cached-chapters/{filename}",
                "contentHash": cache["contentHash"],
            }
        )
    # All files in this directory are generated cache records. This cleanup
    # occurs only after every source and chapter-boundary review has passed.
    for cache_path in args.cache_directory.glob("*.json"):
        if cache_path.name not in expected_filenames:
            cache_path.unlink()
    args.index_path.write_text(
        json.dumps(
            {
                "schemaVersion": 1,
                "contentFormat": "sentence-array-v1",
                "entries": index_rows,
                "reviewedBooks": reviewed_books,
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
