# ReadQuest Feature Backlog

This is the implementation-ready source of truth for the hackathon. The goal is a polished, judge-friendly demo—not a full learning platform.

## Product promise

ReadQuest is a story-driven comprehension game for grades 4–8 learners who need practice making inferences and supporting answers with text evidence. Learners advance the quest through careful reading and reasoning; tutors get a quick view of the skill practiced, answer, chosen evidence, and next practice.

## Demo definition of done

From a fresh browser, a judge can:

1. See what ReadQuest does and choose a recommended quest.
2. Read a focused 200–250 word passage with progress and clear typography.
3. See a brief worked example of the target skill, then answer three questions that practice that same skill without seeing answers early.
4. Receive explanations grounded in the passage and feedback on the evidence chosen.
5. Earn XP and see a completion screen.
6. Open the dashboard and understand progress, skill strengths, and the next recommendation.
7. Open a one-learner session summary showing the skill practiced, answer, chosen evidence, and one suggested next practice. Use a local demo profile with no real child identifiers.
8. Reset demo progress and repeat the flow.

## Scope levels

- **P0 — Demo blocker:** required for the complete 2–3 minute flow.
- **P1 — Polish:** makes the demo feel intentional and reliable.
- **P2 — Post-demo:** valuable, but must not delay the demo.

## Two-day hackathon cut line

**Must ship:** one complete local quest, one visible story consequence tied to an evidence choice, accurate feedback, a simple character/reward response, and the anonymous tutor summary. Make the whole flow repeatable for a judge.

**Add only if the core flow is stable:** a second passage, extra animation, optional sound, or a small skill-progress view.

**After the event:** user accounts, a broad content library, AI coaching, multiplayer/social features, complex school reporting, subscriptions, and integration work. Avoid features that cannot be shown working in the final demo.

## Judge-readiness priorities

- **Make the learning action advance the game:** each correct comprehension move changes the story, opens a path, or earns a meaningful collectible. Use narrative, character reactions, and progress to make learners want another quest. Keep the skill objective visible and the feedback accurate; decorative XP alone does not differentiate ReadQuest.
- **Capture reasoning, not just the answer:** for each of the three demo questions, ask the learner to choose the supporting sentence before revealing the correct evidence. The tutor summary should show the answers, evidence choices, target skill, and a next practice. A highlight animation alone shows the answer key, not what the learner understood.
- **Target audience:** long-term, children from early readers through junior high. First segment: grades 4–8 readers needing supplemental comprehension practice; tutors and small reading practices are the first payer to test, with teachers/interventionists as instructional pilot partners. Parents are gatekeepers and a later payer hypothesis.
- **Name the buyer:** use a teacher/interventionist as the instructional pilot partner; test independent tutors or small tutoring practices as the first payer. Test parent subscriptions and school-wide purchasing later. Keep prices and willingness to pay as hypotheses until interviews support them.
- **Compete with existing literacy games:** Prodigy English, Reading Eggspress, and ReadTheory already combine reading/language content with adaptive or gamified progress; CommonLit offers extensive free text-based instruction. Test a distinct short quest for inference and evidence that records the learner’s chosen sentence and turns it into an actionable tutor summary. Treat this as a hypothesis until side-by-side tests.
- **Validate the game loop:** track whether learners finish a quest, choose another, and return the following week. Compare with a simple practice version when possible. Keep game metrics separate from comprehension and evidence-use measures.
- **Treat child privacy as a launch requirement:** minimize student identifiers and data retention; no ads or secondary use. Review COPPA/FERPA and district approval needs with qualified guidance before collecting real student data.
- **Measure what the demo can support:** track quest completion, use of evidence reveals, and return intent. Do not claim reading improvement without a study.
- **Keep the visual hook focused:** one memorable guide character, strong quest-card art, and restrained motion are enough for the demo. Sound effects come after the full quest works.

## P0 — Build in this order

### 1. Minimal app shell and content

