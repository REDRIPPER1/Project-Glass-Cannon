"""Anonymous local-demo persistence for the companion, access, and reward APIs."""

from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import sqlite3
import tempfile
from typing import Any
from uuid import uuid4

from .catalog import indexed


MIGRATION_PATH = Path(__file__).resolve().parent / "migrations" / "001_local_demo_platform.sql"
EVENT_TYPES = frozenset(
    {
        "quest_completed",
        "evidence_chosen",
        "pet_acquired",
        "accessory_equipped",
        "purchase_completed",
        "wishlist_changed",
        "battle_pass_claimed",
        "subscription_viewed",
        "return_used",
    }
)


class PlatformError(ValueError):
    def __init__(self, code: str, message: str, status_code: int = 400):
        super().__init__(message)
        self.code = code
        self.status_code = status_code


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def is_expired(timestamp: str, now: datetime | None = None) -> bool:
    current = now or datetime.now(timezone.utc)
    return datetime.fromisoformat(timestamp.replace("Z", "+00:00")) < current


def _level_for_xp(catalogs: dict[str, Any], xp: int) -> int:
    return max(
        index + 1
        for index, node in enumerate(sorted(catalogs["levelNodes"], key=lambda item: item["requiredXp"]))
        if xp >= node["requiredXp"]
    )


