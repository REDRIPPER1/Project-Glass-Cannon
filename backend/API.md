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
`backend/data/books/reviewed-books.json`; verified local chapter-cache entries
live in `backend/data/books/cached-chapter-index.json` and
`cached-chapters/`; exact quest mappings live in
`backend/data/books/quest-mappings.json`. Migrations `001_local_demo_platform.sql`,
`002_book_library_and_progression.sql`, and `003_wallet_and_wishlist_pages.sql`
create the matching SQLite tables. Set `LITLEARN_DATABASE_PATH` to retain a
local SQLite database; if it cannot open, the service uses deterministic
process-memory state. Set `LITLEARN_FORCE_MEMORY=1` to exercise that fallback.

### Stable objects

| Object | Required contract |
| --- | --- |
| `Pet` | `id`, `name`, `petType`, `rarity`, literary/source metadata, description, `baseArtworkKey`, allowed accessory categories, `eventOnly`, Level Road `unlockLevel`, and no-cost `starterClaim` when applicable |
| `PetAccessory` | `id`, category, `wearableType` (`accessory` or `clothing`), rarity, price/currency, compatible pet types, source/license metadata, availability |
| `PetEgg` | `id`, rarity range, explicit odds, price/currency, possible rewards, and duplicate Story Shard conversion credited as Diamonds |
| `Profile` | anonymous `id`, display name, XP/level, authoritative `{gold, diamonds}` wallet, `inventory.wishlistPages`, active/owned pets and pet nicknames, equipped accessories, non-book wishlist items, separate `bookWishlistIds`, collections, permanent book IDs, preferences, local-demo entitlement |
| `Book` | stable `id`, title, author, Project Gutenberg `source.ebookId`, edition, category/difficulty/rating, `sourceReference`, `source.accessedAt`, ebook-license review state, U.S. and worldwide rights status, attribution, `access:{state: free\|premium\|purchase-only,priceDiamonds?}`, verified-or-explicitly-unverified chapter metadata, and in-app availability. Source URLs stay authoring-only. |
| `Chapter` | stable `id`, verified title/boundary status, `contentAvailability`, static `access.state`, and `readingLevels:[{id,label,access}]`; the current response uses `free`, `premium`, or `purchase-only` access labels and never invents a missing chapter |
| `BookActivity` | stable activity ID, `activityType`, review status, target skill, exact book ID/edition/chapter IDs, `sourceLabel`, and mapping basis. Only `reviewed` activities are returned by public catalog endpoints. |
| `Reward` | deterministic instance ID plus catalog reward ID, `currency`, `accessory`, `pet`, `egg`, or `inventory` type, quantity, rarity, source, and one-way claim status |
| `LevelNode` | deterministic IDs and total-XP thresholds for Levels 1-100, milestone labels, prerequisites, reward IDs, and `{x,y}` map positions |
| `BattlePass` | ID, season/month, plan, reward pool, progress rule, reward IDs, expiration, and per-profile claim state |
| `ShopItem` | item type (including `book` and `inventory`), catalog ID, price/currency, purchase limit, availability, and local-only reversibility |
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
characters. The current catalog contains 100 generated Project Gutenberg
metadata records, overlaid by 25 individually reviewed local chapter sets
(789 explicit source chapters), plus the two pre-existing reviewed records.
Generated records that have not
been overlaid are **reference-only** until a work-specific edition review
clears text reuse. The cached set covers Adventure, Mystery, Fantasy and
folklore, Science and nature, Nature and animals, History and biography,
Family stories, and Classics. The browser catalog does not expose third-party
source or reader URLs; it exposes `sourceReference` and required attribution
instead. It can render every verified `cached-chapter` for those 25 exact
editions and the reviewed `bundled-passage` for *The Wonderful Wizard of Oz*,
Chapter I. The one reviewed catalog quiz remains mapped to that exact Project
Gutenberg eBook #55 edition and chapter; no quiz is advertised for an
unreviewed passage.

Every reference record retains a Gutenberg ID and landing page but is marked
`source.accessedAt: null`, `source.ebookLicenseReviewStatus: "review-needed"`,
`rights.usCopyrightStatus: "not-individually-verified"`, and
`rights.worldwideCopyrightStatus: "review-required"` until a title is checked
individually. It is neither readable in-app nor purchaseable. The reviewed
Wizard and Secret Garden records have an access date, a reviewed ebook-license
state, a U.S.-only public-domain status, and a worldwide review requirement.
This deliberately separates a Gutenberg listing from permission to distribute
text worldwide.