- [ ] Keep the React/Vite shell and add working Home, Reading, Question, Feedback, Completion, and Dashboard views.
- [ ] Put quest content in one reviewable data module with source, rights, skill tags, explanations, and evidence references.
- [ ] Finish one original 200–250 word quest focused on one skill before expanding the library; add two more after the first flow works.
- [ ] Keep bundled quest data as a reliable fallback so the demo works when the API is unavailable.

### 2. Complete one working quest

- [ ] Home presents a recommended quest with topic, difficulty, skills, and reading time.
- [ ] The reading view presents the passage clearly with reading progress and a “Start questions” action.
- [ ] Show one question at a time with answer choices and question progress.
- [ ] Support three focused multiple-choice questions, answer submission, score, XP, and a next action.
- [ ] Teach one short routine before practice: model a question, think aloud about the likely answer, find the sentence that proves it, then let the learner try. Keep the worked example brief and skippable.
- [ ] For each of the three target-skill questions, capture the learner’s chosen supporting sentence before showing the correct evidence; explain why it supports or fails to support the answer.
- [ ] Show correct/incorrect feedback only after submission, then show completion and a next-quest action.
- [ ] Persist the minimum useful progress locally and make reset work.

### 3. Make the learning visible

- [ ] After submission, show a short explanation and a “Show passage evidence” action.
- [ ] On activation, scroll to and highlight the exact supporting sentence in the passage.
- [ ] Give each question an evidence reference so explanations are reviewable and not generic.
- [ ] Keep the evidence hidden until the learner has submitted an answer.
- [ ] Keep the learner’s evidence choice so it can appear in a local-only tutor session summary; describe it as a practice signal, not mastery or diagnosis.

### 4. Give it a distinctive visual identity

- [ ] Establish a friendly illustrated world with a small guide character who reacts to progress and feedback.
- [ ] Create one cohesive visual system with topic colors, simple icons, strong typography, and clear spacing.
- [ ] Add interactive quest cards with hover, focus, selected, and completed states.
- [ ] Add restrained motion for navigation, evidence reveal, answer feedback, and completion.
- [ ] Use CSS and a small original SVG guide illustration so visuals stay quick to build and load.
- [ ] Make evidence-based reasoning advance the story; the learner’s comprehension action must change a scene, unlock a route, or earn a story-linked item.
- [ ] Make the game loop legible: choose quest → read → reason → choose evidence → see consequence → get feedback → want another quest.
- [ ] Reward effort, completion, and careful reasoning; never give a speed bonus or make streak loss feel punitive.

### 5. Make the judging story credible

- [ ] Write a one-sentence problem statement for the chosen learner and a one-sentence explanation of why evidence-based feedback helps.
- [ ] Have up to three quick conversations with a tutor, teacher/interventionist, and parent or learner if reachable; record exact feedback and label it as directional, not proof of market size.
- [ ] Name the learner, likely buyer, and a simple first business-model hypothesis; label assumptions as assumptions.
- [ ] Compare against free classroom reading practice and paid teacher tools; test whether the learner evidence-choice record and tutor summary solve an unmet workflow.
- [ ] Compare against game-based literacy products, especially Prodigy English, Reading Eggspress, and ReadTheory; identify exact overlap and the intended gap.
- [ ] Explain why gamification matters: it is the return-motivation engine; the learning action remains inference and evidence-based reasoning.
- [ ] Prepare one simple model with an illustrative tutor-account price, capacity, 100-account scenario, revenue formula, and main costs; label every unvalidated number as an assumption.
- [ ] Name a realistic first route to reach pilot educators or classrooms.
- [ ] Choose a measurable pilot signal: quest completion, evidence-reveal use, and learner/educator willingness to return.
- [ ] Prepare a concise pitch covering problem, demo, differentiation, buyer/model hypothesis, impact measure, and next validation step.
- [ ] Ask two or three tutors/interventionists for a scheduled post-event demo or pilot; do not describe interest as a sale.

