# ReadQuest Feature Backlog

Use this as the app's living feature list. Status: `[ ]` planned · `[-]` in progress · `[x]` complete · `[~]` paused.

## Product basics
- [x] MVP — Product promise: help readers understand what they read through short quests and feedback.
- [x] MVP — Target users: learners from post-kindergarten through high school (roughly grades 1–12, ages 6–18) seeking focused reading practice.
- [ ] MVP — Launch goal: demonstrate one complete quest in under three minutes.

## Home screen
- [ ] MVP — Show the next recommended quest.
- [ ] MVP — Show cards with topic, difficulty, skills, and reading time.
- [ ] V2 — Add search, topic filters, and a continue-reading section.

## Learning and reading
- [ ] MVP — Display original passages with clear typography and reading progress.
- [ ] MVP — Add 3–5 short passages across mystery, science, technology, and real-world topics.
- [ ] V2 — Add Gutendex public-domain books with source and rights labels.

## Questions and feedback
- [ ] MVP — Add four multiple-choice questions per passage.
- [ ] MVP — Cover main idea, inference, vocabulary, evidence, and author purpose.
- [ ] MVP — Explain each answer using evidence from the passage.
- [ ] V2 — Add short-answer questions with rubric-based feedback.

## Learning path
- [ ] MVP — Recommend an unfinished quest or under-practiced skill.
- [ ] V2 — Add beginner, growing, and challenge paths.
- [ ] Later — Add adaptive difficulty based on recent answers.

## User profile

- [ ] Customize profile pic from a set of photos
- [ ] Customize color banner
- [ ] Add what genre of books you’re interested in so the assignments give more reading texts to adhere to your interests

## Friends and social features

- [ ] Invite friend
- [ ]Friend leaderboard
- [ ] Friend streak
- [ ] Friend battle

## Notifications and reminders

- [ ]Your streak is about to end
- [ ] You lost your spot on the leaderboard
- [ ] Your friend wants to battle, log in to battle them

## Subscription plans

### Free plan

- [ ] Access to demo chapters of a book
- [ ] Basic vocabulary
- [ ] Basic reading & comprehension quizzes
- [ ] Appropriate ads & ads directed to buying the premium plan

### Premium plan

- [ ] Full access to a variety of books
- [ ] More access to vocabulary words
- [ ] Advanced reading & comprehension
- [ ] No ads

### School or classroom plan

- [ ] School sponsored discount
- [ ] Teachers can implement their learning plan
- [ ] Teachers can create a classroom plan in order to view students progress & grade accordingly

## Accessibility

- [ ] Different colors for people who are colorblind
- [ ] Text to speech for people who are blind or dyslexic
- [ ] Larger text for those with poor 

## XP, levels, and rewards

- [ ] Every 10 levels free 3-day trial of premium plan & if you already have the Premium Plan you receive a free Separate Pay book (will be removed from library once the LitLearn Subscription is over)
- [ ] Coins earned from completing lessons used to buy more chapters of a book
- [ ]

## Badges and achievements

- [ ] Perfect score on a lesson
- [ ] Achieve first place on the leaderboard
- [ ]

## Leaderboards and challenges

- [ ] Achieve a 7 day streak
- [ ] Review 5 lessons
- [ ] Complete one new lesson
- [ ] Have a perfect score on a finisher quiz
## Learning path

- [ ] Parts of speech/Punctuation
- [ ] Sentence composition/Paragraph structure
- [ ] Identify main points & the message
    ## Product basics

- [ ] Product promise: Increase literacy across learners from post-kindergarten through high school.
- [ ] Target users: Learners in grades 1–12 (roughly ages 6–18), with age-appropriate content and reading levels.
- [ ] Primary user action: Help learners across grade levels read and comprehend texts.
- [ ] MVP launch goal: 

## Home screen

- [ ] Progress -> Review
- [ ] Leaderboard
- [ ] Settings -> Subscription -> Profile

## Daily goals and streaks
- [ ] MVP — Track completed quests locally.
- [ ] MVP — Show a daily-reading streak and completion bonus.
- [ ] V2 — Let users choose a daily goal of one, two, or three quests.

## Product basics

- [ ] Product promise: Increase literacy across learners from post-kindergarten through high school.
- [ ] Target users: Learners in grades 1–12 (roughly ages 6–18), with age-appropriate content and reading levels.
- [ ] Primary user action: Help learners across grade levels read and comprehend texts.
- [ ] MVP launch goal: 

## Starting of the app
-Catagories of reading
-Learning curve/range test
-Age/Grade info
-Username
-Add logins aswell
-Add custom character instead of irl photo

