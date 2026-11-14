import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BUNDLED_QUESTS,
  choiceById,
  questById,
  reviewedQuests,
  rightsStatus,
  sentenceById,
  sentencesFor,
} from './utils/questContract';
import {
  BADGES,
  beginQuest,
  completeOnboarding,
  completeQuest,
  createJudgeProgress,
  levelForXp,
  loadProgress,
  markEvidenceReveal,
  recordResponse,
  recordReturnVisit,
  resetProgress,
  responseFor,
  responsesForQuest,
  saveProgress,
  setActiveSession,
  setDailyGoalTarget,
  setProgressSettings,
  toggleBookmark,
  toggleConfusingQuestion,
  xpIntoLevel,
} from './utils/progress';
import {
  coachFallback,
  dailyGoalStatus,
  discoveryMatches,
  filterQuests,
  humanSkill,
  isQuestComplete,
  questionSkill,
  recommendQuest,
  skillSummary,
  storyArc,
} from './utils/experience';

const CLOUD_FEATURES_ENABLED = false;
const QUEST_SCREENS = new Set(['example', 'reading', 'question', 'feedback', 'consequence']);
const BADGE_COPY = {
  [BADGES.FIRST_QUEST]: 'Evidence Explorer',
  [BADGES.EVIDENCE_EXPLORER]: 'Strong Clue Finder',
  [BADGES.QUEST_CARTOGRAPHER]: 'Quest Cartographer',
  [BADGES.COMEBACK_READER]: 'Comeback Reader',
};
const COLOR_MODE_OPTIONS = [
  ['system', 'System default'],
  ['light', 'Light'],
  ['dark', 'Dark'],
];
const THEME_OPTIONS = [
  ['twilight', 'Trail'],
  ['garden', 'Sunset'],
  ['sky', 'Lavender'],
];

function Guide({ mood = 'calm', message, accessory = 'compass' }) {
  const face = mood === 'happy' ? 'M38 58c7 8 17 8 24 0' : mood === 'thoughtful' ? 'M39 63c7-3 15-3 22 0' : 'M38 61c7 6 17 6 24 0';
  return (
    <aside className={`guide-card guide-${mood}`} aria-label="Quest guide">
      <svg className="guide-mark" viewBox="0 0 100 100" aria-hidden="true">
        <path d="M50 7 61 33l27 3-21 18 6 28-23-14-23 14 6-28L12 36l27-3z" />
        <circle cx="39" cy="47" r="4" /><circle cx="61" cy="47" r="4" />
        <path d={face} fill="none" />
        {accessory === 'trail-ribbon' && <path className="guide-accessory" d="M22 22c13 8 42 8 56 0l-5 14c-13 6-33 6-46 0z" />}
        {accessory === 'map-pin' && <circle className="guide-accessory" cx="74" cy="25" r="8" />}
      </svg>
      <p>{message}</p>
    </aside>
  );
}

function SourceNotice({ source }) {
  if (!source) return null;
  const sourceName = source.bookTitle ? `${source.bookTitle}, ${source.edition}, ${source.chapter}` : source.label || 'Original LitLearn passage';
  return (
    <details className="source-notice">
      <summary>Source, rights &amp; attribution</summary>
      <dl>
        <div><dt>Source</dt><dd>{sourceName}</dd></div>
        <div><dt>Rights</dt><dd>{source.rightsStatus}</dd></div>
        <div><dt>License</dt><dd>{source.license}</dd></div>
        <div><dt>Attribution</dt><dd>{source.requiredAttribution || 'No separate attribution required.'}</dd></div>
      </dl>
    </details>
  );
}

function BrandMark() {
  return (
    <svg className="brand-mark" viewBox="0 0 48 48" aria-hidden="true">
      <path d="M8 13.5c6.2-1.8 11.7-.9 16 3.1v20.3c-4.3-4-9.8-4.9-16-3.1z" />
      <path d="M40 13.5c-6.2-1.8-11.7-.9-16 3.1v20.3c4.3-4 9.8-4.9 16-3.1z" />
      <path className="brand-mark-page" d="M24 16.6v20.3" />
      <path className="brand-mark-spark" d="m34.5 5 1.3 3.2L39 9.5l-3.2 1.3-1.3 3.2-1.3-3.2L30 9.5l3.2-1.3z" />
    </svg>
  );
}

function QuestHeroIllustration() {
  return (
    <svg className="hero-illustration" viewBox="0 0 460 190" role="img" aria-label="An open storybook lighting a path toward a reading quest">
      <defs>
        <linearGradient id="hero-sky" x1="0" y1="0" x2="1" y2="1"><stop stopColor="var(--rq-hero-top)" /><stop offset="1" stopColor="var(--rq-hero-bottom)" /></linearGradient>
        <linearGradient id="hero-book" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#fffbe8" /><stop offset="1" stopColor="#f4dfa4" /></linearGradient>
      </defs>
      <rect width="460" height="190" rx="24" fill="url(#hero-sky)" />
      <circle className="hero-moon" cx="390" cy="34" r="13" />
      <path className="hero-cloud" d="M44 51c7-18 31-18 37 0 12-8 26 1 25 14H29c-4-13 7-22 15-14Z" />
      <path className="hero-hill hero-hill-back" d="M0 126c73-44 137-24 202 11 76-65 174-66 258-6v59H0Z" />
      <path className="hero-hill" d="M0 143c75-28 129-5 191 22 71-40 177-30 269 12v13H0Z" />
      <path className="hero-path" d="M233 189c-11-29 22-38 13-66-5-17 26-29 39-39 9-7 18-7 23-3-12 18-45 36-37 61 7 23-25 31-20 47Z" />
      <g className="hero-book">
        <path d="M132 104c35-8 69-2 98 18v43c-28-18-61-24-98-16Z" fill="url(#hero-book)" />
        <path d="M328 104c-35-8-69-2-98 18v43c28-18 61-24 98-16Z" fill="url(#hero-book)" />
        <path className="hero-book-line" d="M230 122v43M151 123c25-4 43 1 61 12M309 123c-25-4-43 1-61 12" />
      </g>
      <g className="hero-sparkles"><path d="m227 71 4 10 10 4-10 4-4 10-4-10-10-4 10-4z" /><path d="m329 65 2 5 5 2-5 2-2 5-2-5-5-2 5-2z" /><circle cx="110" cy="83" r="3" /></g>
    </svg>
  );
}

function NavIcon({ name }) {
  const paths = {
    quests: <><path d="M4 7.5 12 4l8 3.5v9L12 20l-8-3.5z" /><path d="M12 4v16M4 7.5l8 3.5 8-3.5" /></>,
    adventure: <><path d="M4 11.5 12 4l8 7.5v8.5H4z" /><path d="M9 20v-5h6v5" /></>,
    progress: <><path d="M5 19V11M12 19V5M19 19v-9" /><path d="M3 20h18" /></>,
    explore: <><circle cx="11" cy="11" r="6" /><path d="m16 16 4 4M11 8v6M8 11h6" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.1 2.1-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.02 1.56V20.3h-3v-.1a1.7 1.7 0 0 0-1.02-1.56 1.7 1.7 0 0 0-1.88.34l-.06.06-2.1-2.1.06-.06A1.7 1.7 0 0 0 7.08 15a1.7 1.7 0 0 0-1.56-1.02h-.1v-3h.1A1.7 1.7 0 0 0 7.08 9a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.1-2.1.06.06A1.7 1.7 0 0 0 10.72 5a1.7 1.7 0 0 0 1.02-1.56v-.1h3v.1A1.7 1.7 0 0 0 15.76 5a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.1 2.1-.06.06A1.7 1.7 0 0 0 19.4 9a1.7 1.7 0 0 0 1.56 1.02h.1v3h-.1A1.7 1.7 0 0 0 19.4 15Z" /></>,
  };
  return <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>;
}

