# ReadQuest — Hackathon Build Checklist

An editable source of truth for the ReadQuest hackathon project. Check items off as they land and add new ideas under **Backlog**.

## Product statement

**ReadQuest helps readers understand what they read.** It turns short, legally usable reading content into five-minute quests with comprehension practice, feedback, progress, and motivation.

## Hackathon MVP (build this first)

### 1. Foundation

- [ ] Choose the web stack and create the app scaffold.
- [ ] Configure local development, environment variables, and deployment.
- [ ] Define a simple visual style: friendly, accessible, reading-first.
- [ ] Create responsive layouts for phone and desktop.
- [ ] Add an app-level loading state and useful error messages.

### 2. Reading-content library

- [ ] Start with 3–5 short, original passages (roughly 250–400 words each).
- [ ] Give every passage a title, topic, difficulty, estimated reading time, and skill tags.
- [ ] Include varied topics or genres: mystery, science, technology, real-world issue, and fiction.
- [ ] Add a content-rights field to every item: `original`, `public domain`, or `licensed`.
- [ ] Record the source and license terms for every non-original item.
- [ ] Do **not** upload modern copyrighted books or chapters without explicit permission.

### 3. Core reading quest

- [ ] Build a library or home screen that lets a user choose a quest.
- [ ] Build a clean distraction-free reading screen.
- [ ] Show title, skill tags, estimated time, and progress.
- [ ] Prevent answers/solutions from being visible before the reader submits.
- [ ] Add 4–5 questions per passage.
- [ ] Cover multiple comprehension skills: main idea, inference, vocabulary in context, evidence, author purpose, and critical thinking.
- [ ] Support multiple choice first; add short answer only if time remains.
- [ ] Grade answers and show an explanation grounded in the passage.
- [ ] Show completion, score, and a next-quest action.

### 4. Gamification

- [ ] Award XP for completed questions and a completion bonus.
- [ ] Create one simple level/progress bar.
- [ ] Add a daily-reading streak (local storage is fine for the demo).
- [ ] Add 3–5 visible badges, such as First Quest, Three-Day Streak, Evidence Expert, and Vocabulary Explorer.
- [ ] Make rewards about understanding and completion—not speed alone.

### 5. Learner dashboard

- [ ] Show completed quests, total XP, level, streak, and earned badges.
- [ ] Show strengths by skill tag using simple counts or percentages.
- [ ] Recommend the next quest based on an unfinished or lower-practiced skill.
- [ ] Keep progress local for the MVP unless authentication is completed early.

### 6. AI coach (only after the core quest works)

- [ ] Add a clearly labeled “Explain this answer” action.
- [ ] Send only the needed passage/question/answer context.
- [ ] Make the coach explain reasoning rather than merely reveal answers.
- [ ] Add safety language: this is study support, not a diagnostic assessment.
- [ ] Handle unavailable AI responses gracefully with a built-in explanation fallback.
- [ ] Keep API keys server-side; never expose them in the browser.

## Demo-ready polish

- [ ] Seed the app with enough content for a complete 2–3 minute demo.
- [ ] Add an onboarding screen or short “How it works” section.
- [ ] Add empty states for no completed quests and no badges.
- [ ] Test keyboard navigation, readable contrast, mobile layout, and basic screen-reader labels.
- [ ] Test one complete flow: choose quest → read → answer → feedback → earn XP → dashboard.
- [ ] Make a reset-demo-progress action for judges.
- [ ] Deploy to a stable shareable URL.
- [ ] Prepare a backup screen recording or screenshots in case the demo environment fails.

## Judge-facing story

- [ ] Prepare the problem statement: many reading tools track pages completed, not understanding.
- [ ] Prepare the solution statement: ReadQuest combines engaging content, comprehension practice, and immediate feedback.
- [ ] Prepare the differentiator: “Kindle helps you read books; ReadQuest helps you understand them.”
- [ ] Explain legal content: original passages first, verified public-domain content second, licensed content later.
- [ ] Explain revenue: free core experience; premium AI coaching/analytics; later school or library subscriptions.
- [ ] Create a 3–5 slide deck: problem, solution/demo, market/business model, roadmap.
- [ ] Assign speaking roles and rehearse a 2–3 minute pitch.

## Post-hackathon roadmap (do not block the MVP)

- [ ] User accounts and cloud-synced progress.
- [ ] Personalized reading plans and adaptive difficulty.
- [ ] Teacher dashboard, assignments, class challenges, and reports.
- [ ] School/library subscription workflow.
- [ ] Author submission and revenue-sharing program.
- [ ] Properly licensed modern books and publisher partnerships.
- [ ] Accessibility preferences such as dyslexia-friendly typography, font sizing, and reduced motion.
- [ ] Social challenges or friend leaderboards with privacy controls.

## Content and legal guardrails

- [ ] Use original team-written material for the hackathon demo whenever possible.
- [ ] Verify public-domain status in the intended market before publishing a text.
- [ ] Respect Creative Commons requirements, including attribution, commercial-use limits, and adaptation limits.
- [ ] Obtain written permission before displaying, adapting, storing, or generating learning materials from copyrighted works.
- [ ] Track owner, license, permitted uses, territory, attribution, and expiry for future third-party content.
- [ ] Do not promise legal compliance beyond what has been verified; seek professional advice before a commercial launch.

## Backlog — add new ideas here

- [ ]

