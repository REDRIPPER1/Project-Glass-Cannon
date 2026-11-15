# LitLab

LitLab is an offline-first reading comprehension game. Learners practice reading skills through reviewed quests, chapter reading, evidence-based activities, and a local progression system. The React app works without the backend; optional API features add catalog, account-demo, and progression services.

## What’s included

- **Quest map:** reviewed passages, worked examples, comprehension questions, evidence selection, feedback, story consequences, and completion review.
- **Reading Basics:** revisitable starter lessons for main idea, inference, vocabulary in context, text evidence, character motives, sequencing and summarizing, and author purpose/point of view.
- **Books:** categorized catalog, access labels, chapter navigation, in-app reading, reading progress, and chapter-attributed activities. Only approved in-app content is shown; unavailable chapters remain clearly marked.
- **Progress and collections:** local XP, levels, badges, skill progress, Level Road, Trophy Road, Trailboard, and a monthly reward path.
- **Pets and Shop:** companion collection, names and customization, demo shop, Gold and Diamonds, Wishlist Pages, and local-only demo purchases.
- **Settings:** theme and color mode, text size, reduced motion, optional sound cues, and anonymous local demo controls.
- Responsive layouts, keyboard support, visible focus, and reduced-motion handling.

Demo purchases and subscription choices do not process real payments. The app does not require a real learner name, email, or child identifier.

## Requirements

- Node.js and npm
- Python 3.10+ (for the optional API)

## Run locally

Install frontend dependencies:

```sh
npm install
```

Run the frontend and optional API together:

```sh
npm run dev
```

Vite serves the app at `http://localhost:5173`; FastAPI runs at `http://localhost:3001`. The combined command expects the Python dependencies to be installed in the active environment:

```sh
python -m pip install -r requirements.txt
```

Run only the frontend (the offline demo remains usable):

```sh
npm run dev:client
```

Run only the API:

```sh
python -m uvicorn backend.main:app --reload --port 3001
```

## Build and test

```sh
npm test
npm run build
npm run preview
```

The frontend tests cover progress persistence and reset, quest and evidence behavior, books and chapter activities, Reading Basics, progression, and accessibility-critical UI contracts.

## Offline-first behavior and data

Reviewed quest and Reading Basics JSON is bundled from `backend/data/` at build time. The browser uses local progress and can complete bundled learning flows when the API is stopped. Optional API requests improve catalog and platform behavior but are not required for the local quest demo.

Progress is anonymous and browser-local. Book reading content is kept separate from learner progress; the progress record stores stable IDs and progress metadata rather than entire books. Clear site storage only when you intend to remove the local demo profile.

Book metadata does not by itself grant permission to serve a text. Titles and chapters marked unavailable or reference-only must remain locked until their edition, rights, and content have been reviewed. Reader views stay inside LitLab and preserve source attribution.

## API

See [`backend/API.md`](backend/API.md) for endpoint and object contracts, including quests, Reading Basics, books, chapters, activities, profile demo services, rewards, pets, and access states. The API may use process-memory state by default; configure `LITLEARN_DATABASE_PATH` to persist its local SQLite demo database, or `LITLEARN_FORCE_MEMORY=1` to use memory explicitly. These are local demo services, not production authentication or payment systems.

## Project guide

- [`READQUEST_FEATURE_BACKLOG.md`](READQUEST_FEATURE_BACKLOG.md) — feature roadmap and staged capabilities.
- [`READQUEST_BUILD_CHECKLIST.md`](READQUEST_BUILD_CHECKLIST.md) — implementation checklist.
- [`HACKATHON_JUDGE_READINESS.md`](HACKATHON_JUDGE_READINESS.md) — demo and judging readiness notes.
- [`AGENTS.md`](AGENTS.md) — repository workflow and file ownership.
- [`SETUP.md`](SETUP.md) — additional environment setup notes.

## Ownership

Frontend, integration, and deployment configuration are maintained in `src/` and related frontend files. Backend and reviewed content are maintained under `backend/` and `content/`. Coordinate shared API or catalog contract changes with the other owner before changing them.