function CompanionOrb({ progress }) {
  const completed = progress.completedQuestIds.length;
  return (
    <div className="rail-companion" aria-label={`Trail Guide: ${completed} quests completed`}>
      <svg viewBox="0 0 64 64" aria-hidden="true"><path d="m32 5 8 18 19 2-14 13 4 19-17-10-17 10 4-19L5 25l19-2z" /><circle cx="25" cy="30" r="2.5" /><circle cx="39" cy="30" r="2.5" /><path d="M24 39c5 5 11 5 16 0" /></svg>
      <div><strong>Trail Guide</strong><span>{completed ? `${completed} quest${completed === 1 ? '' : 's'} completed` : 'Ready for your first clue'}</span></div>
    </div>
  );
}

function AppHeader({ progress, screen, onNavigate }) {
  const navItems = [
    ['quests', 'Quest map', 'home'],
    ['progress', 'Progress', 'dashboard'],
    ['explore', 'Explore', 'explore'],
    ['settings', 'Settings', 'settings'],
  ];
  const isQuestScreen = QUEST_SCREENS.has(screen) || ['home', 'review', 'complete'].includes(screen);
  return (
    <>
      <aside className="game-rail">
        <button className="rail-brand" type="button" onClick={() => onNavigate('home')} aria-label="LitLearn home"><BrandMark /><span>LitLearn</span></button>
        <CompanionOrb progress={progress} />
        <nav className="rail-nav" aria-label="Game navigation">
          <p>Play</p>
          {navItems.map(([icon, label, target]) => {
            const active = target === 'home' ? isQuestScreen : screen === target;
            return <button key={label} type="button" className={active ? 'is-active' : ''} aria-current={active ? 'page' : undefined} onClick={() => onNavigate(target)}><NavIcon name={icon} /><span>{label}</span>{label === 'Progress' && !progress.settings.hideGameSignals && <b>{levelForXp(progress.xp)}</b>}</button>;
          })}
        </nav>
        {!progress.settings.hideGameSignals && <section className="rail-xp" aria-label={`Level ${levelForXp(progress.xp)}, ${progress.xp} experience points`}><span>Level {levelForXp(progress.xp)}</span><strong>{progress.xp} XP</strong><i><b style={{ width: `${xpIntoLevel(progress.xp)}%` }} /></i><small>{xpIntoLevel(progress.xp)} / 100 to level {levelForXp(progress.xp) + 1}</small></section>}
      </aside>
      <header className="app-header">
        <button className="brand" type="button" onClick={() => onNavigate('home')} aria-label="LitLearn home"><BrandMark /><span>LitLearn</span></button>
        <nav className="header-actions" aria-label="App navigation">
          {!progress.settings.hideGameSignals && <span className="xp-pill" aria-label={`${progress.xp} experience points`}>✦ {progress.xp} XP</span>}
          <button className="text-button" type="button" onClick={() => onNavigate('explore')}>Explore</button>
          <button className="text-button" type="button" onClick={() => onNavigate('dashboard')}>Progress</button>
          <button className="text-button" type="button" onClick={() => onNavigate('settings')}>Settings</button>
        </nav>
      </header>
    </>
  );
}

function QuestMap({ arc, activeQuestId }) {
  return (
    <section className="quest-map" aria-labelledby="quest-map-title">
      <div><p className="eyebrow">Story arc</p><h2 id="quest-map-title">The clue trail</h2></div>
      <ol>
        {arc.map(({ quest, state }, index) => <li key={quest.id} className={`map-stop is-${state} ${quest.id === activeQuestId ? 'is-active' : ''}`}><span aria-hidden="true">{state === 'complete' ? '✓' : index + 1}</span><p>{quest.title}</p><small>{state === 'complete' ? 'Story fragment found' : state === 'current' ? 'In progress' : state === 'locked' ? 'Opens as the trail grows' : 'Ready to explore'}</small></li>)}
      </ol>
    </section>
  );
}

function QuestCard({ quest, complete, bookmarked, recommended, progress, onStart, onBookmark }) {
  const completion = questCompletionLabel(quest, progress);
  return (
    <article className={`library-quest ${complete ? 'is-complete' : ''} ${recommended ? 'is-recommended' : ''}`}>
      <div className="library-quest-heading"><span>{recommended ? 'Recommended route' : complete ? 'Completed route' : 'Available quest'}</span><button className="icon-button" type="button" aria-label={`${bookmarked ? 'Remove' : 'Add'} ${quest.title} ${bookmarked ? 'from' : 'to'} bookmarks`} aria-pressed={bookmarked} onClick={() => onBookmark(quest.id)}>{bookmarked ? '★' : '☆'}</button></div>
      <h3>{quest.title}</h3><p>{quest.topic} · {quest.difficulty}</p>
      <div className="tag-row">{quest.skillTags.map((tag) => <span key={tag}>{humanSkill(tag)}</span>)}</div>
      <p className="card-progress">{complete ? 'Story fragment collected' : completion.answered ? `${completion.answered} of ${completion.total} clues explored` : 'Three evidence clues to find'}</p>
      <div className="library-quest-footer"><small>◷ {quest.readingTimeMinutes} min</small><button type="button" className="library-start" onClick={() => onStart(quest)}>{complete ? 'Replay quest' : completion.answered ? 'Resume quest' : 'Start quest'} <span aria-hidden="true">→</span></button></div>
      <SourceNotice source={quest.source} />
    </article>
  );
}

function questCompletionLabel(quest, progress) {
  const answered = quest.questions.filter((question) => responseFor(progress, quest.id, question.id)).length;
  return { answered, total: quest.questions.length };
}

function Onboarding({ onContinue }) {
  return (
    <section className="onboarding-view narrow-view" aria-labelledby="onboarding-title">
      <p className="eyebrow">Welcome, explorer</p><h1 id="onboarding-title">Read → Answer → Understand → Grow</h1>
      <p className="lede">Each short quest asks you to make an idea, find the sentence that supports it, and see what the clue changes in the story.</p>
      <div className="routine-grid onboarding-steps"><article><span>1</span><h2>Read</h2><p>Look for what the passage is telling you.</p></article><article><span>2</span><h2>Answer</h2><p>Choose your best idea and a sentence that proves it.</p></article><article><span>3</span><h2>Grow</h2><p>Use feedback to collect a clue and try another route.</p></article></div>
      <button className="primary-button" type="button" onClick={onContinue}>Choose my first quest <span aria-hidden="true">→</span></button>
      <p className="quiet">This anonymous demo keeps its progress only in this browser. It does not ask for a name, email, or school account.</p>
    </section>
  );
}