class DemoStore:
    """Deterministic in-memory fallback with the same public methods as SQLiteStore."""

    def __init__(self, catalogs: dict[str, Any]):
        self.catalogs = catalogs
        self.pets = indexed(catalogs, "pets")
        self.accessories = indexed(catalogs, "accessories")
        self.eggs = indexed(catalogs, "eggs")
        self.books = indexed(catalogs, "books")
        self.rewards = indexed(catalogs, "rewards")
        self.passes = indexed(catalogs, "battlePasses")
        self.shop = indexed(catalogs, "shopItems")
        self.profiles: dict[str, dict[str, Any]] = {}
        self.events: list[dict[str, Any]] = []

    def _save(self, profile: dict[str, Any]) -> None:
        """Persistence hook; the in-memory fallback intentionally does nothing."""

    def _profile(self, profile_id: str) -> dict[str, Any]:
        profile = self.profiles.get(profile_id)
        if profile is None:
            raise PlatformError("profile_not_found", "Anonymous profile was not found.", 404)
        for currency in self.catalogs["currencies"]:
            profile["currencies"].setdefault(currency, 0)
        feature_flags = profile["entitlement"].setdefault("featureFlags", {})
        feature_flags.setdefault("advancedVocabulary", feature_flags.get("expandedVocabulary", False))
        return profile

    def _catalog_item(self, catalog: dict[str, Any], item_id: str, item_type: str) -> dict[str, Any]:
        item = catalog.get(item_id)
        if item is None:
            raise PlatformError("invalid_catalog_id", f"Unknown {item_type} ID '{item_id}'.", 404)
        return item

    def create_profile(self, display_name: str | None = None, demo_plan: str = "free") -> dict[str, Any]:
        if demo_plan not in {"free", "basic", "premium"}:
            raise PlatformError("invalid_entitlement", "Demo plan must be free, basic, or premium.")
        name = (display_name or "Trail Reader").strip()
        if not 1 <= len(name) <= 40 or "@" in name:
            raise PlatformError("invalid_display_name", "Use a 1–40 character display name without contact details.")
        profile_id = f"anon-{uuid4().hex}"
        starters = [pet["id"] for pet in self.catalogs["pets"] if pet["availability"] == "starter"]
        now = utc_now()
        profile = {
            "id": profile_id,
            "displayName": name,
            "xp": 0,
            "level": 1,
            "currencies": {"leafTokens": 150, "storyShards": 0, "gold": 0, "diamonds": 0},
            "activePetId": starters[0],
            "ownedPetIds": starters,
            "petNames": {},
            "ownedAccessoryIds": [],
            "equippedAccessories": {},
            "eggInventory": {},
            "wishlist": [],
            "badges": [],
            "achievements": [],
            "bookmarks": [],
            "preferences": {"adsEnabled": True, "soundEnabled": False, "theme": "system"},
            "entitlement": self._entitlement(demo_plan, now),
            "rewardInstances": [],
            "purchaseLedger": [],
            "battlePassProgress": {},
            "grantedNodeIds": [],
            "createdAt": now,
            "updatedAt": now,
        }
        self.profiles[profile_id] = profile
        self._save(profile)
        return self.public_profile(profile)

    @staticmethod
    def _entitlement(plan: str, starts_at: str) -> dict[str, Any]:
        premium = plan == "premium"
        return {
            "plan": plan,
            "status": "demo-active" if plan != "free" else "active",
            "startsAt": starts_at,
            "endsAt": None,
            "featureFlags": {
                "fullBooks": premium,
                "expandedVocabulary": premium,
                "advancedVocabulary": premium,
                "advancedQuizzes": premium,
                "premiumBattlePass": premium,
            },
            "adFree": premium,
            "bookAccessLevel": "full" if premium else "demo",
            "source": "local-demo",
        }

    def public_profile(self, profile: dict[str, Any]) -> dict[str, Any]:
        result = deepcopy(profile)
        result.pop("rewardInstances", None)
        result.pop("purchaseLedger", None)
        result.pop("battlePassProgress", None)
        result.pop("grantedNodeIds", None)
        return result

    def get_profile(self, profile_id: str) -> dict[str, Any]:
        return self.public_profile(self._profile(profile_id))

    def balances(self, profile_id: str) -> dict[str, Any]:
        profile = self._profile(profile_id)
        return {"profileId": profile_id, "currencies": deepcopy(profile["currencies"])}

    def update_profile(self, profile_id: str, updates: dict[str, Any]) -> dict[str, Any]:
        profile = self._profile(profile_id)
        allowed = {"displayName", "preferences", "bookmarks"}
        unknown = set(updates).difference(allowed)
        if unknown:
            raise PlatformError("invalid_profile_update", f"Unsupported profile fields: {sorted(unknown)}.")
        if "displayName" in updates:
            name = str(updates["displayName"]).strip()
            if not 1 <= len(name) <= 40 or "@" in name:
                raise PlatformError("invalid_display_name", "Use a 1–40 character display name without contact details.")
            profile["displayName"] = name
        if "preferences" in updates:
            preferences = updates["preferences"]
            if not isinstance(preferences, dict) or not set(preferences).issubset({"adsEnabled", "soundEnabled", "theme"}):
                raise PlatformError("invalid_preferences", "Preferences may only set adsEnabled, soundEnabled, or theme.")
            if not all(isinstance(value, (str, bool)) for value in preferences.values()):
                raise PlatformError("invalid_preferences", "Preference values must be strings or booleans.")
            profile["preferences"].update(preferences)
        if "bookmarks" in updates:
            bookmarks = updates["bookmarks"]
            if not isinstance(bookmarks, list) or not all(isinstance(value, str) for value in bookmarks):
                raise PlatformError("invalid_bookmarks", "Bookmarks must be a list of anonymous quest IDs.")
            profile["bookmarks"] = bookmarks[:50]
        self._touch(profile)
        return self.public_profile(profile)

    def _touch(self, profile: dict[str, Any]) -> None:
        profile["updatedAt"] = utc_now()
        self._save(profile)

    def rename_pet(self, profile_id: str, pet_id: str, name: str) -> dict[str, Any]:
        profile = self._profile(profile_id)
        if pet_id not in profile["ownedPetIds"]:
            raise PlatformError("pet_not_owned", "That pet is not in this profile's collection.", 403)
        clean_name = name.strip()
        if not 1 <= len(clean_name) <= 24:
            raise PlatformError("invalid_pet_name", "Pet names must be 1–24 characters.")
        profile["petNames"][pet_id] = clean_name
        self._touch(profile)
        return {"petId": pet_id, "name": clean_name}

    def set_active_pet(self, profile_id: str, pet_id: str) -> dict[str, Any]:
        profile = self._profile(profile_id)
        if pet_id not in profile["ownedPetIds"]:
            raise PlatformError("pet_not_owned", "A pet must be owned before it can be active.", 403)
        profile["activePetId"] = pet_id
        profile["equippedAccessories"] = {}
        self._touch(profile)
        return {"activePetId": pet_id, "equippedAccessories": {}}

    def equip_accessory(self, profile_id: str, accessory_id: str) -> dict[str, Any]:
        profile = self._profile(profile_id)
        accessory = self._catalog_item(self.accessories, accessory_id, "accessory")
        if accessory_id not in profile["ownedAccessoryIds"]:
            raise PlatformError("accessory_not_owned", "That accessory must be owned before equipping it.", 403)
        active_pet = self.pets[profile["activePetId"]]
        if active_pet["petType"] not in accessory["compatiblePetTypes"]:
            raise PlatformError("incompatible_accessory", "That accessory cannot be equipped by the active pet.", 409)
        profile["equippedAccessories"][accessory["category"]] = accessory_id
        self._touch(profile)
        return {"activePetId": profile["activePetId"], "equippedAccessories": deepcopy(profile["equippedAccessories"])}

    def unequip_accessory(self, profile_id: str, category: str) -> dict[str, Any]:
        profile = self._profile(profile_id)
        if category not in profile["equippedAccessories"]:
            raise PlatformError("accessory_not_equipped", "No accessory is equipped in that category.", 404)
        del profile["equippedAccessories"][category]
        self._touch(profile)
        return {"activePetId": profile["activePetId"], "equippedAccessories": deepcopy(profile["equippedAccessories"])}

    def change_wishlist(self, profile_id: str, item_type: str, catalog_id: str, add: bool) -> dict[str, Any]:
        profile = self._profile(profile_id)
        catalogs = {"pet": self.pets, "accessory": self.accessories, "egg": self.eggs, "book": self.books}
        if item_type not in catalogs:
            raise PlatformError("invalid_wishlist_type", "Wishlist type must be pet, accessory, egg, or book.")
        self._catalog_item(catalogs[item_type], catalog_id, item_type)
        item = {"itemType": item_type, "catalogId": catalog_id}
        if add and item not in profile["wishlist"]:
            profile["wishlist"].append(item)
        if not add:
            profile["wishlist"] = [entry for entry in profile["wishlist"] if entry != item]
        self._touch(profile)
        return {"wishlist": deepcopy(profile["wishlist"])}

    def add_xp(self, profile_id: str, amount: int, source: str) -> dict[str, Any]:
        if source not in {"quest-complete", "demo-seed"} or not isinstance(amount, int) or not 1 <= amount <= 500:
            raise PlatformError("invalid_xp_award", "XP awards require a 1–500 quest-complete or demo-seed value.")
        profile = self._profile(profile_id)
        profile["xp"] += amount
        profile["level"] = _level_for_xp(self.catalogs, profile["xp"])
        for node in self.catalogs["levelNodes"]:
            if node["requiredXp"] <= profile["xp"] and node["id"] not in profile["grantedNodeIds"]:
                profile["grantedNodeIds"].append(node["id"])
                for reward_id in node["rewardIds"]:
                    self._issue_reward(profile, reward_id, "level-map")
        self._touch(profile)
        return self.progress(profile_id)

    def _issue_reward(self, profile: dict[str, Any], reward_id: str, source: str) -> dict[str, Any]:
        reward = self._catalog_item(self.rewards, reward_id, "reward")
        instance = {"id": f"reward-{uuid4().hex}", "rewardId": reward_id, "source": source, "claimStatus": "unclaimed", "issuedAt": utc_now()}
        profile["rewardInstances"].append(instance)
        return instance

    def progress(self, profile_id: str) -> dict[str, Any]:
        profile = self._profile(profile_id)
        unlocked = [node["id"] for node in self.catalogs["levelNodes"] if node["requiredXp"] <= profile["xp"]]
        return {"xp": profile["xp"], "level": profile["level"], "levelNodes": deepcopy(self.catalogs["levelNodes"]), "unlockedNodeIds": unlocked, "badges": deepcopy(profile["badges"]), "achievements": deepcopy(profile["achievements"]), "trophies": deepcopy(self.catalogs["trophies"])}

    def rewards_for_profile(self, profile_id: str) -> list[dict[str, Any]]:
        profile = self._profile(profile_id)
        return [deepcopy(instance) | {"reward": deepcopy(self.rewards[instance["rewardId"]])} for instance in profile["rewardInstances"]]

    def claim_reward(self, profile_id: str, instance_id: str) -> dict[str, Any]:
        profile = self._profile(profile_id)
        instance = next((item for item in profile["rewardInstances"] if item["id"] == instance_id), None)
        if instance is None:
            raise PlatformError("reward_not_found", "Reward instance was not found.", 404)
        if instance["claimStatus"] != "unclaimed":
            raise PlatformError("duplicate_claim", "This reward has already been claimed.", 409)
        reward = self.rewards[instance["rewardId"]]
        self._grant(profile, reward["type"], reward["catalogId"], reward["quantity"])
        instance["claimStatus"] = "claimed"
        instance["claimedAt"] = utc_now()
        self._touch(profile)
        return deepcopy(instance) | {"reward": deepcopy(reward)}

    def _grant(self, profile: dict[str, Any], item_type: str, catalog_id: str, quantity: int) -> None:
        if item_type == "currency":
            profile["currencies"][catalog_id] = profile["currencies"].get(catalog_id, 0) + quantity
        elif item_type == "accessory":
            if catalog_id not in profile["ownedAccessoryIds"]:
                profile["ownedAccessoryIds"].append(catalog_id)
        elif item_type == "pet":
            if catalog_id not in profile["ownedPetIds"]:
                profile["ownedPetIds"].append(catalog_id)
        elif item_type == "egg":
            profile["eggInventory"][catalog_id] = profile["eggInventory"].get(catalog_id, 0) + quantity
        else:
            raise PlatformError("invalid_reward", "Reward has an unsupported item type.")

    def purchase(self, profile_id: str, shop_item_id: str) -> dict[str, Any]:
        profile = self._profile(profile_id)
        item = self._catalog_item(self.shop, shop_item_id, "shop item")
        if item["availability"] != "available":
            raise PlatformError("unavailable_shop_item", "That shop item is not currently available.", 409)
        purchases = [entry for entry in profile["purchaseLedger"] if entry["shopItemId"] == shop_item_id and not entry.get("reversedAt")]
        if len(purchases) >= item["purchaseLimit"]:
            raise PlatformError("purchase_limit_reached", "This demo purchase limit has been reached.", 409)
        balance = profile["currencies"].get(item["currency"], 0)
        if balance < item["price"]:
            raise PlatformError("insufficient_currency", "There is not enough currency for this item.", 409)
        profile["currencies"][item["currency"]] -= item["price"]
        if item["itemType"] == "egg":
            profile["eggInventory"][item["catalogId"]] = profile["eggInventory"].get(item["catalogId"], 0) + 1
        else:
            self._grant(profile, item["itemType"], item["catalogId"], 1)
        purchase = {"id": f"purchase-{uuid4().hex}", "shopItemId": shop_item_id, "price": item["price"], "currency": item["currency"], "reversible": True, "mocked": True, "createdAt": utc_now()}
        profile["purchaseLedger"].append(purchase)
        self._touch(profile)
        return deepcopy(purchase) | {"balances": deepcopy(profile["currencies"])}

    def reverse_purchase(self, profile_id: str, purchase_id: str) -> dict[str, Any]:
        profile = self._profile(profile_id)
        purchase = next((entry for entry in profile["purchaseLedger"] if entry["id"] == purchase_id), None)
        if purchase is None:
            raise PlatformError("purchase_not_found", "Demo purchase was not found.", 404)
        if purchase.get("reversedAt") or not purchase["reversible"]:
            raise PlatformError("purchase_not_reversible", "That purchase cannot be reversed.", 409)
        item = self.shop[purchase["shopItemId"]]
        if item["itemType"] == "egg":
            if profile["eggInventory"].get(item["catalogId"], 0) < 1:
                raise PlatformError("purchase_not_reversible", "An opened egg purchase cannot be reversed.", 409)
            profile["eggInventory"][item["catalogId"]] -= 1
        elif item["catalogId"] in profile["equippedAccessories"].values():
            raise PlatformError("purchase_not_reversible", "Unequip an accessory before reversing its purchase.", 409)
        elif item["itemType"] == "accessory":
            profile["ownedAccessoryIds"].remove(item["catalogId"])
        purchase["reversedAt"] = utc_now()
        profile["currencies"][purchase["currency"]] += purchase["price"]
        self._touch(profile)
        return {"id": purchase_id, "reversed": True, "balances": deepcopy(profile["currencies"])}

    def open_egg(self, profile_id: str, egg_id: str, deterministic: bool = True) -> dict[str, Any]:
        profile = self._profile(profile_id)
        egg = self._catalog_item(self.eggs, egg_id, "egg")
        if profile["eggInventory"].get(egg_id, 0) < 1:
            raise PlatformError("egg_not_owned", "Purchase this egg before opening it.", 409)
        profile["eggInventory"][egg_id] -= 1
        serial = sum(1 for entry in profile["purchaseLedger"] if entry["shopItemId"].endswith(egg_id))
        seed = f"{profile_id}:{egg_id}:{serial}" if deterministic else uuid4().hex
        roll = int(hashlib.sha256(seed.encode()).hexdigest()[:12], 16) / float(16**12)
        cumulative = 0.0
        rarity = "Legendary"
        for candidate, odds in egg["odds"].items():
            cumulative += odds
            if roll < cumulative:
                rarity = candidate
                break
        rewards = egg["possibleRewards"][rarity]
        pet_id = rewards[int(hashlib.sha256((seed + ":pet").encode()).hexdigest(), 16) % len(rewards)]
        duplicate = pet_id in profile["ownedPetIds"]
        if duplicate:
            compensation = egg["duplicateBehavior"]
            profile["currencies"][compensation["currency"]] += compensation["quantity"]
            result = {"petId": pet_id, "rarity": rarity, "duplicate": True, "compensation": deepcopy(compensation)}
        else:
            profile["ownedPetIds"].append(pet_id)
            result = {"petId": pet_id, "rarity": rarity, "duplicate": False, "compensation": None}
        self._touch(profile)
        return result | {"deterministicDemo": deterministic, "balances": deepcopy(profile["currencies"])}

    def subscription(self, profile_id: str) -> dict[str, Any]:
        return deepcopy(self._profile(profile_id)["entitlement"])

    def set_demo_entitlement(self, profile_id: str, plan: str, demo_entitlement: bool) -> dict[str, Any]:
        if not demo_entitlement:
            raise PlatformError("demo_entitlement_required", "Premium access requires an explicit local demo entitlement.", 403)
        if plan not in {"free", "basic", "premium"}:
            raise PlatformError("invalid_entitlement", "Plan must be free, basic, or premium.")
        profile = self._profile(profile_id)
        profile["entitlement"] = self._entitlement(plan, utc_now())
        self._touch(profile)
        return self.subscription(profile_id)

    def book_access(self, profile_id: str, book_id: str, chapter_id: str | None = None, feature: str = "chapter") -> dict[str, Any]:
        profile = self._profile(profile_id)
        book = self._catalog_item(self.books, book_id, "book")
        premium = profile["entitlement"]["featureFlags"]["fullBooks"]
        if feature == "chapter":
            chapter = next((item for item in book["chapterMetadata"] if item["id"] == chapter_id), None)
            if chapter is None:
                raise PlatformError("chapter_not_found", "Chapter metadata was not found.", 404)
            allowed = chapter["accessTier"] == "free-demo" or premium
        elif feature == "vocabulary":
            vocabulary_tier = chapter_id or "basic"
            if vocabulary_tier not in {"basic", "advanced"}:
                raise PlatformError("invalid_vocabulary_tier", "Vocabulary tier must be basic or advanced.")
            allowed = vocabulary_tier == "basic" or profile["entitlement"]["featureFlags"]["advancedVocabulary"]
        elif feature == "quiz":
            if chapter_id not in {"basic", "advanced"}:
                raise PlatformError("invalid_quiz_difficulty", "Quiz difficulty must be basic or advanced.")
            allowed = chapter_id == "basic" or profile["entitlement"]["featureFlags"]["advancedQuizzes"]
        else:
            raise PlatformError("invalid_access_feature", "Access feature must be chapter, vocabulary, or quiz.")
        return {"bookId": book_id, "feature": feature, "requested": chapter_id, "allowed": allowed, "requiredPlan": "free" if allowed else "premium", "entitlement": self.subscription(profile_id)}

    def battle_pass(self, profile_id: str, pass_id: str) -> dict[str, Any]:
        profile = self._profile(profile_id)
        battle_pass = self._catalog_item(self.passes, pass_id, "battle pass")
        progress = profile["battlePassProgress"].get(pass_id, {"progress": 0, "claimedRewardIds": []})
        premium = profile["entitlement"]["featureFlags"]["premiumBattlePass"]
        available = battle_pass["plan"] == "basic" or premium
        return deepcopy(battle_pass) | {"available": available, "expired": is_expired(battle_pass["expiresAt"]), "progress": deepcopy(progress)}

    def add_battle_pass_progress(self, profile_id: str, pass_id: str, amount: int, source: str) -> dict[str, Any]:
        if source != "quest-complete" or not isinstance(amount, int) or not 1 <= amount <= 500:
            raise PlatformError("invalid_battle_pass_progress", "Pass progress requires 1–500 quest-complete XP.")
        profile = self._profile(profile_id)
        battle_pass = self.battle_pass(profile_id, pass_id)
        if battle_pass["expired"]:
            raise PlatformError("battle_pass_expired", "This battle pass has expired.", 409)
        if not battle_pass["available"]:
            raise PlatformError("premium_access_required", "A Premium demo entitlement is required.", 403)
        progress = profile["battlePassProgress"].setdefault(pass_id, {"progress": 0, "claimedRewardIds": []})
        progress["progress"] += amount
        self._touch(profile)
        return self.battle_pass(profile_id, pass_id)

    def claim_battle_pass_reward(self, profile_id: str, pass_id: str, reward_id: str) -> dict[str, Any]:
        profile = self._profile(profile_id)
        battle_pass = self.battle_pass(profile_id, pass_id)
        if battle_pass["expired"]:
            raise PlatformError("battle_pass_expired", "This battle pass has expired.", 409)
        if not battle_pass["available"]:
            raise PlatformError("premium_access_required", "A Premium demo entitlement is required.", 403)
        if reward_id not in battle_pass["rewards"]:
            raise PlatformError("invalid_reward", "This reward is not part of the selected pass.", 404)
        progress = profile["battlePassProgress"].setdefault(pass_id, {"progress": 0, "claimedRewardIds": []})
        if progress["progress"] < battle_pass["progressRule"]["required"]:
            raise PlatformError("reward_not_unlocked", "Earn more pass progress before claiming this reward.", 409)
        if reward_id in progress["claimedRewardIds"]:
            raise PlatformError("duplicate_claim", "This battle-pass reward has already been claimed.", 409)
        instance = self._issue_reward(profile, reward_id, f"battle-pass:{pass_id}")
        progress["claimedRewardIds"].append(reward_id)
        self._touch(profile)
        return deepcopy(instance) | {"reward": deepcopy(self.rewards[reward_id])}

    def ad_placement(self, profile_id: str, placement_id: str) -> dict[str, Any]:
        profile = self._profile(profile_id)
        placement = next((item for item in self.catalogs["adPlacements"] if item["placementId"] == placement_id), None)
        if placement is None:
            raise PlatformError("ad_placement_not_found", "Ad placement was not found.", 404)
        disabled = profile["entitlement"]["adFree"] or not profile["preferences"]["adsEnabled"]
        return {"placementId": placement_id, "eligible": not disabled, "copy": None if disabled else placement["safePromotionalCopy"], "targeting": "none", "disabledConditions": deepcopy(placement["disabledConditions"])}

    def record_event(self, profile_id: str, event_type: str, properties: dict[str, Any]) -> dict[str, Any]:
        self._profile(profile_id)
        if event_type not in EVENT_TYPES:
            raise PlatformError("invalid_analytics_event", "That analytics event type is not allowed.")
        allowed = {"questId", "questionId", "sentenceId", "petId", "accessoryId", "shopItemId", "battlePassId", "bookId", "screen"}
        if not isinstance(properties, dict) or not set(properties).issubset(allowed) or not all(isinstance(value, str) for value in properties.values()):
            raise PlatformError("unsafe_analytics_properties", "Analytics properties must be approved, non-identifying string IDs.")
        event = {"id": f"event-{uuid4().hex}", "profileId": profile_id, "eventType": event_type, "properties": deepcopy(properties), "occurredAt": utc_now()}
        self.events.append(event)
        return deepcopy(event)