### Endpoint map

- Profiles: `POST /api/profiles`, `GET/PATCH /api/profiles/{profileId}` and
  `GET .../currencies`;
  `PATCH .../pets/{petId}/name`; `PUT .../active-pet/{petId}`;
  `PUT/DELETE .../accessories/{accessoryId|category}`; and
  `PUT/DELETE .../wishlist/{itemType}/{catalogId}` for non-book items; and
  `GET`, `PUT`, and `DELETE .../book-wishlist/{bookId}` for the separate,
  stable profile book wishlist.
- Catalogs: `GET /api/catalog/pets`, `/pets/{petId}`, `/accessories`,
  `/eggs`, `/events`, `/books`, `/books/{bookId}`, `/book-quizzes`,
  `/books/{bookId}/quizzes`, `/book-activities`, `/books/{bookId}/activities`,
  `/shop`, `/badges`,
  `/achievements`, and `/trophies`.
- Progress/rewards: `POST /api/profiles/{profileId}/xp`, `GET .../progress`,
  `GET .../rewards`, and `POST .../rewards/{rewardInstanceId}/claim`.
- Economy: `POST .../purchases`, `POST .../purchases/{purchaseId}/reverse`,
  `POST .../wishlist/redemptions`, and `POST .../eggs/{eggId}/open`.
- Access: `GET .../books/{bookId}/chapters/{chapterId}/access`,
  `.../vocabulary/access`, `.../vocabulary/{basic|advanced}/access`, and
  `.../quizzes/{basic|advanced}/access`; plus
  `GET .../subscription` and `POST .../subscription/demo`.
- Battle passes: `GET .../battle-passes`, `GET .../battle-passes/{passId}`,
  `POST .../{passId}/progress`, and `POST .../{passId}/rewards/{rewardId}/claim`.
- Safety/measurement: `GET .../ads/{placementId}` and `POST .../analytics`.

### Web library and progression additions

- Metadata catalog: `GET /api/books` and `GET /api/books/{bookId}`. These
  return edition, rights/territory/attribution, `source` review notes, static
  `access` and Diamond price, chapter `readingLevels`, and in-app content
  availability. A static book access state tells the UI whether a title is
  Free, Premium, or purchase-only; `GET .../books/{bookId}/access` and the
  chapter endpoint provide the reader-specific `state`, including `owned`.
  Authoring-source URLs remain private to the reviewed backend data and are
  never used as reader redirects.
- Exact source mapping: `GET /api/quests/{questId}/book-reference` returns
  the stable book ID, exact edition, verified chapter IDs (or an explicit
  standalone-passage mapping), mapping basis, and bundled passage location.
- Reviewed activities: `GET /api/catalog/book-activities` and
  `GET /api/catalog/books/{bookId}/activities` return only reviewed activity
  metadata. The supported activity types are `story-quest`, `character-map`,
  `chapter-choice`, `evidence-collection`, `scene-reconstruction`,
  `vocabulary-in-context`, `creative-response`, and `book-world-map`.
  `GET /api/catalog/book-quizzes` and `GET .../quizzes` remain frontend
  compatibility aliases for the reviewed activity list. `GET
  .../books/{bookId}/quizzes/{quizId}` checks the activity's `basic` or
  `advanced` entitlement and, only when allowed, returns `id`, `bookId`,
  `edition`, `chapterIds`, `sourceLabel`, `targetSkill`, `activityType`, and
  its reviewed questions. Draft and generated-unreviewed activities never
  appear in a learner response.
