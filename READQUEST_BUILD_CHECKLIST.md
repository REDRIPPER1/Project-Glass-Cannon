# ReadQuest — Hackathon Build Checklist

An editable source of truth for the ReadQuest hackathon project. Check items off as they land and add new ideas under **Backlog**.

## Product statement

**ReadQuest turns comprehension practice into story quests.** For grades 4–8 learners who need help making an inference and supporting it with text evidence, reading and reasoning move the story forward. Tutors see the learner’s answer, chosen evidence, and next practice.

## Hackathon MVP (build this first)

### Two-day scope guard

- [ ] Finish one complete, reliable quest before adding a second passage or broad content library.
- [ ] Make one evidence choice change a visible story moment; prioritize this over extra badges, screens, or settings.
- [ ] Keep the demo local and resettable; do not make the judge flow depend on account setup, network access, or a new backend service.
- [ ] Have up to three short buyer/user conversations before judging if reachable; leave paid experiments, school procurement, and full content/accessibility audits for follow-up. Complete essential keyboard, contrast, reduced-motion, and sound-off checks before judging.

### 1. Foundation

- [x] Choose the web stack and create the app scaffold (React/Vite + FastAPI).
- [ ] Configure local development, environment variables, and deployment.
- [ ] Define a simple visual style: friendly, accessible, reading-first.
- [ ] Create responsive layouts for phone and desktop.
- [ ] Add an app-level loading state and useful error messages.
- [ ] Define a distinctive, reading-first visual identity with one guide character and reusable interaction states.
- [ ] Add restrained transitions for navigation, evidence reveals, progress, and answer feedback.
- [ ] Make motion optional through `prefers-reduced-motion` and a settings control.
- [ ] Keep visual assets lightweight; use original or properly licensed graphics.

### 2. Reading-content library

- [ ] Complete one short, original passage (roughly 200–250 words) with three questions that practice one target skill before adding more.
- [ ] Add two more original passages after the first quest works end to end.
- [ ] Give every passage a title, topic, difficulty, estimated reading time, and skill tags.
- [ ] Give the three demo passages distinct topics, such as mystery, science, and technology.
- [ ] Add a content-rights field to every item: `original`, `public domain`, or `licensed`.
- [ ] Record the source and license terms for every non-original item.
- [ ] Do **not** upload modern copyrighted books or chapters without explicit permission.

### 3. Core reading quest

- [ ] Build a library or home screen that lets a user choose a quest.
- [ ] Build a clean distraction-free reading screen.
- [ ] Show title, skill tags, estimated time, and progress.
- [ ] Prevent answers/solutions from being visible before the reader submits.
- [ ] Give the first demo quest three questions on one skill; add broader skill coverage after the core flow is stable.
- [ ] Cover multiple comprehension skills: main idea, inference, vocabulary in context, evidence, author purpose, and critical thinking.
- [ ] Support multiple choice first; add short answer only if time remains.
- [ ] Grade answers and show an explanation grounded in the passage.
- [ ] Show a brief worked example of the target skill before practice: model how to answer and identify the supporting sentence, then let the learner try.
- [ ] Add a “Show passage evidence” action that reveals and highlights the sentence supporting the explanation after answer submission.
- [ ] For each of the three demo questions, record which supporting sentence the learner chose before feedback; use the choices as practice signals, not a diagnosis.
- [ ] Give every question a specific evidence reference; review all evidence and explanations for accuracy.
- [ ] Show completion, score, and a next-quest action.

### 4. Gamification

- [ ] Make the learner’s comprehension action move the story forward; do not use points as a decorative layer over a worksheet.
- [ ] Award XP for completing questions and careful evidence-based reasoning, with no speed bonus.
- [ ] Create one simple level/progress bar.
- [ ] Add a simple XP total and one first-quest badge after the core flow works.
- [ ] Add streak tracking and more badges only if time remains.
- [ ] Make rewards about understanding and completion; keep streaks forgiving and optional.
- [ ] Add a character or guide that reacts to quest progress, correct answers, XP, and badges.
- [ ] Add a clear visual celebration for quest completion with a skip/reduced-motion path.
- [ ] Track week-to-week return separately from skill accuracy so engagement is not presented as learning impact.

### 5. Learner dashboard

- [ ] Show completed quests, total XP, level, streak, and earned badges.
- [ ] Show strengths by skill tag using simple counts or percentages.
- [ ] Show an anonymous tutor session summary with the practiced skill, answer, chosen evidence, and one follow-up suggestion.
- [ ] Recommend the next quest based on an unfinished or lower-practiced skill.
- [ ] Keep progress local for the MVP unless authentication is completed early.
- [ ] Keep the demo anonymous and collect no child personal information; document retention/deletion behavior before any school pilot.
- [ ] Add an interactive skill progress display with clear hover, focus, and selected states.
- [ ] Show the character's progress message alongside the next-quest recommendation.

### Stretch feature (only after the demo flow is complete)

