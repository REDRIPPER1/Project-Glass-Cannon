# ReadQuest API

The API is optional. The browser imports the reviewed files in `backend/data/`
directly, so a learner can complete every bundled quest when this service is
offline.

## `GET /api/health`

Returns the service status.

```json
{"status":"ok","service":"ReadQuest API"}
```

## `GET /api/quests`

Returns compact reviewed-quest cards. Each card includes its ID, display
metadata, skill tags, and the source rights label/attribution needed by a
catalog view. Passage text and answer keys are intentionally omitted.

## `GET /api/quests/{quest_id}`

Returns the exact reviewed object from `backend/data/quest-*.json`. Its shape
matches the browser's bundled JSON contract.

An unknown ID returns HTTP 404:

```json
{
  "detail": {
    "code": "quest_not_found",
    "message": "No reviewed quest exists with ID '...'."
  }
}
```

If a bundled file is missing, unreadable, or fails validation, list and detail
requests return HTTP 503 with `detail.code` set to
`quest_content_unavailable`. The response deliberately omits internal
validation details; the server log and test suite identify the broken field.

## Reviewed content boundary

Every `quest-*.json` is validated before the API serves any quest. Validation
checks source/rights metadata, a 200–250 word passage, stable sentence IDs,
three same-skill multiple-choice questions, answer keys, worked-example and
question evidence IDs, exact evidence text, and structured story
consequences.

## Optional local-demo platform API

The endpoints below add a separate, optional companion/progression service.
They never replace the bundled quest files or make the reading flow require a
network request. All state is an anonymous local demo profile: do not send a
real name, email address, payment detail, or child identifier.

`backend/data/platform-catalogs.json` is the reviewable, versioned catalog
seed (currently schema version 1). `backend/migrations/001_local_demo_platform.sql`
creates the matching SQLite tables. Set `LITLEARN_DATABASE_PATH` to retain a
local SQLite database; if it cannot open, the service uses deterministic
process-memory state. Set `LITLEARN_FORCE_MEMORY=1` to exercise that fallback.

### Stable objects

| Object | Required contract |
| --- | --- |
| `Pet` | `id`, `name`, `petType`, `rarity`, literary/source metadata, description, `baseArtworkKey`, allowed accessory categories, `eventOnly`, availability |
| `PetAccessory` | `id`, category, `wearableType` (`accessory` or `clothing`), rarity, price/currency, compatible pet types, source/license metadata, availability |
| `PetEgg` | `id`, rarity range, explicit odds, price/currency, possible rewards, duplicate Story Shard compensation, availability |
| `Profile` | anonymous `id`, display name, XP/level, Leaf Tokens, Story Shards, Gold, Diamonds, active/owned pets and pet nicknames, equipped accessories, wishlist, badges, achievements, bookmarks, preferences, local-demo entitlement |
| `Book` | `id`, title, author, edition, chapter metadata, reading/topic/basic-or-advanced vocabulary level, source/rights/license/attribution, access tier |
| `Reward` | instance ID plus catalog reward ID, `currency`, `accessory`, `pet`, or `egg` type, quantity, rarity, source, and one-way claim status |
| `LevelNode` | `id`, required XP, prerequisites, reward IDs, and `{x,y}` map position; reward IDs can grant Gold, Diamonds, clothing, or a fixed-rarity egg |
| `BattlePass` | ID, season/month, plan, reward pool, progress rule, reward IDs, expiration, and per-profile claim state |
| `ShopItem` | item type, catalog ID, price/currency, purchase limit, availability |
| `SubscriptionEntitlement` | plan/status/start/end, feature flags, `adFree`, and book-access level |
| `AdPlacement` | placement ID, allowed plan, safe generic copy, and disabled conditions; it has no targeting fields |

Catalog validation rejects invalid rarity/currency/price, invalid egg odds,
missing rights metadata, non-event Mythicals, unknown catalog links, invalid
wearable types, and any catalog that does not contain exactly six starter
pets. Egg outcomes are limited to Common, Rare, Epic, and Legendary; a
duplicate is converted to the catalog's explicit Story Shard compensation.
The level map defines Gold, Diamonds, clothing, and one reward-only egg for
each non-Mythical rarity. The seed provides six free starters, an event-only
Mythical, a Basic pass with one Rare reward, and a Premium pass with one Epic
reward.