function ControlsPanel({ progress, onUpdate, onJudge, onReset }) {
  const soundOn = progress.settings.soundEnabled;
  return (
    <section className="settings-view narrow-view" aria-labelledby="settings-title">
      <p className="eyebrow">Local demo controls</p><h1 id="settings-title">Make the quest yours</h1>
      <div className="settings-grid">
        <section><h2>Reading comfort</h2><label htmlFor="text-size">Text size</label><select id="text-size" value={progress.settings.textSize} onChange={(event) => onUpdate({ textSize: event.target.value })}><option value="regular">Regular</option><option value="large">Large</option><option value="extra-large">Extra large</option></select><label className="toggle-row"><input type="checkbox" checked={progress.settings.reduceMotion} onChange={(event) => onUpdate({ reduceMotion: event.target.checked })} /><span>Reduce animation</span></label></section>
        <section className="sound-settings"><h2>Feedback</h2><label className="toggle-row sound-switch"><input type="checkbox" checked={soundOn} onChange={(event) => onUpdate({ soundEnabled: event.target.checked })} /><span>Sound cues</span></label><p className="setting-description">Short, optional tones for feedback and completion.</p><fieldset disabled={!soundOn}><legend>Sound options</legend><label htmlFor="sound-volume">Volume</label><select id="sound-volume" value={progress.settings.soundVolume} onChange={(event) => onUpdate({ soundVolume: event.target.value })}><option value="soft">Soft</option><option value="standard">Standard</option></select><label className="toggle-row"><input type="checkbox" checked={progress.settings.soundFeedback} onChange={(event) => onUpdate({ soundFeedback: event.target.checked })} /><span>Answer and evidence feedback</span></label><label className="toggle-row"><input type="checkbox" checked={progress.settings.soundCompletion} onChange={(event) => onUpdate({ soundCompletion: event.target.checked })} /><span>Quest completion</span></label><button className="secondary-button sound-preview" type="button" onClick={() => playCue('success', progress.settings)}>Play a sample</button></fieldset><label className="toggle-row"><input type="checkbox" checked={progress.settings.hideGameSignals} onChange={(event) => onUpdate({ hideGameSignals: event.target.checked })} /><span>Hide XP and streaks</span></label><p className="quiet">Visual feedback always appears whether sound is on or off.</p></section>
        <section className="appearance-settings"><h2>Appearance</h2><fieldset className="mode-picker"><legend>Color mode</legend><div>{COLOR_MODE_OPTIONS.map(([mode, label]) => <label key={mode} className={progress.settings.colorMode === mode ? 'is-selected' : ''}><input type="radio" name="color-mode" value={mode} checked={progress.settings.colorMode === mode} onChange={() => onUpdate({ colorMode: mode })} /><span>{label}</span></label>)}</div></fieldset><fieldset className="palette-picker"><legend>Quest palette</legend><div className="theme-buttons">{THEME_OPTIONS.map(([theme, label]) => <button key={theme} type="button" aria-pressed={progress.settings.theme === theme} className={progress.settings.theme === theme ? 'is-selected' : ''} onClick={() => onUpdate({ theme })}>{label}</button>)}</div></fieldset><p className="quiet">System default follows your device. Every choice stays in this browser.</p></section>
        <section><h2>Judge mode</h2><p>Load a deterministic local snapshot with one completed quest, sample XP, and badges.</p><button className="secondary-button" type="button" onClick={onJudge}>Load demo snapshot</button><button className="text-button danger-button" type="button" onClick={onReset}>Reset all local progress</button></section>
      </div>
      <section className="privacy-note"><h2>Privacy notice</h2><p>LitLearn’s browser demo has no account connection, analytics upload, ads, or real learner identifiers. Cloud features remain staged until an approved backend and privacy model are available.</p></section>
    </section>
  );
}

function ReviewScreen({ quest, progress, onBack }) {
  const [selectedId, setSelectedId] = useState(quest.questions[0]?.id);
  const question = quest.questions.find((item) => item.id === selectedId) ?? quest.questions[0];
  const response = responseFor(progress, quest.id, question.id);
  return (
    <section className="review-view narrow-view" aria-labelledby="review-title">
      <p className="eyebrow">Completed quest review</p><h1 id="review-title">Follow the evidence trail again</h1>
      <div className="review-tabs" role="tablist" aria-label="Question review">
        {quest.questions.map((item, index) => <button key={item.id} type="button" role="tab" aria-selected={selectedId === item.id} onClick={() => setSelectedId(item.id)}>Question {index + 1}</button>)}
      </div>
      <section className="review-card"><h2>{question.prompt}</h2><p><strong>Your answer:</strong> {response ? choiceById(question, response.answerId)?.text : 'Not recorded'}</p><p><strong>Your evidence:</strong> {response ? sentenceById(quest, response.evidenceId)?.text : 'Not recorded'}</p><div className="explanation"><strong>Why this clue fits:</strong> {question.explanation}</div><article className="evidence-passage" aria-label="Passage evidence review">{sentencesFor(quest).map((sentence) => <p key={sentence.id} className={sentence.id === question.correctEvidenceSentenceId ? 'is-evidence' : ''}>{sentence.id === question.correctEvidenceSentenceId ? <mark>{sentence.text}</mark> : sentence.text}</p>)}</article></section>
      <button className="secondary-button" type="button" onClick={onBack}>Back to progress</button>
    </section>
  );
}

