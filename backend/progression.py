"""Deterministic Level Road thresholds through level 100.

Thresholds are total XP values.  The XP required for each next level increases
at ten-level milestones, so clients can show both the complete road and the
current next-step requirement without reimplementing business logic.
"""

from __future__ import annotations

from copy import deepcopy
from typing import Any


MILESTONES = (
    {"levels": [1, 10], "firstLevelXp": 100, "stepXp": 25, "label": "Foundation"},
    {"levels": [11, 20], "firstLevelXp": 350, "stepXp": 40, "label": "Explorer"},
    {"levels": [21, 30], "firstLevelXp": 800, "stepXp": 55, "label": "Pathfinder"},
    {"levels": [31, 40], "firstLevelXp": 1400, "stepXp": 70, "label": "Researcher"},
    {"levels": [41, 50], "firstLevelXp": 2150, "stepXp": 85, "label": "Navigator"},
    {"levels": [51, 60], "firstLevelXp": 3050, "stepXp": 100, "label": "Mentor"},
    {"levels": [61, 70], "firstLevelXp": 4100, "stepXp": 115, "label": "Trailblazer"},
    {"levels": [71, 80], "firstLevelXp": 5300, "stepXp": 130, "label": "Scholar"},
    {"levels": [81, 90], "firstLevelXp": 6650, "stepXp": 145, "label": "Steward"},
    {"levels": [91, 100], "firstLevelXp": 8150, "stepXp": 160, "label": "Storykeeper"},
)


def _increment_for_level(level: int) -> tuple[int, dict[str, Any]]:
    """Return XP needed to advance from level - 1 to ``level``."""
    for milestone in MILESTONES:
        start, end = milestone["levels"]
        if start <= level <= end:
            offset = level - max(2, start)
            return milestone["firstLevelXp"] + max(0, offset) * milestone["stepXp"], milestone
    raise ValueError("Level must be between 2 and 100")


def level_nodes(reward_ids_by_level: dict[int, list[str]] | None = None) -> list[dict[str, Any]]:
    """Return all 100 fixed road nodes with any catalog-defined rewards."""
    reward_ids_by_level = reward_ids_by_level or {}
    total = 0
    nodes: list[dict[str, Any]] = []
    for level in range(1, 101):
        milestone = MILESTONES[0]
        required_to_advance = 0
        if level > 1:
            required_to_advance, milestone = _increment_for_level(level)
            total += required_to_advance
        else:
            milestone = MILESTONES[0]
        nodes.append(
            {
                "id": f"level-{level}",
                "level": level,
                "requiredXp": total,
                "xpFromPreviousLevel": required_to_advance,
                "milestone": milestone["label"],
                "prerequisites": [] if level == 1 else [f"level-{level - 1}"],
                "rewardIds": list(reward_ids_by_level.get(level, [])),
                "mapPosition": {"x": level - 1, "y": (level - 1) // 5},
            }
        )
    return nodes


def level_for_xp(xp: int, reward_ids_by_level: dict[int, list[str]] | None = None) -> int:
    if xp < 0:
        return 1
    return max(node["level"] for node in level_nodes(reward_ids_by_level) if xp >= node["requiredXp"])


def progression_definition(reward_ids_by_level: dict[int, list[str]] | None = None) -> dict[str, Any]:
    return {
        "levels": level_nodes(reward_ids_by_level),
        "milestones": deepcopy(list(MILESTONES)),
        "awardPolicy": {
            "correctAnswerXp": 20,
            "correctEvidenceXp": 10,
            "incorrectOrUnansweredXp": 0,
            "duplicateAttemptXp": 0,
            "reasoningRequirement": "A response must select the question's correct supporting sentence to receive reasoning XP.",
        },
    }
