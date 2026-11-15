# LitLearn API

The API is optional. The browser imports the reviewed files in `backend/data/`
directly, so a learner can complete every bundled quest when this service is
offline.

## `GET /api/health`

Returns the service status.

```json
{"status":"ok","service":"LitLearn API"}
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

`backend/data/platform-catalogs.json` is the reviewable, versioned World
catalog seed (currently schema version 1). The metadata-only web book catalog
lives in `backend/data/books/catalog.json`; reviewed source records live in
`backend/data/books/reviewed-books.json`; exact quest mappings live in
`backend/data/books/quest-mappings.json`. Migrations `001_local_demo_platform.sql`
and `002_book_library_and_progression.sql` create the matching SQLite tables. Set `LITLEARN_DATABASE_PATH` to retain a
local SQLite database; if it cannot open, the service uses deterministic
process-memory state. Set `LITLEARN_FORCE_MEMORY=1` to exercise that fallback.

### Stable objects

| Object | Required contract |
| --- | --- |
| `Pet` | `id`, `name`, `petType`, `rarity`, literary/source metadata, description, `baseArtworkKey`, allowed accessory categories, `eventOnly`, Level Road `unlockLevel`, and no-cost `starterClaim` when applicable |
| `PetAccessory` | `id`, category, `wearableType` (`accessory` or `clothing`), rarity, price/currency, compatible pet types, source/license metadata, availability |
| `PetEgg` | `id`, rarity range, explicit odds, price/currency, possible rewards, duplicate Story Shard compensation, availability |
| `Profile` | anonymous `id`, display name, XP/level, one authoritative Leaf Tokens/Story Shards/Gold/Diamonds wallet, active/owned pets and pet nicknames, equipped accessories, wishlist, collections, permanent book IDs, preferences, local-demo entitlement |
| `Book` | stable `id`, title, author, edition status, category/difficulty/rating, verified-or-explicitly-unverified chapter metadata, source/download guidance, rights/territory/attribution, and free/subscription/purchase-only rules |
| `Reward` | instance ID plus catalog reward ID, `currency`, `accessory`, `pet`, or `egg` type, quantity, rarity, source, and one-way claim status |
| `LevelNode` | deterministic IDs and total-XP thresholds for Levels 1-100, milestone labels, prerequisites, reward IDs, and `{x,y}` map positions |
| `BattlePass` | ID, season/month, plan, reward pool, progress rule, reward IDs, expiration, and per-profile claim state |
| `ShopItem` | item type, catalog ID, price/currency, purchase limit, availability |
| `SubscriptionEntitlement` | plan/status/start/end, feature flags, `adFree`, and book-access level |
| `AdPlacement` | placement ID, allowed plan, safe generic copy, and disabled conditions; it has no targeting fields |

Catalog validation rejects invalid rarity/currency/price, invalid egg odds,
missing rights metadata, non-event Mythicals, unknown catalog links, invalid
wearable types, and any catalog that does not have exactly six no-cost starter
claims. Every pet is Level Road locked; the six starter claims unlock at Levels
1-6. Mythical pets additionally require their event. Egg outcomes are limited
to Common, Rare, Epic, and Legendary; a duplicate is converted to the
catalog's explicit Story Shard compensation. The Level Road provides Gold,
Diamonds, clothing, and reward-only eggs. The seed provides a Basic pass with
one Rare reward and a Premium pass with one Epic reward.

Literary metadata is catalog metadata only. All companions and accessories are
original LitLearn designs, not adaptations of modern film, game, or book
characters. The 100 Project Gutenberg records are **reference-only** until a
work-specific edition review clears text reuse. The catalog returns no third-
party book text. Premium may gate LitLearn tools and levels but never a public
source URL. The reviewed Wizard of Oz excerpt retains its exact 1900 Library
of Congress source mapping; original quest passages retain their bundled JSON
mapping.

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

### Web library and progression additions

- Metadata catalog: `GET /api/books` and `GET /api/books/{bookId}`. These
  return source, edition-status, rights, attribution, access rules, chapter
  metadata, and caching guidance; they never return a third-party full text.
- Exact source mapping: `GET /api/quests/{questId}/book-reference` returns
  the stable book ID, exact edition, verified chapter IDs (or an explicit
  standalone-passage mapping), mapping basis, and bundled passage location.
- Reading: `GET /api/profiles/{profileId}/books/{bookId}/access`,
  `GET .../chapters/{chapterId}`, and `GET .../reader`. Chapter/reader
  retrieval returns either an
  `external-reference`, a `quest-passage-reference`, or a structured
  `unavailable` content result with source attribution and a cache hint.
- Local demo ownership: `POST .../books/{bookId}/purchases/demo` records a
  mock permanent purchase only for a title whose `accessRules` allow it.
  `GET .../library` returns only permanently owned titles and titles currently
  available through an active Premium entitlement. Premium never unlocks a
  `purchase-only` title. `GET .../recommendations` returns stable `bookId`
  values for direct navigation.
- XP: `POST /api/profiles/{profileId}/quests/{questId}/attempts` accepts an
  opaque attempt ID plus `{questionId, choiceId, evidenceSentenceId}` records.
  The server checks reviewed answer/evidence keys and returns a per-question
  correctness/reasoning breakdown. Correct answers earn 20 XP, correct
  supporting evidence for a correct answer earns 10 XP, and incorrect or
  unanswered responses earn zero. Reusing an attempt ID returns
  `duplicate_xp_attempt`. `POST .../xp` is reserved for explicit local
  `demo-seed` values and cannot award quest XP.
- Road and collections: `GET /api/catalog/progression` returns all 100
  Level Road thresholds and milestone rules. `GET .../progress` has the same
  nodes with the profile's unlocked IDs; `GET .../collections` returns
  badges, trophies, achievements, and wishlisted catalog items with earned
  state.

Book-catalog sources use Project Gutenberg's published offline catalog and
link to its Terms of Use, License, and robot/download guidance in every
reference-only record. A source print edition is not treated as verified when
the offline catalog cannot identify it. The generator is
`backend/scripts/generate_gutenberg_catalog.py`; it reads an already-downloaded
offline CSV and deliberately rejects the idea of runtime bulk downloading.

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
{"id":"anon-...","xp":0,"level":1,"currencies":{"leafTokens":150,"storyShards":0,"gold":0,"diamonds":0},"activePetId":null,"entitlement":{"plan":"free","adFree":false,"bookAccessLevel":"demo"}}
```

At Level 1, claim the issued no-cost Moss Mouse reward before selecting or
customizing a pet. All other pets stay locked until their Level Road milestone.

Open a purchased egg deterministically for the demo only after its possible
pet rewards are unlocked on the Level Road. First use `POST
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
