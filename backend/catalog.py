"""Versioned, reviewable catalogs for LitLearn's optional local-demo APIs.

Catalog entries deliberately contain metadata only.  They do not bundle book text,
payment details, advertising profiles, or child identifiers.
"""

from __future__ import annotations

from copy import deepcopy
import json
from pathlib import Path
from typing import Any, TypedDict


CATALOG_PATH = Path(__file__).resolve().parent / "data" / "platform-catalogs.json"
VALID_RARITIES = frozenset({"Common", "Rare", "Epic", "Legendary", "Mythical"})
VALID_CURRENCIES = frozenset({"gold", "diamonds"})


class CatalogError(ValueError):
    """Raised when reviewed catalog data cannot safely be exposed."""


class PetSchema(TypedDict):
    id: str
    name: str
    petType: str
    rarity: str
    literatureSource: str
    edition: str
    chapter: str
    sourceUrl: str
    rightsStatus: str
    license: str
    territory: str
    requiredAttribution: str
    description: str
    baseArtworkKey: str
    allowedAccessories: list[str]
    eventOnly: bool
    availability: str


class ProfileSchema(TypedDict):
    id: str
    displayName: str
    xp: int
    level: int
    wallet: dict[str, int]
    inventory: dict[str, int]
    activePetId: str | None
    ownedPetIds: list[str]
    equippedAccessories: dict[str, str]
    wishlist: list[dict[str, str]]
    badges: list[str]
    achievements: list[str]
    bookmarks: list[str]
    ownedBookIds: list[str]
    preferences: dict[str, Any]