- [ ] Add a clearly labeled “Explain this answer” action.
- [ ] Send only the needed passage/question/answer context.
- [ ] Make the coach explain reasoning rather than merely reveal answers.
- [ ] Add safety language: this is study support, not a diagnostic assessment.
- [ ] Handle unavailable AI responses gracefully with a built-in explanation fallback.
- [ ] Keep API keys server-side; never expose them in the browser.

This is optional for the hackathon. The evidence reveal is the first explanation feature to finish.

## Demo-ready polish

- [ ] Seed the app with enough content for a complete 2–3 minute demo.
- [ ] Add an onboarding screen or short “How it works” section.
- [ ] Add empty states for no completed quests and no badges.
- [ ] Test keyboard navigation, readable contrast, mobile layout, and basic screen-reader labels.
- [ ] Test one complete flow: choose quest → read → answer → feedback → earn XP → dashboard.
- [ ] Make a reset-demo-progress action for judges.
- [ ] Add polished interactive states for buttons, quest cards, answers, badges, and navigation.
- [ ] Add optional, muted-by-default sound effects for one or two moments; provide a visible mute control and equivalent visual feedback.
- [ ] Test the demo with sound off, reduced motion enabled, and keyboard-only navigation.
- [ ] Confirm graphics and audio are original or have documented permission/license terms.
- [ ] Before a real student pilot, review child-privacy, school approval, and data-protection requirements with the school and qualified guidance.
- [ ] Deploy to a stable shareable URL.
- [ ] Prepare a backup screen recording or screenshots in case the demo environment fails.

## Judge-facing story

- [ ] Describe the full intended audience (early readers through junior high) and make grades 4–8 readers needing comprehension support the initial learner segment.
- [ ] Name the child as game user, tutors and small literacy practices as first payer hypotheses, teachers/interventionists as pilot partners, and parents as gatekeepers and a later payer hypothesis.
- [ ] Validate the problem with at least three learner or educator conversations if available; accurately label this as early feedback.
- [ ] Prepare the solution statement: ReadQuest turns comprehension practice into story quests where evidence-based reasoning advances the game and tutors can see what to practice next.
- [ ] Say reading scores have declined and device distraction is associated with poorer learning outcomes; do not claim devices caused the decline without causal evidence.
- [ ] Demonstrate the differentiator: submit an answer, reveal the supporting sentence, and explain the reasoning.
- [ ] Explain how the game loop differs from Prodigy English, Reading Eggspress, and ReadTheory; identify overlaps and avoid “gamification” as a uniqueness claim.
- [ ] Explain legal content: original passages first, verified public-domain content second, licensed content later.
- [ ] Name the learner, likely buyer, and first revenue hypothesis; distinguish assumptions from validated demand.
- [ ] Prepare a simple financial model with an illustrative price, expected customer count, revenue formula, and main costs; label all unvalidated numbers as assumptions.
- [ ] Compare ReadQuest with free classroom practice, paid reading tools, and existing literacy games; test whether the story loop earns repeat use and the evidence-choice summary solves a real tutor workflow.
- [ ] Explain a realistic first route to reach pilot classrooms or educators.
- [ ] Explain what a small pilot would measure: quest completion, evidence use, and willingness to return.
- [ ] Report game engagement (completion, next quest, week-to-week return) separately from learning signals (target-skill accuracy and evidence choice).
- [ ] Avoid claiming learning gains until a pilot measures them.
- [ ] Record actual answer and evidence choice in the demo summary; do not imply mastery from a single quest.
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

- [ ] Add library search and topic filters.
- [ ] Add a public-domain badge and Gutenberg source link for Gutendex books.
- [ ] Let learners bookmark quests and resume unfinished quests.
- [ ] Add answer review with passage evidence and explanations.
- [ ] Add daily reading goals and weekly progress summaries.
- [ ] Add a skill heatmap for inference, main idea, vocabulary, and evidence.
- [ ] Add reduced-motion and dyslexia-friendly reading preferences.
- [ ] Add keyboard navigation and complete screen-reader labels.
- [ ] Add loading, empty, offline, and API-error states.
- [ ] Cache the last successful quest list for brief network outages.
- [ ] Add backend tests for quests, Gutendex search, and invalid book IDs.
- [ ] Add frontend tests for completing a quest and saving local progress.
- [ ] Add Gutendex request timeouts, rate-limit handling, and server-side caching.
- [ ] Add GitHub Actions for install, lint, test, and production builds.
- [ ] Add deployment workflows for the frontend and Python API.
- [ ] Add a judge/demo mode with seeded progress and a reset button.
- [ ] Add onboarding that explains the ReadQuest learning loop.
- [ ] Add the interactive passage-evidence reveal and highlight.
- [ ] Add a friendly guide character with expressions, short encouragement, and a clear mute option.
- [ ] Add topic illustrations and animated quest cards that remain readable and fast.
- [ ] Add completion celebration effects with reduced-motion and skip behavior.
- [ ] Add optional sound effects with visible visual equivalents and local mute preference.
- [ ] Add an interactive skill map and character unlocks after the core quest flow is stable.
- [ ] Add learner feedback for confusing or incorrect questions.
- [ ] Add teacher/library-friendly export of completed-quest summaries.