Literary metadata is catalog metadata only. All current companions and
accessories are original LitLearn designs, not adaptations of modern film,
game, or book characters. Books either record a verified U.S. public-domain
basis or original-project rights; the API does not serve new book excerpts.

### Endpoint map

- Profiles: `POST /api/profiles`, `GET/PATCH /api/profiles/{profileId}` and
  `GET .../currencies`;
  `PATCH .../pets/{petId}/name`; `PUT .../active-pet/{petId}`;
  `PUT/DELETE .../accessories/{accessoryId|category}`; and
  `PUT/DELETE .../wishlist/{itemType}/{catalogId}`.
- Catalogs: `GET /api/catalog/pets`, `/pets/{petId}`, `/accessories`,
  `/eggs`, `/events`, `/books`, `/books/{bookId}`, `/shop`, `/badges`,
  `/achievements`, and `/trophies`.
- Progress/rewards: `POST /api/profiles/{profileId}/xp`, `GET .../progress`,
  `GET .../rewards`, and `POST .../rewards/{rewardInstanceId}/claim`.
- Economy: `POST .../purchases`, `POST .../purchases/{purchaseId}/reverse`,
  and `POST .../eggs/{eggId}/open`.
- Access: `GET .../books/{bookId}/chapters/{chapterId}/access`,
  `.../vocabulary/access`, `.../vocabulary/{basic|advanced}/access`, and
  `.../quizzes/{basic|advanced}/access`; plus
  `GET .../subscription` and `POST .../subscription/demo`.
- Battle passes: `GET .../battle-passes`, `GET .../battle-passes/{passId}`,
  `POST .../{passId}/progress`, and `POST .../{passId}/rewards/{rewardId}/claim`.
- Safety/measurement: `GET .../ads/{placementId}` and `POST .../analytics`.

All platform errors use the same compact shape as the quest API:

```json
{"detail":{"code":"insufficient_currency","message":"There is not enough currency for this item."}}
```

### Frontend handoff examples

Create an offline-safe identity only when the UI elects to use the optional
service. `demoPlan` is an explicit local demo entitlement, never a payment:

```http
POST /api/profiles
Content-Type: application/json

{"displayName":"Trail Reader","demoPlan":"free"}
```

```json
{"id":"anon-...","xp":0,"level":1,"currencies":{"leafTokens":150,"storyShards":0,"gold":0,"diamonds":0},"activePetId":"moss-mouse","entitlement":{"plan":"free","adFree":false,"bookAccessLevel":"demo"}}
```

Open a purchased egg deterministically for the demo. First use `POST
.../purchases` with `{"shopItemId":"shop-storybook-egg"}`; the endpoint is
mocked and can be reversed until the egg is opened.

```http
POST /api/profiles/anon-.../eggs/storybook-egg/open
Content-Type: application/json

{"deterministicDemo":true}
```

```json
{"petId":"page-finch","rarity":"Common","duplicate":true,"compensation":{"currency":"storyShards","quantity":30,"description":"A duplicate pet becomes 30 Story Shards; the duplicate pet is not added twice."},"deterministicDemo":true}
```

Free profiles receive only `free-demo` chapters, basic vocabulary, and basic
quizzes. A Premium response has `fullBooks`, `advancedVocabulary`,
`advancedQuizzes`, `premiumBattlePass`, and `adFree` flags. The demo endpoint
requires `{"plan":"premium","demoEntitlement":true}`; there is no payment
API or stored payment information. Ad responses are generic, non-targeted
promotional copy only, and return `{ "eligible": false, "copy": null }` for
Premium or when ads are disabled.

Analytics accepts only the documented product event names and approved opaque
catalog/quest/screen IDs. It rejects names, email, and other identifying
properties. It is not an ad-targeting interface.
