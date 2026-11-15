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

from .book_catalog import book_index, bundled_passage_for_chapter, load_book_catalog, load_book_quizzes
from .catalog import indexed
from .progression import level_for_xp, level_nodes


MIGRATION_PATHS = (
    (1, Path(__file__).resolve().parent / "migrations" / "001_local_demo_platform.sql"),
    (2, Path(__file__).resolve().parent / "migrations" / "002_book_library_and_progression.sql"),
    (3, Path(__file__).resolve().parent / "migrations" / "003_wallet_and_wishlist_pages.sql"),
)
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


def _reward_ids_by_level(catalogs: dict[str, Any]) -> dict[int, list[str]]:
    rewards: dict[int, list[str]] = {}
    for node in catalogs["levelNodes"]:
        level_text = node["id"].removeprefix("level-")
        if level_text.isdigit():
            rewards[int(level_text)] = list(node["rewardIds"])
    return rewards


def _level_for_xp(catalogs: dict[str, Any], xp: int) -> int:
    return level_for_xp(xp, _reward_ids_by_level(catalogs))


class DemoStore:
    """Deterministic in-memory fallback with the same public methods as SQLiteStore."""

    def __init__(self, catalogs: dict[str, Any], books_catalog: dict[str, Any] | None = None):
        self.catalogs = catalogs
        self.pets = indexed(catalogs, "pets")
        self.accessories = indexed(catalogs, "accessories")
        self.eggs = indexed(catalogs, "eggs")
        self.book_catalog = books_catalog or load_book_catalog()
        self.books = book_index(self.book_catalog)
        self.book_activities = {
            activity["id"]: activity for activity in load_book_quizzes(catalog=self.book_catalog)["quizzes"]
        }
        self.book_quizzes = {
            activity_id: activity
            for activity_id, activity in self.book_activities.items()
            if activity["reviewStatus"] == "reviewed"
        }
        self.inventory_items = indexed(catalogs, "inventoryItems")
        self.rewards = indexed(catalogs, "rewards")
        self.passes = indexed(catalogs, "battlePasses")
        self.shop = indexed(catalogs, "shopItems")
        for book in self.books.values():
            offer = book.get("mockPurchase")
            if isinstance(offer, dict):
                self.shop[f"shop-book-{book['id']}"] = {
                    "id": f"shop-book-{book['id']}",
                    "itemType": "book",
                    "catalogId": book["id"],
                    "price": offer["price"],
                    "currency": offer["currency"],
                    "purchaseLimit": 1,
                    "availability": "available",
                    "reversible": bool(offer.get("reversibleUntilRead")),
                }
        self.quest_reward_rules = list(catalogs["questRewardRules"])
        self.profiles: dict[str, dict[str, Any]] = {}
        self.events: list[dict[str, Any]] = []

    def _save(self, profile: dict[str, Any]) -> None:
        """Persistence hook; the in-memory fallback intentionally does nothing."""

    def _profile(self, profile_id: str) -> dict[str, Any]:
        profile = self.profiles.get(profile_id)
        if profile is None:
            raise PlatformError("profile_not_found", "Anonymous profile was not found.", 404)
        legacy_wallet = profile.pop("currencies", {})
        wallet = profile.setdefault("wallet", {})
        if not isinstance(wallet, dict):
            wallet = {}
            profile["wallet"] = wallet
        if profile.get("walletMigrationVersion", 0) < 1:
            wallet["gold"] = int(wallet.get("gold", 0)) + int(legacy_wallet.get("gold", 0)) + int(legacy_wallet.get("leafTokens", 0))
            wallet["diamonds"] = int(wallet.get("diamonds", 0)) + int(legacy_wallet.get("diamonds", 0)) + int(legacy_wallet.get("storyShards", 0))
            profile["walletMigrationVersion"] = 1
        for currency in self.catalogs["currencies"]:
            wallet[currency] = max(0, int(wallet.get(currency, 0)))
        profile["inventory"] = profile.get("inventory") if isinstance(profile.get("inventory"), dict) else {}
        profile["inventory"]["wishlistPages"] = max(0, int(profile["inventory"].get("wishlistPages", 0)))
        profile["wishlist"] = profile.get("wishlist") if isinstance(profile.get("wishlist"), list) else []
        legacy_book_ids = [
            item.get("catalogId")
            for item in profile["wishlist"]
            if isinstance(item, dict) and item.get("itemType") == "book" and item.get("catalogId") in self.books
        ]
        profile["wishlist"] = [
            item for item in profile["wishlist"]
            if not (isinstance(item, dict) and item.get("itemType") == "book")
        ]
        requested_book_ids = profile.get("bookWishlistIds", [])
        if not isinstance(requested_book_ids, list):
            requested_book_ids = []
        profile["bookWishlistIds"] = list(dict.fromkeys(
            book_id for book_id in [*requested_book_ids, *legacy_book_ids] if book_id in self.books
        ))
        feature_flags = profile["entitlement"].setdefault("featureFlags", {})
        feature_flags.setdefault("advancedVocabulary", feature_flags.get("expandedVocabulary", False))
        profile.setdefault("ownedBookIds", [])
        profile.setdefault("bookPurchaseLedger", [])
        profile.setdefault("questAttempts", [])
        profile.setdefault("wishlistRedemptions", [])
        profile.setdefault("collectionState", {"badges": [], "achievements": [], "trophies": []})
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
        now = utc_now()
        profile = {
            "id": profile_id,
            "displayName": name,
            "xp": 0,
            "level": 1,
            "wallet": {"gold": 150, "diamonds": 0},
            "walletMigrationVersion": 1,
            "inventory": {"wishlistPages": 0},
            "activePetId": None,
            "ownedPetIds": [],
            "petNames": {},
            "ownedAccessoryIds": [],
            "equippedAccessories": {},
            "eggInventory": {},
            "wishlist": [],
            "bookWishlistIds": [],
            "badges": [],
            "achievements": [],
            "bookmarks": [],
            "preferences": {"adsEnabled": True, "soundEnabled": False, "theme": "system"},
            "entitlement": self._entitlement(demo_plan, now),
            "rewardInstances": [],
            "purchaseLedger": [],
            "ownedBookIds": [],
            "bookPurchaseLedger": [],
            "questAttempts": [],
            "wishlistRedemptions": [],
            "collectionState": {"badges": [], "achievements": [], "trophies": []},
            "battlePassProgress": {},
            "grantedNodeIds": [],
            "createdAt": now,
            "updatedAt": now,
        }
        self.profiles[profile_id] = profile
        self._sync_level_nodes(profile)
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

    @staticmethod
    def _premium_active(profile: dict[str, Any]) -> bool:
        entitlement = profile["entitlement"]
        ends_at = entitlement.get("endsAt")
        return bool(
            entitlement["featureFlags"].get("fullBooks")
            and (ends_at is None or not is_expired(ends_at))
        )

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
        return {"profileId": profile_id, "wallet": deepcopy(profile["wallet"]), "inventory": deepcopy(profile["inventory"])}

    def shop_catalog(self) -> list[dict[str, Any]]:
        """Return the local-demo shop, including catalog-defined book offers."""
        return [deepcopy(item) for _, item in sorted(self.shop.items())]

    @staticmethod
    def _book_attribution(book: dict[str, Any]) -> dict[str, Any]:
        """Expose rights metadata without exposing an external reader URL."""
        return {
            "sourceReference": f"Project Gutenberg eBook #{book['source']['ebookId']}",
            "sourceLabel": f"Project Gutenberg eBook #{book['source']['ebookId']}",
            "accessedAt": book["source"]["accessedAt"],
            "ebookLicenseReviewStatus": book["source"]["ebookLicenseReviewStatus"],
            "edition": book["edition"],
            "rightsStatus": book["rightsStatus"],
            "license": book["rights"]["license"],
            "territory": book["rights"]["territory"],
            "requiredAttribution": book["rights"]["requiredAttribution"],
        }

    def public_book(self, book_id: str) -> dict[str, Any]:
        """Return a metadata record safe for the in-app reader catalog.

        Source URLs remain in the reviewed authoring data, but are deliberately
        omitted from this browser contract so readers are never redirected to a
        third-party host.  Content is either a reviewed bundled passage or an
        explicit unavailable result from the chapter endpoint.
        """
        book = self._catalog_item(self.books, book_id, "book")
        return {
            "id": book["id"],
            "title": book["title"],
            "author": book["author"],
            "edition": book["edition"],
            "category": book["category"],
            "difficultyLabel": book["difficultyLabel"],
            "starRating": book["starRating"],
            "ratingBasis": book["ratingBasis"],
            "chapterBoundaryStatus": book["chapterBoundaryStatus"],
            "sourceReference": f"Project Gutenberg eBook #{book['source']['ebookId']}",
            "source": {
                "provider": book["source"]["provider"],
                "ebookId": book["source"]["ebookId"],
                "accessedAt": book["source"]["accessedAt"],
                "ebookLicenseReviewStatus": book["source"]["ebookLicenseReviewStatus"],
            },
            "chapterMetadata": [
                {
                    "id": chapter["id"],
                    "title": chapter["title"],
                    "accessTier": chapter["accessTier"],
                    "access": deepcopy(chapter["access"]),
                    "readingLevels": deepcopy(chapter["readingLevels"]),
                    "contentAvailability": chapter["contentAvailability"],
                }
                for chapter in book["chapterMetadata"]
            ],
            "quizIds": [
                quiz["id"] for quiz in self.book_quizzes.values() if quiz["bookId"] == book_id
            ],
            "accessRules": {
                key: deepcopy(book["accessRules"][key])
                for key in (
                    "mode",
                    "freeLevelRange",
                    "freeChapterIds",
                    "subscriptionEligible",
                    "permanentPurchaseEligible",
                )
            },
            "access": deepcopy(book["access"]),
            "contentAvailability": book["contentAvailability"],
            "rightsStatus": book["rightsStatus"],
            "license": book["license"],
            "territory": book["territory"],
            "requiredAttribution": book["requiredAttribution"],
            "rights": deepcopy(book["rights"]),
            "attribution": self._book_attribution(book),
        }

    def public_books(self) -> list[dict[str, Any]]:
        return [self.public_book(book_id) for book_id in sorted(self.books)]

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
        if profile["activePetId"] is None:
            raise PlatformError("active_pet_required", "Claim and select a Level Road pet before equipping accessories.", 409)
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
        if item_type == "book":
            result = self.change_book_wishlist(profile_id, catalog_id, add)
            return result | {"wishlist": deepcopy(profile["wishlist"])}
        item = {"itemType": item_type, "catalogId": catalog_id}
        if add and item not in profile["wishlist"]:
            profile["wishlist"].append(item)
        if not add:
            profile["wishlist"] = [entry for entry in profile["wishlist"] if entry != item]
        self._touch(profile)
        return {"wishlist": deepcopy(profile["wishlist"])}

    def book_wishlist(self, profile_id: str) -> dict[str, Any]:
        profile = self._profile(profile_id)
        return {"bookWishlistIds": deepcopy(profile["bookWishlistIds"])}

    def change_book_wishlist(self, profile_id: str, book_id: str, add: bool) -> dict[str, Any]:
        profile = self._profile(profile_id)
        self._catalog_item(self.books, book_id, "book")
        if add and book_id not in profile["bookWishlistIds"]:
            profile["bookWishlistIds"].append(book_id)
        if not add:
            profile["bookWishlistIds"] = [item for item in profile["bookWishlistIds"] if item != book_id]
        self._touch(profile)
        return self.book_wishlist(profile_id)

    def _sync_level_nodes(self, profile: dict[str, Any]) -> None:
        """Issue each reached Level Road reward exactly once."""
        for node in level_nodes(_reward_ids_by_level(self.catalogs)):
            if node["requiredXp"] <= profile["xp"] and node["id"] not in profile["grantedNodeIds"]:
                profile["grantedNodeIds"].append(node["id"])
                for reward_id in node["rewardIds"]:
                    self._issue_reward(profile, reward_id, f"level-road:{node['id']}")

    def _apply_xp(self, profile: dict[str, Any], amount: int) -> dict[str, Any]:
        profile["xp"] += amount
        profile["level"] = _level_for_xp(self.catalogs, profile["xp"])
        self._sync_level_nodes(profile)
        self._touch(profile)
        return self.progress(profile["id"])

    def add_xp(self, profile_id: str, amount: int, source: str) -> dict[str, Any]:
        if source != "demo-seed" or not isinstance(amount, int) or not 1 <= amount <= 500:
            raise PlatformError("invalid_xp_award", "XP awards require a 1–500 quest-complete or demo-seed value.")
        profile = self._profile(profile_id)
        return self._apply_xp(profile, amount)

    def award_quest_attempt(
        self,
        profile_id: str,
        quest: dict[str, Any],
        attempt_id: str,
        responses: list[dict[str, Any]],
    ) -> dict[str, Any]:
        """Award answer and evidence XP once, using reviewed question keys only."""
        if not isinstance(attempt_id, str) or not attempt_id.strip() or len(attempt_id) > 80:
            raise PlatformError("invalid_attempt_id", "A short, non-empty client attempt ID is required.")
        if not isinstance(responses, list):
            raise PlatformError("invalid_quest_responses", "Quest responses must be a list.")
        profile = self._profile(profile_id)
        if any(attempt["attemptId"] == attempt_id for attempt in profile["questAttempts"]):
            raise PlatformError("duplicate_xp_attempt", "That quest attempt has already received its XP award.", 409)
        if any(attempt["questId"] == quest["id"] for attempt in profile["questAttempts"]):
            raise PlatformError("duplicate_quest_reward", "This quest already has a recorded XP attempt for this profile.", 409)
        questions = {question["id"]: question for question in quest["questions"]}
        supplied = {response.get("questionId"): response for response in responses if isinstance(response, dict)}
        breakdown: list[dict[str, Any]] = []
        awarded = 0
        for question_id, question in questions.items():
            response = supplied.get(question_id, {})
            answer_correct = response.get("choiceId") == question["correctChoiceId"]
            evidence_correct = response.get("evidenceSentenceId") == question["correctEvidenceSentenceId"]
            answer_xp = 20 if answer_correct else 0
            reasoning_xp = 10 if answer_correct and evidence_correct else 0
            awarded += answer_xp + reasoning_xp
            breakdown.append(
                {
                    "questionId": question_id,
                    "answerCorrect": answer_correct,
                    "evidenceCorrect": evidence_correct,
                    "answerXp": answer_xp,
                    "reasoningXp": reasoning_xp,
                    "awardedXp": answer_xp + reasoning_xp,
                }
            )
        profile["questAttempts"].append(
            {"attemptId": attempt_id, "questId": quest["id"], "awardedXp": awarded, "awardedAt": utc_now()}
        )
        if awarded:
            profile["badges"] = sorted(set(profile["badges"]) | {"first-quest"})
            profile["collectionState"]["badges"] = profile["badges"]
            if any(item["evidenceCorrect"] for item in breakdown):
                profile["achievements"] = sorted(set(profile["achievements"]) | {"evidence-finder"})
                profile["collectionState"]["achievements"] = profile["achievements"]
        issued_reward = None
        if awarded:
            rule = next(
                (
                    candidate
                    for candidate in self.quest_reward_rules
                    if quest["id"] in candidate["questIds"]
                    and (not candidate["requiresAwardedXp"] or awarded > 0)
                ),
                None,
            )
            if rule is not None:
                issued_reward = self._issue_reward(profile, rule["rewardId"], f"quest:{quest['id']}")
        progress = self._apply_xp(profile, awarded)
        return {
            "questId": quest["id"],
            "attemptId": attempt_id,
            "awardedXp": awarded,
            "breakdown": breakdown,
            "progress": progress,
            "issuedReward": deepcopy(issued_reward) if issued_reward else None,
        }

    def _issue_reward(self, profile: dict[str, Any], reward_id: str, source: str) -> dict[str, Any]:
        reward = self._catalog_item(self.rewards, reward_id, "reward")
        existing = next(
            (
                instance
                for instance in profile["rewardInstances"]
                if instance["rewardId"] == reward_id and instance["source"] == source
            ),
            None,
        )
        if existing is not None:
            return existing
        stable_key = hashlib.sha256(f"{profile['id']}:{source}:{reward_id}".encode()).hexdigest()[:24]
        instance = {
            "id": f"reward-{stable_key}",
            "rewardId": reward_id,
            "source": source,
            "claimStatus": "unclaimed",
            "issuedAt": utc_now(),
        }
        profile["rewardInstances"].append(instance)
        return instance

    def progress(self, profile_id: str) -> dict[str, Any]:
        profile = self._profile(profile_id)
        nodes = level_nodes(_reward_ids_by_level(self.catalogs))
        unlocked = [node["id"] for node in nodes if node["requiredXp"] <= profile["xp"]]
        return {"xp": profile["xp"], "level": profile["level"], "levelNodes": nodes, "unlockedNodeIds": unlocked, "badges": deepcopy(profile["badges"]), "achievements": deepcopy(profile["achievements"]), "trophies": deepcopy(self.catalogs["trophies"])}

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
            profile["wallet"][catalog_id] = profile["wallet"].get(catalog_id, 0) + quantity
        elif item_type == "accessory":
            if catalog_id not in profile["ownedAccessoryIds"]:
                profile["ownedAccessoryIds"].append(catalog_id)
        elif item_type == "pet":
            pet = self._catalog_item(self.pets, catalog_id, "pet")
            if profile["level"] < pet["unlockLevel"]:
                raise PlatformError("pet_level_locked", "That pet is still locked on the Level Road.", 403)
            if pet["eventOnly"]:
                raise PlatformError("pet_event_locked", "That Mythical pet requires its active event as well as the Level Road.", 403)
            if catalog_id not in profile["ownedPetIds"]:
                profile["ownedPetIds"].append(catalog_id)
        elif item_type == "egg":
            profile["eggInventory"][catalog_id] = profile["eggInventory"].get(catalog_id, 0) + quantity
        elif item_type == "inventory":
            self._catalog_item(self.inventory_items, catalog_id, "inventory item")
            key = "wishlistPages" if catalog_id == "wishlist-page" else catalog_id
            profile["inventory"][key] = profile["inventory"].get(key, 0) + quantity
        elif item_type == "book":
            self._catalog_item(self.books, catalog_id, "book")
            if catalog_id not in profile["ownedBookIds"]:
                profile["ownedBookIds"].append(catalog_id)
        else:
            raise PlatformError("invalid_reward", "Reward has an unsupported item type.")

    def purchase(self, profile_id: str, shop_item_id: str) -> dict[str, Any]:
        profile = self._profile(profile_id)
        item = self._catalog_item(self.shop, shop_item_id, "shop item")
        if item["availability"] not in {"available", "demo-only"}:
            raise PlatformError("unavailable_shop_item", "That shop item is not currently available.", 409)
        purchases = [entry for entry in profile["purchaseLedger"] if entry["shopItemId"] == shop_item_id and not entry.get("reversedAt")]
        if len(purchases) >= item["purchaseLimit"]:
            raise PlatformError("purchase_limit_reached", "This demo purchase limit has been reached.", 409)
        balance = profile["wallet"].get(item["currency"], 0)
        if balance < item["price"]:
            raise PlatformError("insufficient_currency", "There is not enough currency for this item.", 409)
        profile["wallet"][item["currency"]] -= item["price"]
        quantity = item.get("quantity", 1)
        self._grant(profile, item["itemType"], item["catalogId"], quantity)
        purchase = {
            "id": f"purchase-{uuid4().hex}",
            "shopItemId": shop_item_id,
            "itemType": item["itemType"],
            "catalogId": item["catalogId"],
            "quantity": quantity,
            "price": item["price"],
            "currency": item["currency"],
            "reversible": bool(item.get("reversible", True)),
            "mocked": True,
            "createdAt": utc_now(),
        }
        profile["purchaseLedger"].append(purchase)
        if item["itemType"] == "book":
            profile["bookPurchaseLedger"].append(
                {
                    "id": purchase["id"],
                    "purchaseId": purchase["id"],
                    "bookId": item["catalogId"],
                    "price": item["price"],
                    "currency": item["currency"],
                    "mocked": True,
                    "reversible": purchase["reversible"],
                    "createdAt": purchase["createdAt"],
                }
            )
        self._touch(profile)
        result = deepcopy(purchase) | {
            "wallet": deepcopy(profile["wallet"]),
            "inventory": deepcopy(profile["inventory"]),
        }
        if item["itemType"] == "book":
            result |= {
                "bookId": item["catalogId"],
                "ownership": "permanent",
                "ownedBookIds": deepcopy(profile["ownedBookIds"]),
            }
        return result

    def reverse_purchase(self, profile_id: str, purchase_id: str) -> dict[str, Any]:
        profile = self._profile(profile_id)
        purchase = next((entry for entry in profile["purchaseLedger"] if entry["id"] == purchase_id), None)
        if purchase is None:
            raise PlatformError("purchase_not_found", "Demo purchase was not found.", 404)
        if purchase.get("reversedAt") or not purchase["reversible"]:
            raise PlatformError("purchase_not_reversible", "That purchase cannot be reversed.", 409)
        item = self.shop[purchase["shopItemId"]]
        quantity = purchase.get("quantity", 1)
        if item["itemType"] == "egg":
            if profile["eggInventory"].get(item["catalogId"], 0) < quantity:
                raise PlatformError("purchase_not_reversible", "An opened egg purchase cannot be reversed.", 409)
            profile["eggInventory"][item["catalogId"]] -= quantity
        elif item["catalogId"] in profile["equippedAccessories"].values():
            raise PlatformError("purchase_not_reversible", "Unequip an accessory before reversing its purchase.", 409)
        elif item["itemType"] == "accessory":
            profile["ownedAccessoryIds"].remove(item["catalogId"])
        elif item["itemType"] == "book":
            if item["catalogId"] not in profile["ownedBookIds"]:
                raise PlatformError("purchase_not_reversible", "That book is no longer owned by this local profile.", 409)
            profile["ownedBookIds"].remove(item["catalogId"])
            profile["bookPurchaseLedger"] = [
                entry for entry in profile["bookPurchaseLedger"] if entry.get("purchaseId", entry["id"]) != purchase_id
            ]
        elif item["itemType"] == "inventory":
            key = "wishlistPages" if item["catalogId"] == "wishlist-page" else item["catalogId"]
            if profile["inventory"].get(key, 0) < quantity:
                raise PlatformError("purchase_not_reversible", "The purchased inventory item has already been used.", 409)
            profile["inventory"][key] -= quantity
        elif item["itemType"] == "currency":
            if profile["wallet"].get(item["catalogId"], 0) < quantity:
                raise PlatformError("purchase_not_reversible", "The purchased wallet value has already been used.", 409)
            profile["wallet"][item["catalogId"]] -= quantity
        purchase["reversedAt"] = utc_now()
        profile["wallet"][purchase["currency"]] += purchase["price"]
        self._touch(profile)
        return {"id": purchase_id, "reversed": True, "wallet": deepcopy(profile["wallet"]), "inventory": deepcopy(profile["inventory"])}

    def open_egg(self, profile_id: str, egg_id: str, deterministic: bool = True) -> dict[str, Any]:
        profile = self._profile(profile_id)
        egg = self._catalog_item(self.eggs, egg_id, "egg")
        if profile["eggInventory"].get(egg_id, 0) < 1:
            raise PlatformError("egg_not_owned", "Purchase this egg before opening it.", 409)
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
        pet = self.pets[pet_id]
        if profile["level"] < pet["unlockLevel"]:
            raise PlatformError("pet_level_locked", "Reach this pet's Level Road milestone before opening its egg reward.", 403)
        profile["eggInventory"][egg_id] -= 1
        duplicate = pet_id in profile["ownedPetIds"]
        if duplicate:
            compensation = egg["duplicateBehavior"]
            profile["wallet"][compensation["currency"]] += compensation["quantity"]
            result = {"petId": pet_id, "rarity": rarity, "duplicate": True, "compensation": deepcopy(compensation)}
        else:
            profile["ownedPetIds"].append(pet_id)
            result = {"petId": pet_id, "rarity": rarity, "duplicate": False, "compensation": None}
        self._touch(profile)
        return result | {"deterministicDemo": deterministic, "wallet": deepcopy(profile["wallet"])}

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
        rules = book.get("accessRules")
        if rules is None:
            raise PlatformError("book_contract_unavailable", "This legacy book lacks the web-library access contract.", 503)
        premium = self._premium_active(profile)
        permanently_owned = book_id in profile["ownedBookIds"]
        if feature == "chapter":
            chapter = next((item for item in book["chapterMetadata"] if item["id"] == chapter_id), None)
            if chapter is None:
                raise PlatformError("chapter_not_found", "Chapter metadata was not found.", 404)
            if permanently_owned:
                allowed, reason = True, "permanent-purchase"
            elif rules["mode"] == "free" or chapter_id in rules["freeChapterIds"]:
                allowed, reason = True, "free-pass"
            elif rules["mode"] == "purchase-only":
                allowed, reason = False, "purchase-required"
            elif rules["subscriptionEligible"] and premium:
                allowed, reason = True, "premium-subscription"
            else:
                allowed, reason = False, "premium-required"
        elif feature in {"vocabulary", "quiz"}:
            content_tier = chapter_id or "basic"
            if content_tier not in {"basic", "advanced"}:
                label = "Vocabulary tier" if feature == "vocabulary" else "Quiz difficulty"
                code = "invalid_vocabulary_tier" if feature == "vocabulary" else "invalid_quiz_difficulty"
                raise PlatformError(code, f"{label} must be basic or advanced.")
            if permanently_owned:
                allowed, reason = True, "permanent-purchase"
            elif rules["mode"] == "purchase-only":
                allowed, reason = False, "purchase-required"
            elif content_tier == "basic":
                allowed, reason = True, "basic-feature"
            elif rules["subscriptionEligible"] and premium:
                allowed, reason = True, "premium-subscription"
            else:
                allowed, reason = False, "premium-required"
        else:
            raise PlatformError("invalid_access_feature", "Access feature must be chapter, vocabulary, or quiz.")
        state = (
            "owned"
            if permanently_owned
            else "purchase-only"
            if reason == "purchase-required"
            else "free"
            if reason in {"free-pass", "basic-feature"}
            else "premium"
        )
        return {
            "bookId": book_id,
            "feature": feature,
            "requested": chapter_id,
            "allowed": allowed,
            "state": state,
            "reason": reason,
            "requiredPlan": "purchase" if state == "purchase-only" else state,
            "inAppContentAvailable": book["contentAvailability"] == "bundled-passage",
            "entitlement": self.subscription(profile_id),
        }

    def quizzes_for_book(self, book_id: str | None = None) -> list[dict[str, Any]]:
        quizzes = self.book_quizzes.values()
        if book_id is not None:
            self._catalog_item(self.books, book_id, "book")
            quizzes = (quiz for quiz in quizzes if quiz["bookId"] == book_id)
        return [deepcopy(quiz) for quiz in sorted(quizzes, key=lambda quiz: quiz["id"])]

    def activities_for_book(self, book_id: str | None = None) -> list[dict[str, Any]]:
        """Return reviewed activities only; drafts and generated items stay internal."""
        return self.quizzes_for_book(book_id)

    def quiz_access(self, profile_id: str, book_id: str, quiz_id: str) -> dict[str, Any]:
        quiz = self._catalog_item(self.book_quizzes, quiz_id, "book quiz")
        if quiz["bookId"] != book_id:
            raise PlatformError("quiz_book_mismatch", "This quiz does not belong to the requested book.", 409)
        access = self.book_access(profile_id, book_id, quiz["accessTier"], "quiz")
        return deepcopy(quiz) | {"access": access}

    def chapter(self, profile_id: str, book_id: str, chapter_id: str) -> dict[str, Any]:
        book = self._catalog_item(self.books, book_id, "book")
        chapter = next((item for item in book["chapterMetadata"] if item["id"] == chapter_id), None)
        if chapter is None:
            raise PlatformError("chapter_not_found", "Chapter metadata was not found.", 404)
        access = self.book_access(profile_id, book_id, chapter_id)
        if not access["allowed"]:
            content = {"mode": "unavailable", "reason": access["reason"], "cacheHint": "Do not cache unavailable content."}
        else:
            sentences = bundled_passage_for_chapter(book_id, chapter_id, self.book_catalog)
            content = (
                {
                    "mode": "bundled-passage",
                    "sentences": sentences,
                    "cacheHint": "Cache reviewed bundled reader content by book and chapter ID; do not store it in learner progress.",
                }
                if sentences
                else {"mode": "unavailable", "reason": "chapter_content_unavailable", "cacheHint": "No reviewed in-app text is bundled for this chapter."}
            )
        return {"bookId": book_id, "chapterId": chapter_id, "access": access, "content": content, "attribution": self._book_attribution(book)}

    def reader_reference(self, profile_id: str, book_id: str) -> dict[str, Any]:
        """Return a safe in-app reader status; this endpoint never redirects."""
        profile = self._profile(profile_id)
        book = self._catalog_item(self.books, book_id, "book")
        bundled_chapter = next(
            (chapter for chapter in book["chapterMetadata"] if chapter["contentAvailability"] == "bundled-passage"),
            None,
        )
        if bundled_chapter is None:
            content = {"mode": "unavailable", "reason": "book_content_unavailable", "cacheHint": "No reviewed in-app text is bundled for this title."}
        else:
            chapter_result = self.chapter(profile_id, book_id, bundled_chapter["id"])
            content = chapter_result["content"]
        return {
            "bookId": book_id,
            "readerFeature": "in-app-bundled-content",
            "litLearnAccess": "available" if content["mode"] == "bundled-passage" else "unavailable",
            "content": content,
            "attribution": self._book_attribution(book),
        }

    def purchase_book(self, profile_id: str, book_id: str) -> dict[str, Any]:
        book = self._catalog_item(self.books, book_id, "book")
        rules = book["accessRules"]
        if not rules["permanentPurchaseEligible"]:
            raise PlatformError("book_not_purchaseable", "This title is not a permanent-purchase demo item.", 409)
        if f"shop-book-{book_id}" not in self.shop:
            raise PlatformError("book_purchase_unavailable", "No local-demo purchase offer is defined.", 409)
        purchase = self.purchase(profile_id, f"shop-book-{book_id}")
        return purchase | {"bookId": book_id}

    def library(self, profile_id: str) -> list[dict[str, Any]]:
        profile = self._profile(profile_id)
        premium = self._premium_active(profile)
        result = []
        for book in self.books.values():
            rules = book["accessRules"]
            owned = book["id"] in profile["ownedBookIds"]
            subscription = premium and rules["subscriptionEligible"] and rules["mode"] != "purchase-only"
            if owned or subscription:
                result.append({"bookId": book["id"], "access": "permanent" if owned else "subscription", "title": book["title"], "contentAvailability": book["contentAvailability"]})
        return sorted(result, key=lambda item: item["bookId"])

    def redeem_wishlist_pages(self, profile_id: str) -> dict[str, Any]:
        """Atomically spend five pages for one deterministic eligible book.

        The seed uses only stable local profile data and the redemption serial,
        making the demo's "random" result replayable for tests without exposing
        a client-controlled choice.  No state changes until an eligible title is
        known and the profile holds all five pages.
        """
        profile = self._profile(profile_id)
        candidates = sorted(
            {
                book_id
                for book_id in profile["bookWishlistIds"]
                if book_id in self.books and book_id not in profile["ownedBookIds"]
            }
        )
        if not candidates:
            raise PlatformError("no_eligible_wishlist_book", "Add an unowned catalog book to the wishlist before redeeming Wishlist Pages.", 409)
        if profile["inventory"]["wishlistPages"] < 5:
            raise PlatformError("insufficient_wishlist_pages", "Five Wishlist Pages are required for redemption.", 409)
        serial = len(profile["wishlistRedemptions"]) + 1
        seed = f"{profile_id}:wishlist-redemption:{serial}"
        selected_book_id = candidates[int(hashlib.sha256(seed.encode()).hexdigest(), 16) % len(candidates)]
        profile["inventory"]["wishlistPages"] -= 5
        profile["ownedBookIds"].append(selected_book_id)
        redemption = {
            "redemptionId": f"wishlist-redemption-{hashlib.sha256(seed.encode()).hexdigest()[:24]}",
            "selectedBookId": selected_book_id,
            "consumedPages": 5,
            "ownership": "permanent",
            "redeemedAt": utc_now(),
        }
        profile["wishlistRedemptions"].append(redemption)
        self._touch(profile)
        return deepcopy(redemption) | {"wallet": deepcopy(profile["wallet"]), "inventory": deepcopy(profile["inventory"])}

    def recommendations(self, profile_id: str, limit: int = 6) -> list[dict[str, Any]]:
        profile = self._profile(profile_id)
        candidates = [book for book in self.books.values() if book["id"] not in profile["ownedBookIds"]]
        ordered = sorted(candidates, key=lambda book: (book["difficultyLabel"], book["id"]))[:max(1, min(limit, 12))]
        return [{"bookId": book["id"], "reason": "Matches the current LitLearn catalog path.", "title": book["title"]} for book in ordered]

    def collections(self, profile_id: str) -> dict[str, Any]:
        profile = self._profile(profile_id)
        return {
            "badges": [{**item, "earned": item["id"] in profile["badges"]} for item in self.catalogs["badges"]],
            "achievements": [{**item, "earned": item["id"] in profile["achievements"]} for item in self.catalogs["achievements"]],
            "trophies": [{**item, "earned": item["id"] in profile["collectionState"]["trophies"]} for item in self.catalogs["trophies"]],
            "wishlist": deepcopy(profile["wishlist"]),
            "bookWishlistIds": deepcopy(profile["bookWishlistIds"]),
        }

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
        for row in self.connection.execute("SELECT state_json FROM profiles").fetchall():
            profile = json.loads(row["state_json"])
            self.profiles[profile["id"]] = profile
        # Persist the one-time wallet conversion for legacy local profiles as
        # soon as they are read, so a restart cannot convert the old balances
        # again.
        for profile_id in list(self.profiles):
            self._profile(profile_id)
            self._save(self.profiles[profile_id])

    def _migrate(self) -> None:
        first_version, first_path = MIGRATION_PATHS[0]
        self.connection.executescript(first_path.read_text(encoding="utf-8"))
        self.connection.execute(
            "INSERT OR IGNORE INTO schema_migrations(version, applied_at) VALUES(?, ?)",
            (first_version, utc_now()),
        )
        for version, path in MIGRATION_PATHS[1:]:
            applied = self.connection.execute(
                "SELECT 1 FROM schema_migrations WHERE version = ?", (version,)
            ).fetchone()
            if applied is None:
                self.connection.executescript(path.read_text(encoding="utf-8"))
                self.connection.execute(
                    "INSERT INTO schema_migrations(version, applied_at) VALUES(?, ?)", (version, utc_now())
                )
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
        self.connection.executemany("INSERT INTO currencies VALUES(?, ?, ?)", [(profile["id"], currency, balance) for currency, balance in profile["wallet"].items()])
        self.connection.execute("DELETE FROM inventory WHERE profile_id = ?", (profile["id"],))
        inventory = [(profile["id"], "pet", pet_id, 1) for pet_id in profile["ownedPetIds"]]
        inventory.extend((profile["id"], "accessory", item_id, 1) for item_id in profile["ownedAccessoryIds"])
        inventory.extend((profile["id"], "egg", item_id, quantity) for item_id, quantity in profile["eggInventory"].items())
        inventory.extend((profile["id"], "inventory", item_id, quantity) for item_id, quantity in profile["inventory"].items())
        self.connection.executemany("INSERT INTO inventory VALUES(?, ?, ?, ?)", inventory)
        self.connection.execute("DELETE FROM entitlements WHERE profile_id = ?", (profile["id"],))
        entitlement = profile["entitlement"]
        self.connection.execute("INSERT INTO entitlements VALUES(?, ?, ?, ?, ?, ?)", (profile["id"], entitlement["plan"], entitlement["status"], entitlement["startsAt"], entitlement["endsAt"], json.dumps(entitlement["featureFlags"])))
        self.connection.execute("DELETE FROM wishlists WHERE profile_id = ?", (profile["id"],))
        self.connection.executemany(
            "INSERT INTO wishlists VALUES(?, ?, ?)",
            [
                *[(profile["id"], item["itemType"], item["catalogId"]) for item in profile["wishlist"]],
                *[(profile["id"], "book", book_id) for book_id in profile.get("bookWishlistIds", [])],
            ],
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
        self.connection.execute("DELETE FROM book_ownership WHERE profile_id = ?", (profile["id"],))
        purchase_by_book = {entry["bookId"]: entry for entry in profile.get("bookPurchaseLedger", [])}
        self.connection.executemany(
            "INSERT INTO book_ownership VALUES(?, ?, ?, ?)",
            [
                (profile["id"], book_id, purchase_by_book[book_id]["id"], purchase_by_book[book_id]["createdAt"])
                for book_id in profile.get("ownedBookIds", [])
                if book_id in purchase_by_book
            ],
        )
        self.connection.execute(
            """INSERT INTO wallet_migrations(profile_id, migration_version, migrated_at)
            VALUES(?, ?, ?)
            ON CONFLICT(profile_id) DO UPDATE SET migration_version=excluded.migration_version,
            migrated_at=excluded.migrated_at""",
            (profile["id"], profile.get("walletMigrationVersion", 1), profile["updatedAt"]),
        )
        self.connection.execute("DELETE FROM wishlist_redemptions WHERE profile_id = ?", (profile["id"],))
        self.connection.executemany(
            "INSERT INTO wishlist_redemptions VALUES(?, ?, ?, ?, ?)",
            [
                (
                    item["redemptionId"],
                    profile["id"],
                    item["selectedBookId"],
                    item["consumedPages"],
                    item["redeemedAt"],
                )
                for item in profile.get("wishlistRedemptions", [])
            ],
        )
        self.connection.execute("DELETE FROM quest_awards WHERE profile_id = ?", (profile["id"],))
        self.connection.executemany(
            "INSERT INTO quest_awards VALUES(?, ?, ?, ?, ?)",
            [
                (profile["id"], attempt["attemptId"], attempt["questId"], attempt["awardedXp"], attempt["awardedAt"])
                for attempt in profile.get("questAttempts", [])
            ],
        )
        self.connection.execute("DELETE FROM collection_state WHERE profile_id = ?", (profile["id"],))
        collection_rows = []
        for collection_type in ("badges", "achievements", "trophies"):
            collection_rows.extend(
                (profile["id"], collection_type, catalog_id, profile["updatedAt"])
                for catalog_id in profile.get(collection_type, profile.get("collectionState", {}).get(collection_type, []))
            )
        self.connection.executemany("INSERT INTO collection_state VALUES(?, ?, ?, ?)", collection_rows)
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