function FeatureLab({ progress, quests, onStatus, onSetting }) {
  const [tab, setTab] = useState('discovery');
  const [search, setSearch] = useState('');
  const [coachNote, setCoachNote] = useState('');
  const [shortAnswer, setShortAnswer] = useState('');
  const [shortFeedback, setShortFeedback] = useState('');
  const results = discoveryMatches(search);
  const recent = progress.responses.at(-1);
  const recentQuest = recent && questById(quests, recent.questId);
  const recentQuestion = recentQuest?.questions.find((question) => question.id === recent.questionId);
  const tabs = [['discovery', 'Discovery'], ['coach', 'Coach'], ['path', 'Reading plan'], ['tutor', 'Tutor'], ['circle', 'Circle'], ['plans', 'Plans'], ['world', 'World'], ['analytics', 'Signals'], ['account', 'Privacy']];
  return (
    <section className="feature-view" aria-labelledby="feature-title">
      <div className="feature-heading"><div><p className="eyebrow">Staged frontend workspace</p><h1 id="feature-title">Explore what comes next</h1><p>These views work with local demo data. Features that need accounts, classroom rosters, catalog search, or cloud sync stay behind a visible staging flag.</p></div><span className="stage-flag">{CLOUD_FEATURES_ENABLED ? 'Cloud connected' : 'Local preview mode'}</span></div>
      <div className="feature-tabs" role="tablist" aria-label="Explore features">{tabs.map(([id, label]) => <button type="button" key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>{label}</button>)}</div>
      {tab === 'discovery' && <section className="feature-card"><h2>Public-domain discovery</h2><p>Search title, author, language, or topic. The results below are local metadata previews until the optional Gutendex service is connected.</p><label className="search-label" htmlFor="discovery-search">Search preview catalog</label><div className="search-row"><input id="discovery-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Try mystery, science, or English" /><button className="secondary-button" type="button" onClick={() => onStatus('Catalog search saved locally; live Gutendex lookup is staged.')}>Search</button></div><div className="preview-grid">{results.map((item) => <article key={item.id}><h3>{item.title}</h3><p>{item.author} · {item.language}</p><p>{item.topic}</p><small>{item.rights} · {item.source}</small><button className="text-button" type="button" onClick={() => onStatus(`${item.title} is a catalog preview. Reviewed quest data remains local.`)}>View source details</button></article>)}</div></section>}
      {tab === 'coach' && <section className="feature-card"><h2>Reading coach</h2><p>The local fallback explains the same reviewed evidence shown in a quest. AI connection is staged and no text leaves the browser.</p><button className="primary-button" type="button" onClick={() => setCoachNote(coachFallback(recentQuestion, recent))}>Explain my latest reasoning</button>{coachNote && <div className="coach-response" aria-live="polite">{coachNote}</div>}<hr /><h3>Short-answer practice preview</h3><label htmlFor="short-answer">Write one sentence that connects an idea to a clue</label><textarea id="short-answer" value={shortAnswer} onChange={(event) => setShortAnswer(event.target.value)} placeholder="My idea is... The text shows this when..." /><button className="secondary-button" type="button" onClick={() => setShortFeedback(shortAnswer.trim().length > 20 ? 'Good start: you gave the coach enough detail to check for both an idea and a clue. A reviewed rubric service is staged for fuller feedback.' : 'Try adding both your idea and a sentence or detail from the passage.')}>Check local rubric</button>{shortFeedback && <p className="coach-response" aria-live="polite">{shortFeedback}</p>}</section>}
      {tab === 'path' && <section className="feature-card"><h2>Adaptive reading plan</h2><p>The local plan uses only this browser’s practice record. It makes a transparent recommendation and never locks a learner into a level or route.</p><div className="analytics-grid"><article><h3>Suggested next skill</h3><p>{skillSummary(quests, progress).sort((left, right) => left.attempts - right.attempts)[0] ? humanSkill(skillSummary(quests, progress).sort((left, right) => left.attempts - right.attempts)[0].key) : 'Choose a skill to practice'}</p><button className="secondary-button" type="button" onClick={() => onStatus('The local plan recommends an unfinished quest. Adaptive difficulty rules are staged for reviewed content and backend support.')}>Use local recommendation</button></article><article><h3>Plan controls</h3><p>Challenge, growing, and beginner paths will remain optional choices when adaptive difficulty is connected.</p><button className="secondary-button" type="button" onClick={() => onStatus('Reading-plan preferences are local preview controls; no learner profile is created.')}>Preview path choices</button></article></div></section>}
      {tab === 'tutor' && <section className="feature-card"><h2>Tutor workspace</h2><p>Assignments, learner groups, and synced reports need an approved backend. This local preview keeps the anonymous evidence record visible.</p><div className="stat-grid compact-stats"><article><span>Completed</span><strong>{progress.completedQuestIds.length}</strong><small>Local quests</small></article><article><span>Evidence reveals</span><strong>{progress.signals.evidenceReveals}</strong><small>Learning support used</small></article><article><span>Questions flagged</span><strong>{progress.confusingQuestionIds.length}</strong><small>For content review</small></article></div><button className="secondary-button" type="button" onClick={() => onStatus('A local assignment draft is ready to preview. Sync and classroom rosters remain staged.')}>Create local assignment draft</button></section>}
      {tab === 'circle' && <section className="feature-card"><h2>Private reading circles</h2><p>Reading circles and social challenges are designed as opt-in, adult-managed features. The local preview does not create accounts, send invitations, or expose learner activity.</p><label className="toggle-row"><input type="checkbox" checked={progress.settings.hideGameSignals} onChange={(event) => onSetting({ hideGameSignals: event.target.checked })} /><span>Hide competitive game signals</span></label><button className="secondary-button" type="button" onClick={() => onStatus('Circle setup is staged until consent, moderation, and privacy controls are connected.')}>Preview circle privacy rules</button></section>}
      {tab === 'plans' && <section className="feature-card"><h2>Plans and practice accounts</h2><div className="preview-grid"><article><h3>Explorer</h3><p>Local quests, evidence feedback, and personal progress.</p><button className="secondary-button" type="button" onClick={() => onStatus('Explorer is active in this browser demo.')}>Current local plan</button></article><article><h3>Tutor practice</h3><p>Assignments, evidence summaries, and up to 40 active learners.</p><button className="secondary-button" type="button" onClick={() => onStatus('Tutor billing and multi-account access require a server integration.')}>Preview tutor plan</button></article><article><h3>Program</h3><p>Shared reporting and privacy-reviewed learner groups.</p><button className="secondary-button" type="button" onClick={() => onStatus('Program subscriptions are staged pending privacy and roster support.')}>Preview program plan</button></article></div></section>}
      {tab === 'world' && <section className="feature-card"><h2>Companion &amp; quest world</h2><p>Choose a local palette and companion detail. These cosmetic choices do not affect reading content or scores.</p><div className="theme-buttons">{THEME_OPTIONS.map(([theme, label]) => <button key={theme} type="button" aria-pressed={progress.settings.theme === theme} className={progress.settings.theme === theme ? 'is-selected' : ''} onClick={() => onSetting({ theme })}>{label}</button>)}</div><label className="toggle-row"><input type="checkbox" checked={progress.settings.soundEnabled} onChange={(event) => onSetting({ soundEnabled: event.target.checked })} /><span>Enable optional sound cues</span></label><p className="quiet">Choose color mode, palette, and cue types in Settings. Music and ambient audio remain staged until licensed audio is available.</p></section>}
      {tab === 'analytics' && <section className="feature-card"><h2>Engagement and learning signals</h2><p>These local numbers are separated so activity is never presented as proof of learning.</p><div className="analytics-grid"><article><h3>Engagement</h3><p>Quest starts: {progress.signals.questStarts}</p><p>Completions: {progress.signals.completedQuestCount}</p><p>Next-quest choices: {progress.signals.nextQuestSelections}</p></article><article><h3>Learning practice</h3><p>Responses recorded: {progress.responses.length}</p><p>Evidence reveals: {progress.signals.evidenceReveals}</p><p>Questions flagged: {progress.confusingQuestionIds.length}</p></article></div></section>}
      {tab === 'account' && <section className="feature-card"><h2>Account &amp; privacy settings</h2><p>This demo uses an anonymous local profile. Authentication, synced progress, data deletion requests, and learner settings require an approved backend and privacy review.</p><button className="secondary-button" type="button" onClick={() => onStatus('Account connection is intentionally unavailable in the anonymous demo.')}>Preview account connection</button><button className="text-button" type="button" onClick={() => onStatus('Local progress can be deleted from Settings with Reset all local progress.')}>How local data works</button></section>}
    </section>
  );
}