class SQLiteStore(DemoStore):
    """SQLite implementation; state remains anonymous and contains no payment details."""

    def __init__(self, catalogs: dict[str, Any], database_path: str | Path):
        self.connection = sqlite3.connect(str(database_path), check_same_thread=False)
        self.connection.row_factory = sqlite3.Row
        self._migrate()
        super().__init__(catalogs)
        for row in self.connection.execute("SELECT state_json FROM profiles"):
            profile = json.loads(row["state_json"])
            self.profiles[profile["id"]] = profile

    def _migrate(self) -> None:
        self.connection.executescript(MIGRATION_PATH.read_text(encoding="utf-8"))
        self.connection.execute("INSERT OR IGNORE INTO schema_migrations(version, applied_at) VALUES(1, ?)", (utc_now(),))
        self.connection.commit()

    def _save(self, profile: dict[str, Any]) -> None:
        state = json.dumps(profile, separators=(",", ":"))
        self.connection.execute(
            """INSERT INTO profiles(profile_id, display_name, xp, level, state_json, created_at, updated_at)
            VALUES(?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(profile_id) DO UPDATE SET display_name=excluded.display_name, xp=excluded.xp,
            level=excluded.level, state_json=excluded.state_json, updated_at=excluded.updated_at""",
            (profile["id"], profile["displayName"], profile["xp"], profile["level"], state, profile["createdAt"], profile["updatedAt"]),
        )
        self.connection.execute("DELETE FROM currencies WHERE profile_id = ?", (profile["id"],))
        self.connection.executemany("INSERT INTO currencies VALUES(?, ?, ?)", [(profile["id"], currency, balance) for currency, balance in profile["currencies"].items()])
        self.connection.execute("DELETE FROM inventory WHERE profile_id = ?", (profile["id"],))
        inventory = [(profile["id"], "pet", pet_id, 1) for pet_id in profile["ownedPetIds"]]
        inventory.extend((profile["id"], "accessory", item_id, 1) for item_id in profile["ownedAccessoryIds"])
        inventory.extend((profile["id"], "egg", item_id, quantity) for item_id, quantity in profile["eggInventory"].items())
        self.connection.executemany("INSERT INTO inventory VALUES(?, ?, ?, ?)", inventory)
        self.connection.execute("DELETE FROM entitlements WHERE profile_id = ?", (profile["id"],))
        entitlement = profile["entitlement"]
        self.connection.execute("INSERT INTO entitlements VALUES(?, ?, ?, ?, ?, ?)", (profile["id"], entitlement["plan"], entitlement["status"], entitlement["startsAt"], entitlement["endsAt"], json.dumps(entitlement["featureFlags"])))
        self.connection.execute("DELETE FROM wishlists WHERE profile_id = ?", (profile["id"],))
        self.connection.executemany(
            "INSERT INTO wishlists VALUES(?, ?, ?)",
            [(profile["id"], item["itemType"], item["catalogId"]) for item in profile["wishlist"]],
        )
        self.connection.execute("DELETE FROM rewards WHERE profile_id = ?", (profile["id"],))
        self.connection.executemany(
            "INSERT INTO rewards VALUES(?, ?, ?, ?, ?, ?, ?)",
            [
                (item["id"], profile["id"], item["rewardId"], item["claimStatus"], item["source"], item["issuedAt"], item.get("claimedAt"))
                for item in profile["rewardInstances"]
            ],
        )
        self.connection.execute("DELETE FROM purchases WHERE profile_id = ?", (profile["id"],))
        self.connection.executemany(
            "INSERT INTO purchases VALUES(?, ?, ?, ?, ?, ?, ?, ?)",
            [
                (item["id"], profile["id"], item["shopItemId"], item["price"], item["currency"], int(item["reversible"]), item.get("reversedAt"), item["createdAt"])
                for item in profile["purchaseLedger"]
            ],
        )
        self.connection.execute("DELETE FROM battle_pass_progress WHERE profile_id = ?", (profile["id"],))
        self.connection.executemany(
            "INSERT INTO battle_pass_progress VALUES(?, ?, ?, ?)",
            [(profile["id"], pass_id, state["progress"], json.dumps(state["claimedRewardIds"])) for pass_id, state in profile["battlePassProgress"].items()],
        )
        self.connection.commit()

    def record_event(self, profile_id: str, event_type: str, properties: dict[str, Any]) -> dict[str, Any]:
        event = super().record_event(profile_id, event_type, properties)
        self.connection.execute("INSERT INTO analytics_events VALUES(?, ?, ?, ?, ?)", (event["id"], profile_id, event_type, json.dumps(properties), event["occurredAt"]))
        self.connection.commit()
        return event

    def close(self) -> None:
        self.connection.close()


def create_store(catalogs: dict[str, Any]) -> DemoStore:
    """Use configured SQLite when available; fall back to deterministic process memory."""
    if os.getenv("LITLEARN_FORCE_MEMORY") == "1":
        return DemoStore(catalogs)
    path = os.getenv("LITLEARN_DATABASE_PATH") or str(Path(tempfile.gettempdir()) / "litlearn-demo.sqlite3")
    try:
        return SQLiteStore(catalogs, path)
    except (OSError, sqlite3.Error):
        return DemoStore(catalogs)