### Content quality rules

- [ ] Every quest has: `id`, title, topic, difficulty, reading time, passage, skill tags, source, rights, and questions.
- [ ] Every question has: `id`, `type`, prompt, choices, correct answer, skill, explanation, and evidence reference.
- [ ] Use original or verified public-domain content only; never add modern copyrighted excerpts.
- [ ] Before adding a book excerpt, verify the exact book and edition's reuse rights.
- [ ] Record the excerpt's source, chapter, rights status, license, and required attribution in quest data.
- [ ] If reuse rights are unclear, do not include the excerpt.

### Progress and motivation

- [ ] Store progress in local storage with a versioned key.
- [ ] Award XP for answers plus a completion bonus; do not reward speed.
- [ ] Track completed quests, XP, and level; keep streak tracking as a stretch item.
- [ ] Add one earned badge for finishing the first quest; add more only if time remains.
- [ ] Dashboard shows XP, level progress, completed quests, the first badge, and skill strengths; add streaks only if time remains.
- [ ] Recommend an unfinished quest or the least-practiced skill.
- [ ] Show a tutor session summary with the skill practiced, learner answer, chosen evidence, and one follow-up suggestion; keep the demo anonymous.
- [ ] Record repeat-use signals separately from skill practice: quest completion, next-quest selection, week-to-week return, and evidence-choice accuracy.
- [ ] Add “Reset demo progress” with confirmation.

### Accessibility and reliability

- [ ] Keyboard-accessible controls and visible focus states.
- [ ] Semantic headings, labels, and button text; readable contrast.
- [ ] Responsive layout for phone and desktop.
- [ ] Friendly fallback if the API is unavailable.
- [ ] Every animation has a reduced-motion alternative and never blocks reading or answering.
- [ ] Sound is never required to understand status, feedback, or navigation.

## P1 — Add only after P0 works

- [ ] First-visit onboarding: “Read → Answer → Understand → Grow.”
- [ ] Resume an unfinished quest from the home screen.
- [ ] Review all submitted answers after completion, including passage evidence.
- [ ] Search and filter quests by topic, skill, and difficulty.
- [ ] Bookmark a quest.
- [ ] Daily goal with a small progress indicator.
- [ ] “This question seems confusing” feedback action (local-only for the demo).
- [ ] Reduced-motion preference and text-size control.
- [ ] Offline-friendly cached quest list and clear network error copy.
- [ ] Judge/demo mode with seeded progress, a visible reset, and deterministic content.
- [ ] Character expressions or short messages that reflect reading progress, accuracy, and streaks.
- [ ] A short story arc in which the next quest depends on the learner’s evidence-based decision, with a clear restart path.
- [ ] Interactive skill map showing progress across main idea, inference, vocabulary, and evidence.
- [ ] Unlockable character accessories or scene details tied to badges.
- [ ] A quest completion celebration with a subtle confetti or particle effect and a skip option.
- [ ] Optional, muted-by-default sound effects for one or two key moments, with a visible sound toggle and saved preference.
- [ ] Use original or properly licensed audio; keep the full experience understandable without sound.

## P2 — Post-hackathon roadmap

- [ ] Gutendex discovery with title/author/language/topic search, source links, rights labels, timeout handling, and server-side caching.
- [ ] Short-answer questions with rubric-based feedback.
- [ ] AI reading coach that explains reasoning after submission; keep keys server-side and provide a non-AI fallback.
- [ ] SQLite persistence, authentication, and cloud-synced progress.
- [ ] Adaptive difficulty and personalized reading plans.
- [ ] Teacher/classroom assignments and privacy-safe reports.
- [ ] Accessibility preferences: dyslexia-friendly font, reduced motion, and larger text.
- [ ] GitHub Actions, automated tests, deployment, analytics, and monitoring.
- [ ] Private reading circles or social challenges with privacy controls.
- [ ] A family subscription experiment only after repeat engagement is demonstrated and parent willingness to pay is observed.
- [ ] Multi-tutor practice accounts and school/after-school program licenses after the single-tutor workflow renews.
- [ ] Expand the character system into a customizable reading companion with multiple guides.
- [ ] Rich illustrated quest worlds, collectible story fragments, and seasonal visual themes.
- [ ] Music or adaptive ambient audio with a full settings panel and licensed audio library.