def _mapping(value: object, context: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise CatalogError(f"{context} must be an object")
    return value


def _text(value: object, context: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise CatalogError(f"{context} must be a non-empty string")
    return value


def _fields(row: dict[str, Any], required: set[str], context: str) -> None:
    missing = sorted(required.difference(row))
    if missing:
        raise CatalogError(f"{context} is missing required fields: {missing}")


def _unique_ids(rows: object, context: str) -> list[dict[str, Any]]:
    if not isinstance(rows, list):
        raise CatalogError(f"{context} must be a list")
    seen: set[str] = set()
    checked: list[dict[str, Any]] = []
    for item in rows:
        row = _mapping(item, context)
        item_id = _text(row.get("id"), f"{context} id")
        if item_id in seen:
            raise CatalogError(f"{context} contains duplicate ID {item_id}")
        seen.add(item_id)
        checked.append(row)
    return checked


def _validate_rights(row: dict[str, Any], context: str, literary: bool = True) -> None:
    required = {"sourceUrl", "rightsStatus", "license", "territory", "requiredAttribution"}
    if literary:
        required.update({"edition", "chapter"})
    _fields(row, required, context)
    for field in required:
        _text(row[field], f"{context}.{field}")
    if row["rightsStatus"] not in {"original", "verified"}:
        raise CatalogError(f"{context}.rightsStatus must be original or verified")


def validate_catalogs(catalogs_value: object) -> dict[str, Any]:
    """Validate finite demo catalogs, including rights and reward-economy boundaries."""
    catalogs = _mapping(catalogs_value, "Catalogs")
    if catalogs.get("schemaVersion") != 1:
        raise CatalogError("Catalogs.schemaVersion must be 1")
    if set(catalogs.get("currencies", [])) != VALID_CURRENCIES:
        raise CatalogError("Catalogs must define the complete World currency set")
    currency_definitions = _unique_ids(catalogs.get("currencyDefinitions"), "currency definitions")
    if {definition["id"] for definition in currency_definitions} != VALID_CURRENCIES:
        raise CatalogError("Currency definitions must match the complete World currency set")
    for definition in currency_definitions:
        _fields(definition, {"id", "label", "availability"}, f"currency {definition['id']}")
        _text(definition["label"], f"currency {definition['id']} label")

    wallet_migration = _mapping(catalogs.get("walletMigration"), "wallet migration")
    _fields(wallet_migration, {"version", "legacyConversions", "note"}, "wallet migration")
    if wallet_migration["version"] != 1 or not isinstance(wallet_migration["note"], str):
        raise CatalogError("wallet migration must define supported version 1 and a note")
    if not isinstance(wallet_migration["legacyConversions"], list):
        raise CatalogError("wallet migration conversions must be a list")
    conversions = _unique_ids(
        [
            {"id": conversion.get("from"), **conversion}
            for conversion in wallet_migration["legacyConversions"]
            if isinstance(conversion, dict)
        ],
        "wallet migration conversions",
    )
    expected_conversions = {"leafTokens": "gold", "storyShards": "diamonds"}
    if (
        len(conversions) != len(wallet_migration["legacyConversions"])
        or {conversion["id"]: conversion.get("to") for conversion in conversions} != expected_conversions
        or any(conversion.get("rate") != "1:1" for conversion in conversions)
    ):
        raise CatalogError("wallet migration must preserve Leaf Tokens and Story Shards at 1:1")

    inventory_items = _unique_ids(catalogs.get("inventoryItems"), "inventory items")
    inventory_item_ids = {item["id"] for item in inventory_items}
    for item in inventory_items:
        _fields(item, {"id", "label", "description", "consumable"}, f"inventory item {item['id']}")
        _text(item["label"], f"inventory item {item['id']} label")
        _text(item["description"], f"inventory item {item['id']} description")
        if not isinstance(item["consumable"], bool):
            raise CatalogError(f"inventory item {item['id']} consumable must be boolean")

    pets = _unique_ids(catalogs.get("pets"), "pets")
    if len([pet for pet in pets if pet.get("starterClaim") is True]) != 6:
        raise CatalogError("Exactly six no-cost Level Road starter claims are required")
    pet_ids = {pet["id"] for pet in pets}
    for pet in pets:
        _fields(
            pet,
            {
                "id", "name", "petType", "rarity", "literatureSource", "description",
                "baseArtworkKey", "allowedAccessories", "eventOnly", "availability", "unlockLevel", "starterClaim",
            },
            f"pet {pet['id']}",
        )
        _validate_rights(pet, f"pet {pet['id']}")
        if pet["rarity"] not in VALID_RARITIES:
            raise CatalogError(f"pet {pet['id']} has invalid rarity")
        if pet["rarity"] == "Mythical" and not pet["eventOnly"]:
            raise CatalogError("Mythical pets must be event-only")
        if pet["eventOnly"] and pet["availability"] != "level-road-event":
            raise CatalogError("Event-only pets must be Level Road and event gated")
        if not pet["eventOnly"] and pet["availability"] != "level-road":
            raise CatalogError("Every non-event pet must be Level Road locked")
        if not isinstance(pet["unlockLevel"], int) or not 1 <= pet["unlockLevel"] <= 100:
            raise CatalogError(f"pet {pet['id']} has invalid Level Road unlock")
        if not isinstance(pet["starterClaim"], bool):
            raise CatalogError(f"pet {pet['id']} starterClaim must be boolean")

    accessories = _unique_ids(catalogs.get("accessories"), "accessories")
    accessory_ids = {row["id"] for row in accessories}
    for accessory in accessories:
        _fields(
            accessory,
            {"id", "category", "wearableType", "rarity", "price", "currency", "compatiblePetTypes", "availability"},
            f"accessory {accessory['id']}",
        )
        _validate_rights(accessory, f"accessory {accessory['id']}", literary=False)
        if accessory["rarity"] not in VALID_RARITIES or accessory["currency"] not in VALID_CURRENCIES:
            raise CatalogError(f"accessory {accessory['id']} has invalid rarity or currency")
        if not isinstance(accessory["price"], int) or accessory["price"] < 0:
            raise CatalogError(f"accessory {accessory['id']} has invalid price")
        if accessory["wearableType"] not in {"accessory", "clothing"}:
            raise CatalogError(f"accessory {accessory['id']} has invalid wearable type")

    eggs = _unique_ids(catalogs.get("eggs"), "eggs")
    egg_ids = {row["id"] for row in eggs}
    for egg in eggs:
        _fields(
            egg,
            {"id", "rarityRange", "odds", "price", "currency", "possibleRewards", "duplicateBehavior", "availability"},
            f"egg {egg['id']}",
        )
        odds = _mapping(egg["odds"], f"egg {egg['id']}.odds")
        if set(odds) != set(egg["rarityRange"]) or not all(
            rarity in {"Common", "Rare", "Epic", "Legendary"} for rarity in odds
        ):
            raise CatalogError(f"egg {egg['id']} must use explicit Common through Legendary odds")
        if abs(sum(odds.values()) - 1.0) > 0.00001 or any(
            not isinstance(value, (int, float)) or value <= 0 for value in odds.values()
        ):
            raise CatalogError(f"egg {egg['id']} odds must be positive and total 1")
        if egg["currency"] not in VALID_CURRENCIES or not isinstance(egg["price"], int) or egg["price"] < 0:
            raise CatalogError(f"egg {egg['id']} has invalid price or currency")
        rewards = _mapping(egg["possibleRewards"], f"egg {egg['id']}.possibleRewards")
        for rarity, ids in rewards.items():
            if rarity not in odds or not isinstance(ids, list) or not ids:
                raise CatalogError(f"egg {egg['id']} has an invalid reward bucket")
            for pet_id in ids:
                if pet_id not in pet_ids:
                    raise CatalogError(f"egg {egg['id']} references unknown pet {pet_id}")
        duplicate = _mapping(egg["duplicateBehavior"], f"egg {egg['id']}.duplicateBehavior")
        if duplicate.get("currency") not in VALID_CURRENCIES or not isinstance(duplicate.get("quantity"), int):
            raise CatalogError(f"egg {egg['id']} has invalid duplicate compensation")

    books = _unique_ids(catalogs.get("books"), "books")
    for book in books:
        _fields(
            book,
            {"id", "title", "author", "chapterMetadata", "readingLevel", "topic", "vocabularyLevel", "accessTier"},
            f"book {book['id']}",
        )
        _validate_rights(book, f"book {book['id']}", literary=False)
        _text(book.get("edition"), f"book {book['id']}.edition")
        if book["accessTier"] not in {"free-demo", "premium"}:
            raise CatalogError(f"book {book['id']} has invalid access tier")
        if book["vocabularyLevel"] not in {"basic", "advanced"}:
            raise CatalogError(f"book {book['id']} has invalid vocabulary level")
        if not isinstance(book["chapterMetadata"], list) or not book["chapterMetadata"]:
            raise CatalogError(f"book {book['id']} must list chapters")
        for chapter in book["chapterMetadata"]:
            chapter_row = _mapping(chapter, f"book {book['id']} chapter")
            _text(chapter_row.get("id"), f"book {book['id']} chapter id")
            _text(chapter_row.get("title"), f"book {book['id']} chapter title")
            if chapter_row.get("accessTier") not in {"free-demo", "premium"}:
                raise CatalogError(f"book {book['id']} chapter has invalid access tier")

    rewards = _unique_ids(catalogs.get("rewards"), "rewards")
    for reward in rewards:
        _fields(reward, {"id", "type", "catalogId", "quantity", "rarity", "source", "claimStatus"}, f"reward {reward['id']}")
        if reward["rarity"] not in VALID_RARITIES or not isinstance(reward["quantity"], int) or reward["quantity"] <= 0:
            raise CatalogError(f"reward {reward['id']} has invalid quantity or rarity")
        if reward["type"] == "accessory" and reward["catalogId"] not in accessory_ids:
            raise CatalogError(f"reward {reward['id']} references unknown accessory")
        if reward["type"] == "currency" and reward["catalogId"] not in VALID_CURRENCIES:
            raise CatalogError(f"reward {reward['id']} references unknown currency")
        if reward["type"] == "egg" and reward["catalogId"] not in egg_ids:
            raise CatalogError(f"reward {reward['id']} references unknown egg")
        if reward["type"] == "pet" and reward["catalogId"] not in pet_ids:
            raise CatalogError(f"reward {reward['id']} references unknown pet")
        if reward["type"] == "inventory" and reward["catalogId"] not in inventory_item_ids:
            raise CatalogError(f"reward {reward['id']} references unknown inventory item")
        if reward["type"] not in {"currency", "accessory", "egg", "pet", "inventory"}:
            raise CatalogError(f"reward {reward['id']} has an unsupported type")

    quest_reward_rules = _unique_ids(catalogs.get("questRewardRules"), "quest reward rules")
    known_rewards = {reward["id"] for reward in rewards}
    for rule in quest_reward_rules:
        _fields(rule, {"id", "questIds", "rewardId", "requiresAwardedXp"}, f"quest reward rule {rule['id']}")
        if not isinstance(rule["questIds"], list) or not rule["questIds"] or not all(
            isinstance(quest_id, str) and quest_id for quest_id in rule["questIds"]
        ):
            raise CatalogError(f"quest reward rule {rule['id']} must list eligible quest IDs")
        if rule["rewardId"] not in known_rewards or not isinstance(rule["requiresAwardedXp"], bool):
            raise CatalogError(f"quest reward rule {rule['id']} is invalid")

    nodes = _unique_ids(catalogs.get("levelNodes"), "levelNodes")
    for node in nodes:
        _fields(node, {"id", "requiredXp", "prerequisites", "rewardIds", "mapPosition"}, f"level node {node['id']}")
        if not isinstance(node["requiredXp"], int) or node["requiredXp"] < 0:
            raise CatalogError(f"level node {node['id']} has invalid required XP")
        if not set(node["rewardIds"]).issubset(known_rewards):
            raise CatalogError(f"level node {node['id']} references an unknown reward")

    passes = _unique_ids(catalogs.get("battlePasses"), "battle passes")
    for battle_pass in passes:
        _fields(battle_pass, {"id", "season", "month", "plan", "rewardPool", "progressRule", "rewards", "expiresAt"}, f"battle pass {battle_pass['id']}")
        if battle_pass["plan"] not in {"basic", "premium"} or not set(battle_pass["rewards"]).issubset(known_rewards):
            raise CatalogError(f"battle pass {battle_pass['id']} is invalid")
        reward_rarities = [next(reward for reward in rewards if reward["id"] == reward_id)["rarity"] for reward_id in battle_pass["rewards"]]
        if battle_pass["plan"] == "basic" and reward_rarities != ["Rare"]:
            raise CatalogError("Basic battle passes must grant exactly one Rare reward")
        if battle_pass["plan"] == "premium" and reward_rarities != ["Epic"]:
            raise CatalogError("Premium battle passes must grant exactly one Epic reward")

    shop = _unique_ids(catalogs.get("shopItems"), "shop items")
    for item in shop:
        _fields(item, {"id", "itemType", "catalogId", "price", "currency", "purchaseLimit", "availability"}, f"shop item {item['id']}")
        if item["currency"] not in VALID_CURRENCIES or not isinstance(item["price"], int) or item["price"] < 0:
            raise CatalogError(f"shop item {item['id']} has invalid price or currency")
        if item["itemType"] == "currency" and item["catalogId"] not in VALID_CURRENCIES:
            raise CatalogError(f"shop item {item['id']} references an unknown currency")
        if item["itemType"] == "inventory" and item["catalogId"] not in inventory_item_ids:
            raise CatalogError(f"shop item {item['id']} references an unknown inventory item")
        if "quantity" in item and (not isinstance(item["quantity"], int) or item["quantity"] <= 0):
            raise CatalogError(f"shop item {item['id']} has invalid quantity")
    return catalogs


def load_catalogs(path: Path = CATALOG_PATH) -> dict[str, Any]:
    try:
        with path.open(encoding="utf-8") as catalog_file:
            return deepcopy(validate_catalogs(json.load(catalog_file)))
    except (OSError, json.JSONDecodeError) as error:
        raise CatalogError(f"Could not load reviewed platform catalogs from {path.name}") from error


def indexed(catalogs: dict[str, Any], key: str) -> dict[str, dict[str, Any]]:
    return {item["id"]: item for item in catalogs[key]}