## Home screen

- [ ] Progress -> Review
- [ ] Leaderboard
- [ ] Settings -> Subscription -> Profile

## profile
-Achivement
-Wishlist
-Lvl
-Xp/gold
-friendlist
-and more
## shop
- Accessories
-Customization
-Limited book purchase
-Coin purchase
-Gift someone a book from wishlist
-Wishlist page purchase (get 5 of them to get one book from your wishlist)
## XP, levels, and rewards
- [ ] MVP — Award XP for correct answers and completing a quest.
- [ ] MVP — Show a level and progress bar on the dashboard.
- [ ] V2 — Add weekly XP goals and level-up celebrations.

## Badges and achievements
- [ ] MVP — Add First Quest, Evidence Expert, and Vocabulary Explorer badges.
- [ ] V2 — Add Three-Day Streak and Curious Reader badges.
- [ ] Later — Add skill-specific achievement milestones.

## Library and content discovery
- [ ] MVP — Seed the app with original demo passages.
- [ ] V2 — Add Gutendex search by title, author, language, and topic.
- [ ] V2 — Cache book metadata and display Project Gutenberg links.

## AI reading coach
- [ ] V2 — Add an Explain this answer action after submission.
- [ ] V2 — Send only needed passage, question, and selected answer context.
- [ ] V2 — Provide a built-in fallback when AI is unavailable.

## Accessibility
- [ ] MVP — Keyboard navigation and visible focus states.
- [ ] MVP — Readable contrast, semantic labels, and responsive layouts.
- [ ] V2 — Dyslexia-friendly font, reduced motion, and text-size controls.

## Content management
- [ ] MVP — Track title, topic, difficulty, skills, source, and content rights.
- [ ] V2 — Add a content import script for Gutendex metadata.
- [ ] V2 — Add editorial review before imported content becomes a quest.
- [ ] V2 — Organize passages by grade band and reading level across elementary, middle, and high school.
- [ ] V2 — Adjust vocabulary support and question complexity to the learner's selected reading level.

## Privacy, safety, and legal
- [ ] MVP — Use original or verified public-domain content for the demo.
- [ ] MVP — Keep API keys server-side and never expose them in the browser.
- [ ] V2 — Add data deletion and local-progress reset controls.

## Technical foundation
- [x] MVP — Frontend: React + Vite.
- [x] MVP — Backend: Python FastAPI.
- [ ] MVP — Database: local storage first; SQLite when persistence is needed.
- [ ] V2 — Authentication: optional account login after the demo.
- [ ] V2 — Hosting: deploy frontend and API to stable shareable URLs.
- [ ] V2 — Analytics: privacy-conscious quest completion and error events.
- [ ] V2 — AI provider: server-side integration with graceful fallback.

## Priorities
### Must have for the hackathon
- [ ] Build the library → read → answer → feedback flow.
- [ ] Seed three original passages with complete questions.
- [ ] Add XP, streak, dashboard, error states, and responsive polish.

### Nice to have after the demo
- [ ] Add Gutendex discovery and public-domain source links.
- [ ] Add tests, GitHub Actions, and deployment.
- [ ] Add accessibility preferences and bookmarks.

### Future ideas
- [ ] AI reading coach and adaptive learning paths.
- [ ] Teacher/classroom plans and privacy-safe reports.
- [ ] Optional social challenges and private reading circles.

## Decisions to make
- [ ] Choose the first deployment target for the React frontend and FastAPI API.
- [ ] Decide whether Gutendex content is metadata-only or imported into curated quests.
- [ ] Decide which accessibility preferences belong in the MVP demo.

## Open questions
- Which grade bands should the first demo support first?
- Which three skills should the dashboard emphasize first?
- Who will own content review and question quality checks?

## Gamification expansion