## Technical contracts

- **Frontend:** React + Vite in `src/`; owns presentation, view state, local progress, and accessibility.
- **Backend:** FastAPI in `backend/`; the current API only has a health check. Add quest endpoints only if they improve the completed demo; never make the demo depend on a fragile network call.
- **Data:** Keep seed content in one clearly named module/file so questions can be reviewed without searching components.
- **Progress:** Use one versioned local-storage schema and one helper module; components must not write ad hoc keys.
- **API:** Keep endpoints small and documented. Current health endpoint: `GET /api/health`.

## Suggested work split

### You — product integration and frontend

- Own `src/`, `index.html`, and the visual/demo experience.
- Build Home, Quest, Completion, Dashboard, navigation, responsive styling, accessibility, and local progress.
- Keep the main demo flow working against seed data even if the backend is unavailable.
- Prepare the judge demo script and final polish.
- Own the visual system, character states, motion, sound toggle, and interactive feedback states.
- Build the learner evidence-choice interaction and anonymous tutor session summary from the agreed question contract.

### Your partner — content and backend

- Own `backend/`, `requirements.txt`, and the content/data module agreed with you before editing.
- Build the quest/question response shape, seed all three passages and question explanations, and add backend validation.
- Add useful API error responses and tests for health, quest retrieval, and invalid IDs.
- Investigate Gutendex only after the P0 flow is stable; do not let it block the demo.
- Supply reviewed correct-evidence references and sample wrong evidence choices for the demo question; do not claim one response diagnoses a reading difficulty.

### Shared integration rules

- Agree on the quest JSON contract before both people build against it.
- Work in separate branches and avoid editing the same files.
- Integrate in small commits; run the complete flow after each merge.
- If a backend contract changes, post the change and a sample response before the other person adapts their code.

## Acceptance checklist before demo

- [ ] A new user can complete one quest in under three minutes.
- [ ] No answer or explanation is visible before submission.
- [ ] The “Show passage evidence” action highlights the correct source text for every demo question.
- [ ] The tutor summary shows the learner’s answer and chosen evidence without implying mastery or diagnosis.
- [ ] Refreshing preserves progress; reset clears it.
- [ ] Empty, loading, API failure, and no-badges states look intentional.
- [ ] Keyboard-only navigation works through the full quest.
- [ ] Mobile layout is usable at a narrow width.
- [ ] Content rights/source metadata is present for every passage.
- [ ] The app can be demoed with the backend stopped.
- [ ] The main interactions feel responsive on a normal laptop and phone.
- [ ] Character, motion, and sound improve feedback without distracting from reading.
- [ ] Sound starts muted or requires a clear user action before playback.
- [ ] Reduced-motion mode, keyboard navigation, and no-sound mode preserve the full experience.
- [ ] The demo names one specific learner, one clear problem, and one reason ReadQuest helps.
- [ ] The pitch labels customer and pricing assumptions as hypotheses unless validated.
- [ ] The team can state one measurable next experiment for learning impact and buyer interest.

## Decisions to make once, then stop revisiting

- **Intended audience:** children from early reading ages through junior high. **First pilot segment:** choose one grade band with teachers, parents, or learners before writing age-specific content at scale.
- **First dashboard skills:** main idea, inference, vocabulary, and evidence.
- **Deployment:** choose the simplest stable frontend/API host available to the team.
- **Content strategy:** original passages for the hackathon; Gutendex is discovery-only until rights and UX are verified.