export default function App() {
  const [progress, setProgress] = useState(loadProgress);
  const [screen, setScreen] = useState(() => loadProgress().onboardingComplete ? loadProgress().activeSession?.screen || 'home' : 'onboarding');
  const [questionIndex, setQuestionIndex] = useState(() => loadProgress().activeSession?.questionIndex || 0);
  const [draft, setDraft] = useState({ answerId: '', evidenceId: '' });
  const [revealed, setRevealed] = useState(false);
  const [filters, setFilters] = useState({ search: '', topic: '', skill: '', difficulty: '', bookmarkOnly: false });
  const [apiState, setApiState] = useState({ kind: 'checking', label: 'Checking optional service…' });
  const [notice, setNotice] = useState('');
  const [showCelebration, setShowCelebration] = useState(true);
  const mainRef = useRef(null);
  const countedVisit = useRef(false);

  const quests = useMemo(() => reviewedQuests(BUNDLED_QUESTS), []);
  const unavailableCount = BUNDLED_QUESTS.length - quests.length;
  const skills = useMemo(() => skillSummary(quests, progress), [quests, progress]);
  const recommendation = useMemo(() => recommendQuest(quests, progress, skills), [quests, progress, skills]);
  const activeQuestId = progress.activeSession?.questId ?? progress.selectedQuestId ?? recommendation.quest?.id;
  const quest = questById(quests, activeQuestId) || recommendation.quest || null;
  const content = rightsStatus(quest);
  const questions = quest?.questions ?? [];
  const activeQuestion = questions[questionIndex];
  const activeResponse = activeQuestion ? responseFor(progress, quest?.id, activeQuestion.id) : null;
  const questResponses = quest ? responsesForQuest(progress, quest.id) : [];
  const filteredQuests = useMemo(() => filterQuests(quests, { ...filters, bookmarked: filters.bookmarkOnly ? progress.bookmarkedQuestIds : null }), [quests, filters, progress.bookmarkedQuestIds]);
  const dailyGoal = dailyGoalStatus(progress);
  const arc = storyArc(quests, progress);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/health', { signal: controller.signal })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('Unavailable')))
      .then((data) => setApiState({ kind: 'ready', label: data.status || 'Optional API available' }))
      .catch((error) => { if (error.name !== 'AbortError') setApiState({ kind: 'offline', label: 'Offline demo mode — reviewed local quests are ready.' }); });
    return () => controller.abort();
  }, []);
  useEffect(() => { saveProgress(progress); }, [progress]);
  useEffect(() => {
    const root = document.documentElement;
    const systemMode = window.matchMedia('(prefers-color-scheme: dark)');
    const applyAppearance = () => {
      const selectedMode = progress.settings.colorMode || 'system';
      const resolvedMode = selectedMode === 'system' ? (systemMode.matches ? 'dark' : 'light') : selectedMode;
      root.dataset.textSize = progress.settings.textSize;
      root.dataset.theme = progress.settings.theme;
      root.dataset.colorMode = selectedMode;
      root.dataset.resolvedMode = resolvedMode;
      root.style.colorScheme = resolvedMode;
      root.classList.toggle('reduce-motion', progress.settings.reduceMotion);
    };
    applyAppearance();
    systemMode.addEventListener?.('change', applyAppearance);
    return () => systemMode.removeEventListener?.('change', applyAppearance);
  }, [progress.settings.colorMode, progress.settings.reduceMotion, progress.settings.textSize, progress.settings.theme]);
  useEffect(() => { mainRef.current?.focus(); }, [screen]);
  useEffect(() => { if (!countedVisit.current) { countedVisit.current = true; setProgress((current) => recordReturnVisit(current)); } }, []);
  useEffect(() => {
    if (!revealed || !activeQuestion) return undefined;
    const timer = window.setTimeout(() => document.getElementById(`evidence-${activeQuestion.correctEvidenceSentenceId}`)?.scrollIntoView({ behavior: progress.settings.reduceMotion ? 'auto' : 'smooth', block: 'center' }), 30);
    return () => window.clearTimeout(timer);
  }, [revealed, activeQuestion?.correctEvidenceSentenceId, progress.settings.reduceMotion]);

  function navigate(nextScreen, options = {}) {
    const nextQuestId = options.questId ?? quest?.id ?? null;
    const nextIndex = options.questionIndex ?? questionIndex;
    setScreen(nextScreen); setQuestionIndex(nextIndex); setRevealed(false); setNotice('');
    if (QUEST_SCREENS.has(nextScreen) && nextQuestId) setProgress((current) => setActiveSession(current, { questId: nextQuestId, screen: nextScreen, questionIndex: nextIndex }));
  }

  function launchQuest(nextQuest) {
    if (!rightsStatus(nextQuest).ready) { setNotice('This quest is waiting for reviewed content metadata.'); return; }
    const existing = progress.activeSession?.questId === nextQuest.id ? progress.activeSession : null;
    if (existing) { navigate(existing.screen, { questId: nextQuest.id, questionIndex: existing.questionIndex }); return; }
    setDraft({ answerId: '', evidenceId: '' }); setQuestionIndex(0); setRevealed(false); setScreen('example');
    setProgress((current) => beginQuest(current, nextQuest.id));
  }

  function beginQuestion(index) {
    const existing = responseFor(progress, quest.id, questions[index].id);
    setDraft({ answerId: existing?.answerId || '', evidenceId: existing?.evidenceId || '' });
    navigate('question', { questionIndex: index });
  }

  function submitResponse() {
    if (!draft.answerId || !draft.evidenceId || !activeQuestion) return;
    const response = { questId: quest.id, questionId: activeQuestion.id, answerId: draft.answerId, evidenceId: draft.evidenceId, answerCorrect: draft.answerId === activeQuestion.correctChoiceId, evidenceCorrect: draft.evidenceId === activeQuestion.correctEvidenceSentenceId, submittedAt: new Date().toISOString() };
    setProgress((current) => setActiveSession(recordResponse(current, response), { questId: quest.id, screen: 'feedback', questionIndex }));
    if (progress.settings.soundEnabled && progress.settings.soundFeedback) playCue(response.evidenceCorrect ? 'success' : 'retry', progress.settings);
    setScreen('feedback'); setRevealed(false);
  }

  function revealEvidence() {
    setRevealed(true);
    setProgress((current) => markEvidenceReveal(current));
    if (progress.settings.soundEnabled && progress.settings.soundFeedback) playCue('reveal', progress.settings);
  }

  function finishQuest() {
    const correctAnswers = questResponses.filter((response) => response.answerCorrect).length;
    const correctEvidence = questResponses.filter((response) => response.evidenceCorrect).length;
    setProgress((current) => completeQuest(current, quest.id, { correctAnswers, correctEvidence, questionCount: questions.length }));
    if (progress.settings.soundEnabled && progress.settings.soundCompletion) playCue('completion', progress.settings);
    setShowCelebration(true); setScreen('complete'); setRevealed(false);
  }

  function updateSettings(settings) { setProgress((current) => setProgressSettings(current, settings)); }
  function resetDemo() {
    if (window.confirm('Reset this browser’s anonymous LitLearn progress, settings, and local demo data?')) {
      setProgress(resetProgress()); setScreen('onboarding'); setQuestionIndex(0); setDraft({ answerId: '', evidenceId: '' }); setRevealed(false); setNotice('');
    }
  }
  function loadJudgeDemo() {
    if (window.confirm('Load the deterministic judge snapshot? It replaces current local progress.')) { setProgress(createJudgeProgress(quests)); setScreen('home'); setQuestionIndex(0); setNotice('Judge snapshot loaded.'); }
  }
  function finishOnboarding() { setProgress((current) => completeOnboarding(current)); setScreen('home'); }
  function addStatus(message) { setNotice(message); }
  function markAccessory(accessory) { setProgress((current) => ({ ...current, activeAccessoryId: accessory })); }

  const correctAnswers = questResponses.filter((response) => response.answerCorrect).length;
  const correctEvidence = questResponses.filter((response) => response.evidenceCorrect).length;

  return (
    <div className="app-shell">
      <AppHeader progress={progress} screen={screen} onNavigate={navigate} />
      <main className="main-stage" ref={mainRef} tabIndex="-1">
        {notice && <div className="app-notice" role="status"><span>{notice}</span><button type="button" aria-label="Dismiss message" onClick={() => setNotice('')}>×</button></div>}
        {screen === 'onboarding' && <Onboarding onContinue={finishOnboarding} />}
        {screen === 'home' && <section className="home-view" aria-labelledby="home-title">
          <div className="home-copy"><p className="eyebrow">Your next reading adventure</p><h1 id="home-title">Find the clue. <em>Light the path.</em></h1><p className="lede">LitLearn makes evidence practice feel like a small adventure. Careful reasoning—not speed—moves your story forward.</p><div className="how-it-works" aria-label="How LitLearn works"><span>Read the story</span><span>Find the proof</span><span>Grow your trail</span></div><div className="button-row"><button className="primary-button" type="button" disabled={!recommendation.quest} onClick={() => launchQuest(recommendation.quest)}>{recommendation.kind === 'resume' ? 'Resume your quest' : 'Start recommended quest'} <span aria-hidden="true">→</span></button><button className="secondary-button" type="button" onClick={() => navigate('dashboard')}>View practice summary</button></div><p className={`api-note is-${apiState.kind}`}><span className="status-dot" /> {apiState.label}</p></div>
          <div className="quest-preview"><div className="quest-world"><QuestHeroIllustration /></div>{recommendation.quest ? <><p className="card-label">{recommendation.kind === 'resume' ? 'Continue your route' : 'Recommended quest'}</p><h2>{recommendation.quest.title}</h2><p>{recommendation.quest.topic} · {recommendation.quest.difficulty}</p><div className="tag-row">{recommendation.quest.skillTags.map((tag) => <span key={tag}>{humanSkill(tag)}</span>)}</div><p className="time-label">◷ About {recommendation.quest.readingTimeMinutes} minutes · 3 evidence choices</p><p className="recommendation-reason">{recommendation.reason}</p><SourceNotice source={recommendation.quest.source} /></> : <section className="content-gate"><h2>Reviewed quests are loading.</h2><p>Local quest content will appear here once it passes its source and evidence checks.</p></section>}</div>
          <QuestMap arc={arc} activeQuestId={quest?.id} />
          <section className="library-controls" aria-labelledby="library-title"><div><p className="eyebrow">Choose your quest</p><h2 id="library-title">The local quest library</h2></div><label className="search-label" htmlFor="quest-search">Search quests<input id="quest-search" value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} placeholder="Title, topic, or skill" /></label><label>Topic<select value={filters.topic} onChange={(event) => setFilters((current) => ({ ...current, topic: event.target.value }))}><option value="">All topics</option>{[...new Set(quests.map((item) => item.topic))].map((topic) => <option key={topic}>{topic}</option>)}</select></label><label>Skill<select value={filters.skill} onChange={(event) => setFilters((current) => ({ ...current, skill: event.target.value }))}><option value="">All skills</option>{[...new Set(quests.flatMap((item) => item.skillTags))].map((skill) => <option key={skill}>{humanSkill(skill)}</option>)}</select></label><label>Difficulty<select value={filters.difficulty} onChange={(event) => setFilters((current) => ({ ...current, difficulty: event.target.value }))}><option value="">All levels</option>{[...new Set(quests.map((item) => item.difficulty))].map((difficulty) => <option key={difficulty}>{difficulty}</option>)}</select></label><label className="toggle-row"><input type="checkbox" checked={filters.bookmarkOnly} onChange={(event) => setFilters((current) => ({ ...current, bookmarkOnly: event.target.checked }))} /><span>Bookmarks only</span></label></section>
          {progress.activeSession && <section className="resume-banner"><div><strong>Resume where you left off</strong><p>{questById(quests, progress.activeSession.questId)?.title || 'Your local quest'} · question {progress.activeSession.questionIndex + 1}</p></div><button className="secondary-button" type="button" onClick={() => navigate(progress.activeSession.screen, { questId: progress.activeSession.questId, questionIndex: progress.activeSession.questionIndex })}>Resume</button></section>}
          {filteredQuests.length ? <div className="library-grid">{filteredQuests.map((item) => <QuestCard key={item.id} quest={item} complete={isQuestComplete(progress, item.id)} bookmarked={progress.bookmarkedQuestIds.includes(item.id)} recommended={recommendation.quest?.id === item.id} progress={progress} onStart={launchQuest} onBookmark={(id) => setProgress((current) => toggleBookmark(current, id))} />)}</div> : <section className="empty-summary"><h2>No quests match those filters</h2><p>Clear a filter or bookmark a quest to bring it back into your library.</p><button className="secondary-button" type="button" onClick={() => setFilters({ search: '', topic: '', skill: '', difficulty: '', bookmarkOnly: false })}>Clear filters</button></section>}
          {unavailableCount > 0 && <section className="content-gate"><h2>{unavailableCount} quest{unavailableCount === 1 ? '' : 's'} unavailable</h2><p>They are hidden until source, rights, and sentence-evidence metadata are reviewed.</p></section>}
          <Guide accessory={progress.activeAccessoryId} message="Choose a quest, then look for the line that proves your idea." />
        </section>}
        {screen === 'example' && content.ready && <section className="lesson-view narrow-view" aria-labelledby="example-title"><p className="eyebrow">{quest.title} · worked example</p><h1 id="example-title">{quest.workedExample.title || 'Try the evidence routine'}</h1><div className="routine-grid"><article><span>1</span><h2>Notice</h2><p>{quest.workedExample.notice}</p></article><article><span>2</span><h2>Think</h2><p>{quest.workedExample.think}</p></article><article><span>3</span><h2>Prove</h2><p>{quest.workedExample.prove}</p></article></div><div className="example-callout"><strong>Example answer:</strong> {quest.workedExample.answer}<br /><strong>Evidence:</strong> {quest.workedExample.evidence}</div><div className="button-row"><button className="primary-button" type="button" onClick={() => navigate('reading')}>Read the passage <span aria-hidden="true">→</span></button><button className="text-button" type="button" onClick={() => navigate('reading')}>Skip example</button></div><Guide accessory={progress.activeAccessoryId} message="First, watch the routine. Then you will try it yourself." /></section>}
        {screen === 'reading' && content.ready && <section className="reading-view" aria-labelledby="reading-title"><div className="reading-heading"><div><p className="eyebrow">{quest.skillTags.map(humanSkill).join(' + ')}</p><h1 id="reading-title">{quest.title}</h1><p>{quest.topic} · about {quest.readingTimeMinutes} minutes</p></div><div className="reading-meter" aria-label="Reading step complete"><span>Reading</span><strong>1 / 2</strong><i><b /></i></div></div><article className="passage-card" aria-label={`${quest.title} passage`}>{sentencesFor(quest).map((sentence) => <p key={sentence.id} id={`passage-${sentence.id}`}>{sentence.text}</p>)}</article><div className="reading-footer"><p>When you are ready, answer one question at a time and choose the sentence that supports your idea.</p><button className="primary-button" type="button" onClick={() => beginQuestion(0)}>Start questions <span aria-hidden="true">→</span></button></div><Guide accessory={progress.activeAccessoryId} mood="thoughtful" message="There is no speed bonus. Take the time you need to find the strongest clue." /></section>}
        {screen === 'question' && content.ready && activeQuestion && <section className="question-view narrow-view" aria-labelledby="question-title"><div className="question-progress" aria-label={`Question ${questionIndex + 1} of ${questions.length}`}><span>Question {questionIndex + 1} of {questions.length}</span><div className="clue-trail" aria-label={`${questionIndex} of ${questions.length} evidence clues collected`}>{questions.map((question, index) => { const response = responseFor(progress, quest.id, question.id); return <i key={question.id} className={index === questionIndex ? 'is-current' : response?.evidenceCorrect ? 'is-strong' : response ? 'is-practice' : ''}>{response ? response.evidenceCorrect ? '✦' : '•' : index + 1}</i>; })}</div></div><p className="eyebrow">{quest.title} · skill: {humanSkill(questionSkill(activeQuestion, quest))}</p><h1 id="question-title">{activeQuestion.prompt}</h1><fieldset className="choice-fieldset"><legend>1. Choose your answer</legend>{activeQuestion.choices.map((choice) => <label className={`choice-card ${draft.answerId === choice.id ? 'selected' : ''}`} key={choice.id}><input type="radio" name="answer" value={choice.id} checked={draft.answerId === choice.id} onChange={() => setDraft((current) => ({ ...current, answerId: choice.id }))} /><span>{choice.text}</span></label>)}</fieldset><fieldset className="choice-fieldset evidence-fieldset"><legend>2. Choose the sentence that best supports your answer</legend><p className="field-help">Your evidence is saved before feedback appears.</p>{activeQuestion.evidenceSentenceIds.map((sentenceId) => { const sentence = sentenceById(quest, sentenceId); return sentence ? <label className={`choice-card evidence-choice ${draft.evidenceId === sentenceId ? 'selected' : ''}`} key={sentenceId}><input type="radio" name="evidence" value={sentenceId} checked={draft.evidenceId === sentenceId} onChange={() => setDraft((current) => ({ ...current, evidenceId: sentenceId }))} /><span>{sentence.text}</span></label> : null; })}</fieldset><button className="primary-button" type="button" onClick={submitResponse} disabled={!draft.answerId || !draft.evidenceId}>Submit answer &amp; evidence <span aria-hidden="true">→</span></button><Guide accessory={progress.activeAccessoryId} message="Choose an answer, then the sentence that best supports it." /></section>}
        {screen === 'feedback' && content.ready && activeQuestion && activeResponse && <section className="feedback-view narrow-view" aria-labelledby="feedback-title"><p className="eyebrow">{quest.title} · your feedback</p><h1 id="feedback-title">{activeResponse.answerCorrect && activeResponse.evidenceCorrect ? 'That idea is well supported.' : 'Let’s check the proof together.'}</h1><div className="feedback-grid"><article><span className={activeResponse.answerCorrect ? 'result-good' : 'result-note'}>{activeResponse.answerCorrect ? '✓' : '↗'}</span><h2>Your answer</h2><p>{choiceById(activeQuestion, activeResponse.answerId)?.text}</p></article><article><span className={activeResponse.evidenceCorrect ? 'result-good' : 'result-note'}>{activeResponse.evidenceCorrect ? '✓' : '↗'}</span><h2>Your evidence</h2><p>{sentenceById(quest, activeResponse.evidenceId)?.text}</p></article></div><div className="explanation"><strong>Why:</strong> {activeQuestion.explanation}</div><button className="text-button" type="button" aria-pressed={progress.confusingQuestionIds.includes(activeQuestion.id)} onClick={() => setProgress((current) => toggleConfusingQuestion(current, activeQuestion.id))}>{progress.confusingQuestionIds.includes(activeQuestion.id) ? 'Marked for local review' : 'This question seems confusing'}</button>{!revealed ? <button className="secondary-button" type="button" onClick={revealEvidence}>Show passage evidence</button> : <div className="evidence-reveal" aria-live="polite"><p className="eyebrow">Passage evidence</p><p>The highlighted sentence is the strongest support for the answer.</p><article className="evidence-passage" aria-label="Passage with supporting evidence highlighted">{sentencesFor(quest).map((sentence) => <p key={sentence.id} id={`evidence-${sentence.id}`} className={sentence.id === activeQuestion.correctEvidenceSentenceId ? 'is-evidence' : ''}>{sentence.id === activeQuestion.correctEvidenceSentenceId ? <mark>{sentence.text}</mark> : sentence.text}</p>)}</article></div>}<div className="button-row"><button className="primary-button" type="button" onClick={() => navigate('consequence')}>See what your clue changes <span aria-hidden="true">→</span></button></div><Guide accessory={progress.activeAccessoryId} mood={activeResponse.evidenceCorrect ? 'happy' : 'thoughtful'} message={activeResponse.evidenceCorrect ? 'That clue lights a stronger route on your map.' : 'A practice clue still helps the guide map the next route.'} /></section>}
        {screen === 'consequence' && content.ready && activeQuestion && activeResponse && <section className="consequence-view narrow-view" aria-labelledby="consequence-title"><div className={`consequence-scene ${activeResponse.evidenceCorrect ? 'scene-unlocked' : 'scene-mapped'}`} aria-hidden="true"><span>✦</span><span>⌁</span><span>◌</span></div><p className="eyebrow">{quest.title} · story consequence</p><h1 id="consequence-title">{activeResponse.evidenceCorrect ? activeQuestion.storyConsequence.strongTitle : activeQuestion.storyConsequence.practiceTitle}</h1><p className="consequence-copy">{activeResponse.evidenceCorrect ? activeQuestion.storyConsequence.strongMessage : activeQuestion.storyConsequence.practiceMessage}</p><p className="consequence-note">{activeResponse.evidenceCorrect ? 'Evidence Shard collected: the clearest route is now lit.' : 'Practice clue added: the guide marked the evidence for your next try.'}</p>{questionIndex < questions.length - 1 ? <button className="primary-button" type="button" onClick={() => beginQuestion(questionIndex + 1)}>Next question <span aria-hidden="true">→</span></button> : <button className="primary-button" type="button" onClick={finishQuest}>Finish quest <span aria-hidden="true">→</span></button>}<Guide accessory={progress.activeAccessoryId} mood={activeResponse.evidenceCorrect ? 'happy' : 'thoughtful'} message="Your evidence choice changed the story scene. Keep following the trail." /></section>}
        {screen === 'complete' && content.ready && <section className="complete-view narrow-view" aria-labelledby="complete-title">{showCelebration && <button className="skip-celebration" type="button" onClick={() => setShowCelebration(false)}>Skip celebration</button>}<div className={`completion-star ${showCelebration ? 'is-celebrating' : ''}`} aria-hidden="true">✦</div><p className="eyebrow">{quest.title} · quest complete</p><h1 id="complete-title">You followed the evidence trail.</h1><p className="completion-score">{correctAnswers} of {questions.length} answers matched the passage · {correctEvidence} of {questions.length} evidence choices were on target.</p><div className="reward-card"><span>+ {progress.lastCompletedQuestId === quest.id ? progress.lastCompletionXp : 0} XP</span><strong>Story fragment collected · {progress.badgeIds.includes(BADGES.EVIDENCE_EXPLORER) ? 'Strong Clue Finder badge earned' : 'Evidence Explorer badge earned'}</strong></div><div className="quest-debrief"><h2>Quest debrief</h2><p>You practiced {quest.skillTags.map(humanSkill).join(', ')}. Your next route can build on this clue trail or explore another skill.</p></div><div className="button-row"><button className="primary-button" type="button" onClick={() => navigate('review')}>Review your evidence <span aria-hidden="true">→</span></button><button className="secondary-button" type="button" onClick={() => navigate('dashboard')}>View progress</button><button className="text-button" type="button" onClick={() => navigate('home')}>Choose another quest</button></div><Guide accessory={progress.activeAccessoryId} mood="happy" message="A new story fragment is in your journal. Your next quest is ready whenever you are." /></section>}
        {screen === 'review' && content.ready && <ReviewScreen quest={quest} progress={progress} onBack={() => navigate('dashboard')} />}
        {screen === 'dashboard' && <section className="dashboard-view" aria-labelledby="dashboard-title"><div className="dashboard-heading"><div><p className="eyebrow">Anonymous learner · local demo</p><h1 id="dashboard-title">Practice &amp; progress</h1><p>This view records practice signals to guide a next step. It is not a diagnosis or a measure of mastery.</p></div><button className="secondary-button" type="button" onClick={resetDemo}>Reset demo progress</button></div><div className="stat-grid"><article><span>XP</span><strong>{progress.xp}</strong><small>Level {levelForXp(progress.xp)} · {xpIntoLevel(progress.xp)}/100 to next</small></article><article><span>Quest trail</span><strong>{progress.completedQuestIds.length}/{quests.length}</strong><small>{progress.storyFragmentIds.length} story fragments</small></article><article><span>Daily goal</span><strong>{dailyGoal.completed}/{dailyGoal.target}</strong><small>{dailyGoal.complete ? 'Goal complete' : 'One quest moves it forward'}</small></article><article><span>Streak</span><strong>{progress.streak.current}</strong><small>Days with a completed activity</small></article></div><section className="daily-goal"><div><p className="eyebrow">Flexible daily goal</p><h2>{dailyGoal.complete ? 'Today’s goal is complete' : 'Set a gentle reading goal'}</h2><p>{dailyGoal.completed} of {dailyGoal.target} completed today. Missing a day never removes earned progress.</p></div><div><label htmlFor="daily-target">Quest target</label><select id="daily-target" value={dailyGoal.target} onChange={(event) => setProgress((current) => setDailyGoalTarget(current, event.target.value))}><option value="1">1 quest</option><option value="2">2 quests</option><option value="3">3 quests</option></select></div></section><section className="skill-strengths" aria-labelledby="skill-strengths-title"><div><p className="eyebrow">Skill map</p><h2 id="skill-strengths-title">What this practice has covered</h2></div><div className="strength-grid">{skills.map((skill) => { const percent = skill.attempts ? Math.round((skill.evidenceCorrect / skill.attempts) * 100) : 0; return <article key={skill.key} tabIndex="0"><strong>{humanSkill(skill.key)}</strong><span>{skill.attempts ? `${skill.evidenceCorrect}/${skill.attempts} evidence choices on target` : 'Not practiced yet'}</span><i aria-label={`${percent}% evidence choices on target`}><b style={{ width: `${percent}%` }} /></i></article>; })}</div></section><section className="collection-panel"><div><p className="eyebrow">Collection journal</p><h2>Badges, fragments &amp; companion details</h2></div>{progress.badgeIds.length ? <div className="collection-list">{progress.badgeIds.map((badge) => <span key={badge}>✦ {BADGE_COPY[badge] || badge}</span>)}{progress.storyFragmentIds.map((fragment) => <span key={fragment}>▣ {fragment.replace('fragment-', '').replaceAll('-', ' ')}</span>)}</div> : <div className="empty-badges"><strong>No badges yet</strong><p>Finish a quest to add your first Evidence Explorer badge and story fragment.</p></div>}<div className="accessory-picker"><span>Guide accessory</span>{['compass', ...progress.unlockedAccessoryIds].map((accessory) => <button key={accessory} type="button" className={progress.activeAccessoryId === accessory ? 'is-selected' : ''} onClick={() => markAccessory(accessory)}>{humanSkill(accessory)}</button>)}</div></section>{quest && questResponses.length > 0 ? <section className="tutor-summary" aria-labelledby="tutor-summary-title"><div><p className="eyebrow">Tutor session summary</p><h2 id="tutor-summary-title">{quest.title}</h2><p>{quest.skillTags.map(humanSkill).join(' · ')} · {questResponses.length} responses recorded</p></div><div className="summary-rows">{questions.map((question, index) => { const response = responseFor(progress, quest.id, question.id); return <article key={question.id}><strong>Question {index + 1}</strong><p><span>Learner answer</span>{response ? choiceById(question, response.answerId)?.text : 'Not answered yet'}</p><p><span>Chosen evidence</span>{response ? sentenceById(quest, response.evidenceId)?.text : 'Not chosen yet'}</p><p><span>Suggested next practice</span>{question.followUpSuggestion}</p></article>; })}</div><button className="secondary-button" type="button" onClick={() => navigate('review')}>Review answer details</button></section> : <section className="empty-summary"><h2>No practice recorded for this quest yet</h2><p>Choose a reviewed quest to record anonymous answers, evidence choices, and a focused next practice.</p></section>}<section className="next-step"><div><p className="eyebrow">Next recommendation</p><h2>{recommendation.quest?.title || 'A reviewed local quest'}</h2><p>{recommendation.reason}</p></div><button className="primary-button" type="button" disabled={!recommendation.quest} onClick={() => launchQuest(recommendation.quest)}>{recommendation.kind === 'resume' ? 'Resume quest' : 'Start quest'} <span aria-hidden="true">→</span></button></section><Guide accessory={progress.activeAccessoryId} message="Your next quest is chosen from unfinished routes and skills you have practiced least." /></section>}
        {screen === 'settings' && <ControlsPanel progress={progress} onUpdate={updateSettings} onJudge={loadJudgeDemo} onReset={resetDemo} />}
        {screen === 'explore' && <FeatureLab progress={progress} quests={quests} onStatus={addStatus} onSetting={updateSettings} />}
      </main>
      <footer className="app-footer">Offline-first demo · Anonymous local progress · Source and rights details stay with every reviewed quest</footer>
    </div>
  );
}

function playCue(kind = 'success', settings = {}) {
  try {
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) return;
    const context = new Context();
    const gain = context.createGain();
    const now = context.currentTime;
    const volume = settings.soundVolume === 'standard' ? 0.055 : 0.028;
    const tones = { success: [523.25, 659.25], retry: [294.33], reveal: [440], completion: [523.25, 659.25, 783.99] }[kind] || [440];
    gain.gain.setValueAtTime(0.0001, now);
    tones.forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const start = now + index * 0.09;
      const end = start + 0.16;
      oscillator.type = kind === 'retry' ? 'triangle' : 'sine';
      oscillator.frequency.setValueAtTime(frequency, start);
      oscillator.connect(gain);
      oscillator.start(start);
      oscillator.stop(end);
    });
    const duration = Math.max(tones.length * 0.09 + 0.16, 0.18);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    gain.connect(context.destination);
    window.setTimeout(() => context.close?.(), Math.ceil((duration + 0.1) * 1000));
  } catch { /* Audio is optional. */ }
}