- Reading: `GET /api/profiles/{profileId}/books/{bookId}/access`,
  `GET .../chapters/{chapterId}`, and `GET .../reader`. Chapter/reader
  retrieval returns a reviewed `cached-chapter` or `bundled-passage` with
  stable sentence IDs, or a structured `unavailable` result. It never sends a
  reader URL. Cache only reader content by book/chapter ID, never in
  learner-progress state. `access.allowed:false` with `state:"premium"` or
  `state:"purchase-only"` is a lock state; `content.mode:"unavailable"` is
  a content state; HTTP 503 with `detail.code:"catalog_unavailable"` is an
  error state. The client owns the transient `loading` state while fetching.
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
  `duplicate_xp_attempt`; another submitted attempt for the same quest returns
  `duplicate_quest_reward`, so quest replay cannot farm XP or a quest reward.
  An eligible, XP-awarding reviewed quest issues the stable
  `quest-wishlist-page` reward instance. `POST .../xp` is reserved for
  explicit local `demo-seed` values and cannot award quest XP.
- Wallet and Wishlist Pages: profiles expose `wallet:{gold,diamonds}` and
  `inventory:{wishlistPages}`. On first read, local legacy `leafTokens` migrate
  1:1 to Gold and `storyShards` migrate 1:1 to Diamonds, then the old field is
  removed. Claim `level-wishlist-page`, claim an eligible quest reward, or buy
  `shop-wishlist-page` with Diamonds. `POST .../wishlist/redemptions` consumes
  exactly five pages only after it finds an unowned wishlisted book; it selects
  deterministically from the eligible set, records `redemptionId`, and grants
  permanent ownership in the same local transaction. Empty or fully owned
  wishlists leave pages unchanged.
- Book ownership: catalog-defined `shop-book-{bookId}` mock items are returned
  from `GET /api/catalog/shop`; book offers use Diamonds, while accessory
  offers use Gold. A successful local purchase grants permanent ownership,
  returns `{ownership:"permanent",ownedBookIds,wallet:{gold,diamonds}}`, and
  remains in `GET .../library` after a subscription expires. Premium expands
  subscription-eligible chapter and advanced-quiz access but never unlocks a
  `purchase-only` title.
- Road and collections: `GET /api/catalog/progression` returns all 100
  Level Road thresholds and milestone rules. `GET .../progress` has the same
  nodes with the profile's unlocked IDs; `GET .../collections` returns
  badges, trophies, achievements, and wishlisted catalog items with earned
  state.

Book-catalog authoring records use only Project Gutenberg title landing pages
and retain its Terms of Use, License, territory, attribution, and
robot/download guidance for review. A source edition is not treated as
text-cleared when the title metadata cannot identify it. The generator is
`backend/scripts/generate_gutenberg_catalog.py`; it reads an already-downloaded
offline CSV and deliberately rejects runtime bulk downloading.
`backend/scripts/cache_gutenberg_chapters.py` is a separate authoring-only
review command: it first asks Gutendex for one title's metadata, falls back to
the checked offline catalog only when Gutendex is unavailable, verifies the
matching Gutenberg landing page says "Public domain in the USA", checks the
downloaded eBook notices, and rejects a title without an exact named chapter
boundary. It writes every explicit sequential source chapter (including a
part-qualified ID only when a printed Chapter I restart occurs) to the
approved local cache. The reader never
downloads Gutenberg text; it serves the local cache by stable book/chapter ID.

### Cached chapter response

For an entitled reader, `GET /api/profiles/{profileId}/books/{bookId}/chapters/{chapterId}`
returns this source-safe shape (the real `sentences` array contains the full
reviewed chapter, with no upstream URL):

```json
{
  "bookId": "gutenberg-11-alice-s-adventures-in-wonderland",
  "chapterId": "chapter-1",
  "access": {"allowed": true, "state": "free", "reason": "free-pass"},
  "content": {
    "mode": "cached-chapter",
    "sentences": [{"id": "s1", "text": "Alice was beginning to get very tired..."}],
    "cacheHint": "Cache reviewed reader content by book and chapter ID; do not store it in learner progress."
  },
  "attribution": {"sourceReference": "Project Gutenberg eBook #11", "requiredAttribution": "..."}
}
```

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
{"id":"anon-...","xp":0,"level":1,"wallet":{"gold":150,"diamonds":0},"inventory":{"wishlistPages":0},"activePetId":null,"entitlement":{"plan":"free","adFree":false,"bookAccessLevel":"demo"}}
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
{"petId":"page-finch","rarity":"Common","duplicate":true,"compensation":{"currency":"diamonds","quantity":30,"description":"A duplicate pet becomes 30 Story Shards; the duplicate pet is not added twice."},"deterministicDemo":true}
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