### Phase 2 frontend game loop
- [ ] MVP — Add a three-slot clue trail to each quest; a supported answer lights a clue and a missed answer adds a “practice clue” after feedback.
- [ ] MVP — Show an illustrated quest map with available, in-progress, and completed locations, plus a clear next stop.
- [ ] MVP — Add a short end-of-quest debrief tying the learner’s answer and evidence choices to the story outcome and next quest.
- [ ] MVP — Give the guide character reading, thinking, success, retry, level-up, and celebration reactions with short, encouraging messages.
- [ ] MVP — Let earned badges unlock cosmetic guide accessories or scene details; state the unlock criteria and avoid purchasable advantages.
- [ ] V2 — Add a collection journal for badges, story fragments, discovered locations, and optional next rewards.
- [ ] V2 — Let the learner choose between two next quests; keep both paths replayable and avoid locking learning content behind a choice.
- [ ] V2 — Add optional bonus objectives that reinforce close reading, such as reviewing a missed question or finding another supporting detail.
- [ ] V2 — Add a session-only evidence streak that celebrates supported reasoning and resets without loss or shame.
- [ ] V2 — Add a quest replay objective that changes the reflection goal without repeatedly granting the same completion reward.
- [ ] V2 — Offer optional daily or weekly goals with flexible targets, dismissal, and no lost-progress messaging.
- [ ] V2 — Add a short, skippable completion celebration with reduced-motion behavior and a static equivalent.
- [ ] V2 — Add an optional sound toggle, saved locally and muted by default, with visual equivalents for every sound cue.
- [ ] Later — Add cooperative group milestones where participants contribute to a shared goal without individual rankings.
- [ ] Later — Add branching story scenes with equally complete routes and no permanent penalty for an incorrect response.
- [ ] Later — Add seasonal themes and collectible story fragments that remain available after the event.
- [ ] Later — Add an optional personal reading space where earned cosmetics can be displayed.

### Game design checks
- [ ] Tie every reward to reading, reasoning, evidence selection, reflection, or quest completion; avoid rewards that only increase taps or time-on-screen.
- [ ] Explain XP, badge, streak, and unlock rules before or when they are earned.
- [ ] Keep engagement measures (starts, completions, returns, goal choices) separate from learning measures (answer accuracy and evidence selection).
- [ ] Do not use paid power-ups, loot boxes, speed bonuses, public child leaderboards, countdown pressure, or streak-loss penalties.
- [ ] Let learners skip celebrations, replay completed quests, change goals, and hide optional game signals.

### Quest progression
- [ ] MVP — Show a clear quest path with locked, available, and completed reading quests.
- [ ] MVP — Give each quest a mastery rating based on correct answers and evidence use, not speed.
- [ ] V2 — Add optional bonus objectives, such as finding a quote that supports an answer.
- [ ] V2 — Add multi-part story arcs where finishing a quest unlocks the next chapter.
- [ ] Later — Run themed, time-limited reading events with original passages and non-exclusive rewards.

### XP, levels, and goals
- [ ] MVP — Award XP for finishing a quest, answering carefully, and reviewing a missed skill; do not reward repeated submissions of the same answers.
- [ ] MVP — Show what actions earn XP and how much progress remains to the next level.
- [ ] V2 — Add personal daily and weekly goals with selectable difficulty and progress indicators.
- [ ] V2 — Celebrate level-ups with a brief, skippable animation and a useful summary of skills practiced.
- [ ] V2 — Let learners pause or revise goals without losing progress or being shamed for missed days.

### Streaks and healthy habits
- [ ] MVP — Count a streak from at least one completed reading activity on separate calendar days.
- [ ] V2 — Offer an optional reminder schedule and quiet hours; keep reminders off until the learner enables them.
- [ ] V2 — Add earned rest days or streak protection so a missed day does not erase long-term progress.
- [ ] V2 — Show reading consistency over time as an encouraging summary, not a penalty or countdown.

### Achievements and collectibles
- [ ] MVP — Add milestone badges for completing quests, practicing a skill, and improving after feedback.
- [ ] V2 — Add badge sets with visible criteria and progress toward each achievement.
- [ ] V2 — Let learners collect book-themed items and avatar accessories earned through reading milestones.
- [ ] V2 — Add an optional profile showcase for selected badges and completed story arcs.
- [ ] Later — Add seasonal collections that remain cosmetic and do not lock reading content behind purchases.

### Challenges and social play
- [ ] V2 — Add opt-in asynchronous friend challenges based on reading a passage and answering its questions.
- [ ] V2 — Score challenges on accuracy and evidence-based answers, with ties allowed; do not reward speed.
- [ ] V2 — Let learners share a challenge link only with approved friends and choose whether their results are visible.
- [ ] V2 — Make leaderboards private by default, limited to invited groups, and disable them for accounts without the required consent.
- [ ] Later — Add cooperative group goals where friends contribute completed quests toward a shared milestone.

### Fairness and learner controls
- [ ] MVP — Keep core passages, feedback, and learning progress available without purchases or leaderboard participation.
- [ ] MVP — Explain scoring and reward rules before a learner starts a quest or challenge.
- [ ] V2 — Provide controls to hide XP, streaks, badges, and competitive features independently.
- [ ] V2 — Avoid public display of children's real names, exact ages, or reading activity.
