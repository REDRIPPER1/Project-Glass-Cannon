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
  LEVEL_REWARDS,
  PET_LEVEL_MILESTONES,
  beginQuest,
  buyWishlistPages,
  completeOnboarding,
  completeQuest,
  createJudgeProgress,
  levelForXp,
  xpForNextLevel,
  xpRemainingToNextLevel,
  xpRequiredForLevel,
  loadProgress,
  markEvidenceReveal,
  markBookChapterRead,
  recordResponse,
  redeemWishlistPages,
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
  toggleFavoritePet,
  xpIntoLevel,
  claimCatalogReward,
  equipPet,
  equipPetAccessory,
  grantDemoCurrency,
  namePet,
  purchaseCatalogItem,
  openCatalogEgg,
  setSubscriptionPlan,
  toggleBookWishlist as updateBookWishlist,
  toggleWishlist,
} from './utils/progress';
import { PLATFORM_CATALOG, RARITY_COLORS, displayCurrency, petById, rewardById } from './utils/platformCatalog';
import { bookAccessState, bookLevelNodes, chapterAccessState, exactChapterQuest, hasInAppChapterContent, libraryBooks, readableChapterSentences, sourceReaderState } from './utils/bookLibrary';
import ReadingBasicsScreen from './ReadingBasicsScreen.jsx';
import { loadChapterReference, loadLibraryEnhancement, purchaseShopItem, redeemWishlistPagesRemote, setRemoteBookWishlist } from './utils/libraryApi';
import { chapterActivitySource, supportedChapterActivities } from './utils/chapterActivities';
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
const PASS_PRODUCT_NAME = 'Moonlit Trail';
const PASS_STOPS = [
  { id: 'trail-gold', track: 'Free track', requiredXp: 0, title: 'Gold Cache', detail: 'A local Gold reward that updates the same profile wallet.', art: '🪙', rewardId: 'level-gold-cache' },
  { id: 'trail-moon-pin', track: 'Free track', requiredXp: 100, title: 'Moon Pin', detail: 'A Rare companion accessory from the Free track.', art: '📌', rewardId: 'basic-rare-moon-pin' },
  { id: 'trail-diamonds', track: 'Premium track', requiredXp: 50, title: 'Diamond Spark', detail: 'A local Diamond reward that updates the same profile wallet.', art: '💎', rewardId: 'level-diamond-cache', premium: true },
  { id: 'trail-cloak', track: 'Premium track', requiredXp: 100, title: 'Starglass Cloak', detail: 'An Epic companion cloak from the Premium track.', art: '🧥', rewardId: 'premium-epic-starglass-cloak', premium: true },
];

function applyRemoteBalances(progress, result) {
  return {
    ...progress,
    currencies: { ...progress.currencies, ...(result?.wallet || {}) },
    inventory: { ...progress.inventory, ...(result?.inventory || {}) },
  };
}

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
        {accessory === 'lantern-charm' && <path className="guide-accessory" d="M70 19h10l3 8-3 12H70l-3-12zM75 16v-5" />}
        {accessory === 'archive-key' && <path className="guide-accessory" d="M69 25a6 6 0 1 0 7-6l8 8m-4-4-5 5m1-1-4 4" />}
        {accessory === 'star-crown' && <path className="guide-accessory" d="m28 27 6-10 8 7 8-11 8 11 8-7 6 10-6 9H34z" />}
      </svg>
      <p>{message}</p>
    </aside>
  );
}

function SourceNotice({ source }) {
  if (!source) return null;
  const sourceName = source.bookTitle ? `${source.bookTitle}, ${source.edition}, ${source.chapter}` : source.label || 'Original LitLab passage';
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
    leaderboard: <><path d="M5 20v-6h4v6M10 20V9h4v11M15 20V5h4v15" /><path d="M4 20h16" /></>,
    trophy: <><path d="M7 4h10v5a5 5 0 0 1-10 0z" /><path d="M7 6H4v2a4 4 0 0 0 4 4M17 6h3v2a4 4 0 0 1-4 4M12 14v4M8 20h8" /></>,
    levels: <><path d="M4 18 9 13l4 3 7-8" /><path d="M16 8h4v4" /><circle cx="4" cy="18" r="1.5" /><circle cx="9" cy="13" r="1.5" /><circle cx="13" cy="16" r="1.5" /></>,
    explore: <><circle cx="11" cy="11" r="6" /><path d="m16 16 4 4M11 8v6M8 11h6" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.1 2.1-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.02 1.56V20.3h-3v-.1a1.7 1.7 0 0 0-1.02-1.56 1.7 1.7 0 0 0-1.88.34l-.06.06-2.1-2.1.06-.06A1.7 1.7 0 0 0 7.08 15a1.7 1.7 0 0 0-1.56-1.02h-.1v-3h.1A1.7 1.7 0 0 0 7.08 9a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.1-2.1.06.06A1.7 1.7 0 0 0 10.72 5a1.7 1.7 0 0 0 1.02-1.56v-.1h3v.1A1.7 1.7 0 0 0 15.76 5a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.1 2.1-.06.06A1.7 1.7 0 0 0 19.4 9a1.7 1.7 0 0 0 1.56 1.02h.1v3h-.1A1.7 1.7 0 0 0 19.4 15Z" /></>,
    profile: <><circle cx="12" cy="8" r="4" /><path d="M4 21c1.7-4.5 4.4-6.7 8-6.7s6.3 2.2 8 6.7" /></>,
    pets: <><circle cx="7" cy="8" r="2.1" /><circle cx="17" cy="8" r="2.1" /><circle cx="5" cy="14" r="2.1" /><circle cx="19" cy="14" r="2.1" /><path d="M8 21c-1.6-5 1-8 4-8s5.6 3 4 8c-1 2-7 2-8 0Z" /></>,
    shop: <><path d="M4 10h16l-1 10H5zM3 10l2-5h14l2 5" /><path d="M9 14h6M12 11v6" /></>,
    pass: <><path d="M5 4h14v16l-7-4-7 4z" /><path d="m9 9 3 3 3-3" /></>,
    books: <><path d="M4 5.5c4-1.2 6.7-.3 8 1.4v12c-1.3-1.7-4-2.6-8-1.4zM20 5.5c-4-1.2-6.7-.3-8 1.4v12c1.3-1.7 4-2.6 8-1.4z" /></>,
    basics: <><path d="M12 3 4 7l8 4 8-4-8-4Z" /><path d="m4 12 8 4 8-4M4 17l8 4 8-4" /></>,
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

function ProfileHud({ progress, onNavigate }) {
  const current = xpIntoLevel(progress.xp);
  const required = xpForNextLevel(progress.xp);
  const fill = required ? Math.round((current / required) * 100) : 100;
  return <div className="rail-profile-hud" role="group" aria-label={`Player progress: Level ${levelForXp(progress.xp)}, ${current} of ${required || current} XP`}><span className="hud-avatar" style={{ '--xp-fill': `${fill * 3.6}deg` }}>{progress.profileName.slice(0, 1).toUpperCase()}</span><strong>Level {levelForXp(progress.xp)}</strong><small>{current}/{required || current} XP</small></div>;
}

function AppHeader({ progress, screen, onNavigate }) {
  const navItems = [
    ['quests', 'Quest map', 'home'],
    ['basics', 'Reading Basics', 'basics'],
    ['profile', 'Profile', 'profile'],
    ['pets', 'Pets', 'pets'],
    ['shop', 'Shop', 'shop'],
    ['pass', 'Moonlit Trail', 'pass'],
    ['books', 'Books', 'books'],
    ['progress', 'Progress', 'dashboard'],
    ['leaderboard', 'Trailboard', 'leaderboard'],
    ['trophy', 'Trophy road', 'trophy-road'],
    ['levels', 'Level road', 'level-road'],
    ['explore', 'Labs', 'explore'],
    ['settings', 'Settings', 'settings'],
  ];
  const isQuestScreen = QUEST_SCREENS.has(screen) || ['home', 'review', 'complete'].includes(screen);
  return (
    <>
      <aside className="game-rail">
        <button className="rail-brand" type="button" onClick={() => onNavigate('home')} aria-label="LitLab home"><BrandMark /><span>LitLab</span></button>
        <CompanionOrb progress={progress} />
        <nav className="rail-nav" aria-label="Game navigation">
          <p>Play</p>
          {navItems.map(([icon, label, target]) => {
            const active = target === 'home' ? isQuestScreen : screen === target;
            return <button key={label} type="button" className={active ? 'is-active' : ''} aria-current={active ? 'page' : undefined} onClick={() => onNavigate(target)}><NavIcon name={icon} /><span>{label}</span>{label === 'Progress' && !progress.settings.hideGameSignals && <b>{levelForXp(progress.xp)}</b>}</button>;
          })}
        </nav>
        {!progress.settings.hideGameSignals && <ProfileHud progress={progress} />}
      </aside>
      <header className="app-header">
        <button className="brand" type="button" onClick={() => onNavigate('home')} aria-label="LitLab home"><BrandMark /><span>LitLab</span></button>
      </header>
      <nav className="mobile-road-nav" aria-label="App destinations">
        {navItems.map(([icon, label, target]) => { const active = target === 'home' ? isQuestScreen : screen === target; return <button key={label} type="button" className={active ? 'is-active' : ''} aria-current={active ? 'page' : undefined} onClick={() => onNavigate(target)}><NavIcon name={icon} /><span>{label}</span></button>; })}
      </nav>
    </>
  );
}

const TRAILBOARD_RIVALS = [
  { id: 'mira', name: 'Mira the Mapper', xp: 520, note: 'Demo trail marker' },
  { id: 'sol', name: 'Sol the Storykeeper', xp: 330, note: 'Demo trail marker' },
  { id: 'bee', name: 'Bee the Bookwyrm', xp: 190, note: 'Demo trail marker' },
];

const TROPHY_ROAD = [
  { id: 'first-footprint', title: 'First Footprint', detail: 'Finish one reviewed quest.', earned: (progress) => progress.completedQuestIds.length >= 1 },
  { id: 'sharp-eye', title: 'Sharp Eye', detail: 'Find all of a quest’s evidence clues.', earned: (progress) => progress.badgeIds.includes(BADGES.EVIDENCE_EXPLORER) },
  { id: 'trail-maker', title: 'Trail Maker', detail: 'Complete all three local quest routes.', earned: (progress) => progress.completedQuestIds.length >= 3 },
  { id: 'story-shelf', title: 'Story Shelf', detail: 'Collect three story fragments.', earned: (progress) => progress.storyFragmentIds.length >= 3 },
  { id: 'lantern-keeper', title: 'Lantern Keeper', detail: 'Reach level 4 through thoughtful practice.', earned: (progress) => levelForXp(progress.xp) >= 4 },
];

function LeaderboardScreen({ progress, onNavigate }) {
  const entries = [...TRAILBOARD_RIVALS, { id: 'you', name: 'You', xp: progress.xp, note: 'Only stored in this browser' }]
    .sort((left, right) => right.xp - left.xp);
  return (
    <section className="road-view trailboard-view" aria-labelledby="trailboard-title">
      <div className="road-heading"><div><p className="eyebrow">Local practice board</p><h1 id="trailboard-title">Trailboard</h1><p>Friendly fictional markers give your local XP a place on the map. Your score never leaves this browser.</p></div><span className="road-level">Level {levelForXp(progress.xp)}</span></div>
      <ol className="trailboard-list">
        {entries.map((entry, index) => <li key={entry.id} className={entry.id === 'you' ? 'is-player' : ''}><span className="trail-rank">{index + 1}</span><span className="trail-avatar" aria-hidden="true">{entry.name === 'You' ? '✦' : entry.name[0]}</span><div><strong>{entry.name}</strong><small>{entry.note}</small></div><b>{entry.xp} XP</b></li>)}
      </ol>
      <div className="road-actions"><button className="primary-button" type="button" onClick={() => onNavigate('home')}>Earn XP on a quest <span aria-hidden="true">→</span></button><button className="secondary-button" type="button" onClick={() => onNavigate('level-road')}>See level rewards</button></div>
    </section>
  );
}

function TrophyRoadScreen({ progress, onNavigate }) {
  const [selectedId, setSelectedId] = useState(TROPHY_ROAD[0].id);
  const earnedCount = TROPHY_ROAD.filter((trophy) => trophy.earned(progress)).length;
  const selected = TROPHY_ROAD.find((trophy) => trophy.id === selectedId) || TROPHY_ROAD[0];
  return (
    <section className="road-view trophy-road-view" aria-labelledby="trophy-road-title">
      <div className="road-heading"><div><p className="eyebrow">Quest keepsakes</p><h1 id="trophy-road-title">Trophy Road</h1><p>{earnedCount} of {TROPHY_ROAD.length} keepsakes earned. Each marker celebrates practice or evidence—not speed.</p></div><span className="road-level">{earnedCount}/{TROPHY_ROAD.length}</span></div>
      <ol className="trophy-road-list" aria-label="Interactive trophy map">
        {TROPHY_ROAD.map((trophy, index) => { const earned = trophy.earned(progress); return <li key={trophy.id} className={`${earned ? 'is-earned' : ''} ${selectedId === trophy.id ? 'is-selected' : ''}`}><button type="button" className="road-stop-button" onClick={() => setSelectedId(trophy.id)} aria-label={`Open ${trophy.title} trophy`}><span className="road-node" aria-hidden="true">{earned ? '✦' : index + 1}</span><strong>{trophy.title}</strong></button><span className="road-status">{earned ? 'Collected' : 'On the trail'}</span></li>; })}
      </ol>
      <div className="road-reward-pop" role="status" aria-live="polite"><div className="reward-pop-art" aria-hidden="true">{selected.earned(progress) ? '🏆' : '🗺️'}</div><div><p className="eyebrow">{selected.earned(progress) ? 'Reward collected' : 'Next map stop'}</p><h2>{selected.title}</h2><p>{selected.detail}</p></div></div>
      <div className="road-actions"><button className="primary-button" type="button" onClick={() => onNavigate('home')}>Continue the trail <span aria-hidden="true">→</span></button><button className="secondary-button" type="button" onClick={() => onNavigate('level-road')}>Open Level Road</button></div>
    </section>
  );
}

function LevelRoadScreen({ progress, onNavigate, onEquip }) {
  const [selectedId, setSelectedId] = useState(LEVEL_REWARDS[0].id);
  const level = levelForXp(progress.xp);
  const nextReward = LEVEL_REWARDS.find((reward) => reward.level > level);
  const selected = LEVEL_REWARDS.find((reward) => reward.id === selectedId) || LEVEL_REWARDS[0];
  return (
    <section className="road-view level-road-view" aria-labelledby="level-road-title">
      <div className="road-heading"><div><p className="eyebrow">Your reward route</p><h1 id="level-road-title">Level Road</h1><p>Every 100 XP lifts your level. Quests award 80 XP, with small bonuses for answers and evidence—never for finishing fast.</p></div><span className="road-level">Level {level}</span></div>
      <section className="level-progress-card" aria-label={`Level ${level} progress`}><div><span>Current XP</span><strong>{progress.xp} XP</strong><small>{nextReward ? `${Math.max(0, (nextReward.level - 1) * 100 - progress.xp)} XP to ${nextReward.name}` : 'Every current cosmetic reward is collected.'}</small></div><i><b style={{ width: `${xpIntoLevel(progress.xp)}%` }} /></i><p>{xpIntoLevel(progress.xp)} / 100 toward level {level + 1}</p></section>
      <ol className="level-road-list">
        {LEVEL_REWARDS.map((reward) => { const unlocked = level >= reward.level; const equipped = progress.activeAccessoryId === reward.id; return <li key={reward.id} className={`${unlocked ? 'is-unlocked' : ''} ${selectedId === reward.id ? 'is-selected' : ''}`}><button type="button" className="road-stop-button" onClick={() => setSelectedId(reward.id)} aria-label={`Open level ${reward.level} reward`}><span className="road-node" aria-hidden="true">{unlocked ? '✦' : reward.level}</span><strong>{reward.name}</strong></button>{unlocked ? <button type="button" className={equipped ? 'equipped-reward' : 'secondary-button'} disabled={equipped} onClick={() => onEquip(reward.id)}>{equipped ? 'Equipped' : 'Equip'}</button> : <span className="road-status">Locked</span>}</li>; })}
      </ol>
      <div className="road-reward-pop" role="status" aria-live="polite"><div className="reward-pop-art" aria-hidden="true">{level >= selected.level ? '🎁' : '🔒'}</div><div><p className="eyebrow">Level {selected.level} reward</p><h2>{selected.name}</h2><p>{selected.description}</p></div></div>
      <div className="road-actions"><button className="primary-button" type="button" onClick={() => onNavigate('home')}>Find another clue <span aria-hidden="true">→</span></button><button className="secondary-button" type="button" onClick={() => onNavigate('trophy-road')}>View trophies</button></div>
    </section>
  );
}

function QuestMap({ arc, activeQuestId, onContinue }) {
  const nextStop = arc.find(({ state }) => state === 'current' || state === 'ready') || arc.at(-1);
  return (
    <section className="quest-map" aria-labelledby="quest-map-title">
      <div><p className="eyebrow">Story arc</p><h2 id="quest-map-title">The clue trail</h2></div>
      <ol>
        {arc.map(({ quest, state }, index) => <li key={quest.id} className={`map-stop is-${state} ${quest.id === activeQuestId ? 'is-active' : ''}`}><span aria-hidden="true">{state === 'complete' ? '✓' : index + 1}</span><p>{quest.title}</p><small>{state === 'complete' ? 'Story fragment found' : state === 'current' ? 'In progress' : state === 'locked' ? 'Opens as the trail grows' : 'Ready to explore'}</small></li>)}
      </ol>
      {nextStop && <button className="secondary-button quest-map-continue" type="button" onClick={() => onContinue(nextStop.quest)}>{nextStop.state === 'current' ? 'Continue active quest' : 'Continue to next quest'} <span aria-hidden="true">→</span></button>}
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
      <section className="privacy-note"><h2>Privacy notice</h2><p>LitLab’s browser demo has no account connection, analytics upload, ads, or real learner identifiers. Cloud features remain staged until an approved backend and privacy model are available.</p></section>
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

function LevelRoad100({ progress, petCatalog, onNavigate }) {
  const [selectedLevel, setSelectedLevel] = useState(levelForXp(progress.xp));
  const level = levelForXp(progress.xp);
  const petMilestones = petCatalog?.length ? petCatalog.filter((pet) => pet.starterClaim).map((pet) => ({ petId: pet.id, level: pet.unlockLevel })) : PET_LEVEL_MILESTONES;
  const selectedMilestone = petMilestones.find((item) => item.level === selectedLevel);
  const selectedPet = selectedMilestone ? petById(selectedMilestone.petId) : null;
  const current = xpIntoLevel(progress.xp);
  const required = xpForNextLevel(progress.xp);
  return <section className="road-view level-road-view" aria-labelledby="level-road-title"><div className="road-heading"><div><p className="eyebrow">Levels 1–100</p><h1 id="level-road-title">Level Road</h1><p>XP requirements rise every five levels and step up again every ten. Only correct answers, evidence, and well-supported reasoning earn XP.</p></div><span className="road-level">Level {level}</span></div><section className="level-progress-card" aria-label={`Level ${level} progress`}><div><span>Current XP</span><strong>{progress.xp} XP</strong><small>{xpRemainingToNextLevel(progress.xp)} XP to Level {Math.min(100, level + 1)}</small></div><i><b style={{ width: `${required ? (current / required) * 100 : 100}%` }} /></i><p>{current}/{required || current} toward level {Math.min(100, level + 1)}</p></section><ol className="level-road-list level-road-100" aria-label="Interactive level road through level 100">{Array.from({ length: 100 }, (_, index) => { const nodeLevel = index + 1; const milestone = petMilestones.find((item) => item.level === nodeLevel); const unlocked = level >= nodeLevel; return <li key={nodeLevel} className={`${unlocked ? 'is-unlocked' : ''} ${selectedLevel === nodeLevel ? 'is-selected' : ''}`}><button type="button" className="road-stop-button" onClick={() => setSelectedLevel(nodeLevel)} aria-pressed={selectedLevel === nodeLevel} aria-label={`Open Level ${nodeLevel}${milestone ? ` pet milestone` : ''}`}><span className="road-node" aria-hidden="true">{unlocked ? '✦' : nodeLevel}</span><strong>Level {nodeLevel}</strong><small>{milestone ? `Pet: ${petById(milestone.petId)?.name}` : nodeLevel % 10 === 0 ? 'Milestone cache' : 'Practice milestone'}</small></button></li>; })}</ol><div className="road-reward-pop" role="status" aria-live="polite"><div className="reward-pop-art" aria-hidden="true">{selectedPet ? '🐾' : selectedLevel % 10 === 0 ? '🎁' : '✦'}</div><div><p className="eyebrow">Level {selectedLevel} · {xpRequiredForLevel(selectedLevel)} total XP</p><h2>{selectedPet ? `${selectedPet.name} companion` : selectedLevel % 10 === 0 ? 'Milestone cache' : 'Practice checkpoint'}</h2><p>{selectedPet ? (level >= selectedLevel ? `${selectedPet.name} is unlocked and ready in Pets.` : `Reach Level ${selectedLevel} to unlock this companion.`) : 'This checkpoint marks the next stretch of your reading trail.'}</p></div></div><div className="road-actions"><button className="primary-button" type="button" onClick={() => onNavigate('home')}>Earn XP on a quest</button><button className="secondary-button" type="button" onClick={() => onNavigate('pets')}>View companions</button></div></section>;
}

function PetAccessory({ accessoryId }) {
  if (!accessoryId) return null;
  if (accessoryId.includes('cap')) return <><path className="pet-accessory pet-accessory-head" d="M27 34c10-10 36-10 46 0l-4 8H31z" /><circle className="pet-accessory-detail" cx="65" cy="32" r="3" /></>;
  if (accessoryId.includes('scarf') || accessoryId.includes('pin')) return <><path className="pet-accessory pet-accessory-neck" d="M32 63c11 6 25 6 36 0l-3 9c-10 5-20 5-30 0z" /><circle className="pet-accessory-detail" cx="50" cy="68" r="3" /></>;
  return <path className="pet-accessory pet-accessory-trail" d="m76 31 3 7 7 3-7 3-3 7-3-7-7-3 7-3z" />;
}

function PetAvatar({ pet, nickname, accessoryId }) {
  const type = pet.petType || 'companion';
  const hasRoundEars = ['mouse', 'otter', 'tortoise'].includes(type);
  const hasPointedEars = ['fox', 'cat', 'bat', 'dragon'].includes(type);
  const hasWings = ['bird', 'moth', 'bat', 'phoenix'].includes(type);
  const hasBeak = ['bird', 'phoenix'].includes(type);
  const hasShell = type === 'tortoise';
  const hasTail = ['mouse', 'fox', 'otter', 'cat', 'dragon'].includes(type);
  return <figure className={`pet-avatar pet-avatar-${type}`} style={{ '--pet-color': RARITY_COLORS[pet.rarity] || '#7c8b83' }} role="img" aria-label={`${nickname || pet.name}, ${pet.rarity} ${type} companion placeholder`}>
    <svg className="pet-sprite" viewBox="0 0 100 100" aria-hidden="true">
      <ellipse className="pet-shadow" cx="50" cy="86" rx="28" ry="7" />
      {hasTail && <path className="pet-tail" d={type === 'fox' ? 'M72 72c19 2 16 20 1 14-7-3-8-8-3-12' : 'M28 74C9 74 13 55 26 61c6 3 4 10-2 10'} />}
      {hasWings && <><path className="pet-wing" d="M39 60C15 47 15 74 39 78z" /><path className="pet-wing" d="M61 60c24-13 24 14 0 18z" /></>}
      <ellipse className="pet-body" cx="50" cy="66" rx={hasShell ? '28' : '22'} ry="23" />
      {hasShell && <ellipse className="pet-shell" cx="50" cy="64" rx="19" ry="16" />}
      {hasRoundEars && <><circle className="pet-ear" cx="33" cy="39" r="11" /><circle className="pet-ear" cx="67" cy="39" r="11" /></>}
      {hasPointedEars && <><path className="pet-ear" d="m31 43 4-22 13 16z" /><path className="pet-ear" d="m69 43-4-22-13 16z" /></>}
      {type === 'dragon' && <><path className="pet-horn" d="m39 34 4-12 5 13M61 34l-4-12-5 13" /><path className="pet-wing" d="M30 62 17 44l4 24M70 62l13-18-4 24" /></>}
      <circle className="pet-face" cx="50" cy="48" r="22" />
      {hasBeak ? <path className="pet-beak" d="m50 52 9 5-9 5-9-5z" /> : <><circle className="pet-eye" cx="42" cy="48" r="3" /><circle className="pet-eye" cx="58" cy="48" r="3" /><path className="pet-smile" d="M43 60c5 5 10 5 15 0" /></>}
      {type === 'moth' && <><path className="pet-antenna" d="M44 29c-5-9-10-8-11-4M56 29c5-9 10-8 11-4" /><circle className="pet-wing-dot" cx="28" cy="65" r="4" /><circle className="pet-wing-dot" cx="72" cy="65" r="4" /></>}
      <PetAccessory accessoryId={accessoryId} />
    </svg>
    <figcaption>{nickname || pet.name}</figcaption>
  </figure>;
}

function LegacyLitLearnShopScreen({ progress, profileId, shopItems, onUpdate, onNavigate, onStatus }) {
  const buyPages = async () => {
    const remoteOffer = shopItems?.find((item) => item.id === 'shop-wishlist-page');
    if (profileId && remoteOffer) {
      try {
        const purchase = await purchaseShopItem(profileId, remoteOffer.id);
        onUpdate((current) => applyRemoteBalances(current, purchase));
        onStatus('Wishlist Page added to your synced inventory.');
      } catch { onStatus(`You need ${remoteOffer.price} Diamonds for a Wishlist Page.`); }
      return;
    }
    if (progress.currencies.diamonds < 10) { onStatus('You need 10 Diamonds for a Wishlist Page.'); return; }
    onUpdate((current) => buyWishlistPages(current));
    onStatus('Wishlist Page added to your offline inventory.');
  };
  return <section className="feature-card platform-collection" aria-labelledby="shop-title"><div className="collection-hero"><div><p className="eyebrow">Local demo shop</p><h1 id="shop-title">Story Shop</h1><p>Gold and Diamonds are the only player currencies. Purchases stay in this browser until the synced wallet contract is enabled.</p></div><div className="currency-bar"><span>🪙 {progress.currencies.gold} Gold</span><span>💎 {progress.currencies.diamonds} Diamonds</span></div></div><section className="shop-section" id="shop-diamonds"><h2>Wishlist Pages</h2><div className="shop-grid"><article className="shop-product"><span className="eyebrow">Diamond item</span><h3>Wishlist Page</h3><p>Use five pages for a random eligible wishlist-book claim. Quest completions and Level Road milestones also earn pages.</p><button className="secondary-button" type="button" onClick={buyPages}>Buy 1 for 10 Diamonds</button></article></div></section><section className="shop-section"><h2>Books</h2><p>Permanent book purchases remain in Shop. Only titles with a provided LitLearn purchase offer can be purchased; unavailable titles clearly remain locked.</p><button className="secondary-button" type="button" onClick={() => onNavigate('books')}>Browse book offers</button></section><section className="shop-section"><h2>Companion items</h2><p>Pet clothing and eggs unlock through their intended level and collection paths. No other visible currencies are used.</p></section></section>;
}

function LegacyLitLearnShopScreenV2({ progress, profileId, shopItems = [], onUpdate, onNavigate, onStatus }) {
  const offers = shopItems.filter((item) => item.id === 'shop-wishlist-page' || item.id.startsWith('shop-book-'));
  const buy = async (offer) => {
    if (profileId) {
      try {
        const purchase = await purchaseShopItem(profileId, offer.id);
        onUpdate((current) => ({ ...applyRemoteBalances(current, purchase), ownedBookIds: purchase.itemType === 'book' ? [...new Set([...current.ownedBookIds, purchase.catalogId])] : current.ownedBookIds }));
        onStatus(`${offer.itemType === 'book' ? 'Book' : 'Wishlist Page'} added to your synced collection.`);
      } catch { onStatus(`This offer needs ${offer.price} ${offer.currency === 'diamonds' ? 'Diamonds' : 'Gold'}, or is no longer available.`); }
      return;
    }
    if (offer.id === 'shop-wishlist-page') { if (progress.currencies.diamonds < 10) { onStatus('You need 10 Diamonds for a Wishlist Page.'); return; } onUpdate((current) => buyWishlistPages(current)); onStatus('Wishlist Page added to your offline inventory.'); }
  };
  return <section className="feature-card platform-collection" aria-labelledby="shop-title"><div className="collection-hero"><div><p className="eyebrow">Local demo shop</p><h1 id="shop-title">Story Shop</h1><p>Gold and Diamonds are the only player currencies. Purchases are mock transactions; no real payment is processed.</p></div><div className="currency-bar"><span>🪙 {progress.currencies.gold} Gold</span><span>💎 {progress.currencies.diamonds} Diamonds</span></div></div><section className="shop-section"><h2>Wishlist Pages</h2>{offers.filter((item) => item.id === 'shop-wishlist-page').map((offer) => <article className="shop-product" key={offer.id}><h3>Wishlist Page</h3><p>Spend five for one random eligible wishlisted book, permanently. {offer.price} Diamonds each.</p><button className="secondary-button" type="button" onClick={() => buy(offer)}>Buy Wishlist Page</button></article>)}</section><section className="shop-section"><h2>Books</h2>{offers.filter((item) => item.id.startsWith('shop-book-')).length ? <div className="shop-grid">{offers.filter((item) => item.id.startsWith('shop-book-')).map((offer) => <article className="shop-product" key={offer.id}><h3>{offer.catalogId.replaceAll('-', ' ')}</h3><p>{progress.ownedBookIds.includes(offer.catalogId) ? 'Owned forever' : `${offer.price} ${offer.currency === 'diamonds' ? 'Diamonds' : 'Gold'} · permanent local ownership`}</p><button className="secondary-button" type="button" disabled={progress.ownedBookIds.includes(offer.catalogId)} onClick={() => buy(offer)}>{progress.ownedBookIds.includes(offer.catalogId) ? 'Owned' : 'Buy book'}</button></article>)}</div> : <p>No catalog book offers are available right now. Browse their access in Books.</p>}<button className="text-button" type="button" onClick={() => onNavigate('books')}>Browse Books</button></section></section>;
}

function LitLearnShopScreen({ progress, profileId, shopItems = [], onUpdate, onNavigate, onStatus }) {
  const fallbackAccessories = PLATFORM_CATALOG.shopItems.filter((item) => item.itemType === 'accessory').map((item) => ({ ...item, currency: item.currency === 'leafTokens' ? 'gold' : item.currency === 'storyShards' ? 'diamonds' : item.currency }));
  const accessoryOffers = shopItems.filter((item) => item.itemType === 'accessory');
  const accessories = accessoryOffers.length ? accessoryOffers : fallbackAccessories;
  const books = shopItems.filter((item) => item.itemType === 'book' || item.id?.startsWith('shop-book-'));
  const buy = async (offer) => {
    const currency = offer.currency === 'leafTokens' ? 'gold' : offer.currency === 'storyShards' ? 'diamonds' : offer.currency;
    const isBook = offer.itemType === 'book' || offer.id?.startsWith('shop-book-');
    const alreadyOwned = isBook ? progress.ownedBookIds.includes(offer.catalogId) : progress.ownedAccessoryIds.includes(offer.catalogId);
    if (alreadyOwned) return;
    if (profileId && shopItems.some((item) => item.id === offer.id)) {
      try {
        const result = await purchaseShopItem(profileId, offer.id);
        onUpdate((state) => ({ ...applyRemoteBalances(state, result), ownedBookIds: isBook ? [...new Set([...state.ownedBookIds, result.bookId || result.selectedBookId || offer.catalogId])] : state.ownedBookIds, ownedAccessoryIds: !isBook ? [...new Set([...state.ownedAccessoryIds, offer.catalogId])] : state.ownedAccessoryIds }));
        onStatus(`${isBook ? 'Book' : 'Pet accessory'} purchased and permanently added.`);
      } catch { onStatus(`Purchase did not complete. You need ${offer.price} ${currency === 'diamonds' ? 'Diamonds' : 'Gold'}.`); }
      return;
    }
    if ((progress.currencies[currency] || 0) < offer.price) { onStatus(`You need ${offer.price} ${currency === 'diamonds' ? 'Diamonds' : 'Gold'}.`); return; }
    onUpdate((state) => purchaseCatalogItem(state, { ...offer, currency, itemType: isBook ? 'book' : 'accessory' }));
    onStatus(`${isBook ? 'Book' : 'Pet accessory'} purchased and permanently added in this demo.`);
  };
  const Product = ({ offer, kind }) => {
    const isBook = kind === 'book';
    const owned = isBook ? progress.ownedBookIds.includes(offer.catalogId) : progress.ownedAccessoryIds.includes(offer.catalogId);
    const currency = offer.currency === 'leafTokens' ? 'gold' : offer.currency === 'storyShards' ? 'diamonds' : offer.currency;
    return <article className="shop-product"><span className="eyebrow">{isBook ? 'Permanent book' : 'Pet accessory'}</span><h3>{offer.label || offer.title || offer.catalogId.replaceAll('-', ' ')}</h3><p>{owned ? 'Permanently owned' : `${offer.price} ${currency === 'diamonds' ? 'Diamonds' : 'Gold'}`}</p><button className="secondary-button" type="button" disabled={owned} onClick={() => buy(offer)}>{owned ? 'Owned' : `Buy with ${currency === 'diamonds' ? 'Diamonds' : 'Gold'}`}</button></article>;
  };
  return <section className="feature-card platform-collection" aria-labelledby="shop-title"><div className="collection-hero"><div><p className="eyebrow">Local demo shop</p><h1 id="shop-title">Story Shop</h1><p>Books use Diamonds. Pet accessories use Gold. Successful demo purchases remain permanently owned.</p></div><div className="currency-bar"><span>{progress.currencies.gold} Gold</span><span>{progress.currencies.diamonds} Diamonds</span></div></div><section className="shop-section"><h2>Demo wallet</h2><p>Use this local demo reward to try a book purchase. No real payment is processed.</p><button className="secondary-button" type="button" onClick={() => { onUpdate((state) => grantDemoCurrency(state, 'diamonds', 50)); onStatus('50 Diamonds added for this demo.'); }}>Add 50 demo Diamonds</button></section><section className="shop-section"><h2>Books</h2>{books.length ? <div className="shop-grid">{books.map((offer) => <Product key={offer.id} offer={offer} kind="book" />)}</div> : <p>Choose a purchase-only book in the catalog to see its Diamond price.</p>}<button className="text-button" type="button" onClick={() => onNavigate('books')}>Browse catalog</button></section><section className="shop-section"><h2>Pet clothing & accessories</h2><div className="shop-grid">{accessories.map((offer) => <Product key={offer.id} offer={offer} kind="accessory" />)}</div></section></section>;
}

function LegacyInAppBookLibraryScreen({ progress, quests, apiState, catalogBooks, onUpdate, onNavigate, onLaunchQuest }) {
  const catalog = catalogBooks?.length ? catalogBooks : PLATFORM_CATALOG.books;
  const [category, setCategory] = useState('All categories');
  const [selectedBookId, setSelectedBookId] = useState(() => { try { return window.sessionStorage.getItem('litlab.bookFocus') || catalog[0]?.id || ''; } catch { return catalog[0]?.id || ''; } });
  const [selectedChapterId, setSelectedChapterId] = useState('');
  const [readerOpen, setReaderOpen] = useState(false);
  const categories = ['All categories', ...new Set(catalog.map((book) => book.category || book.topic || 'Classics'))];
  const visible = catalog.filter((book) => category === 'All categories' || (book.category || book.topic || 'Classics') === category);
  const selectedBook = visible.find((book) => book.id === selectedBookId) || visible[0] || null;
  const chapter = selectedBook?.chapterMetadata?.find((item) => item.id === selectedChapterId) || selectedBook?.chapterMetadata?.[0] || null;
  const quest = selectedBook && chapter ? exactChapterQuest(selectedBook, chapter, quests) : null;
  const access = selectedBook && chapter ? chapterAccessState(selectedBook, chapter, progress) : 'locked';
  const choose = (book) => {
    setSelectedBookId(book.id);
    setSelectedChapterId(book.chapterMetadata?.[0]?.id || '');
    setReaderOpen(false);
    window.setTimeout(() => {
      const heading = document.getElementById('selected-book-title');
      heading?.scrollIntoView({ behavior: progress.settings.reduceMotion ? 'auto' : 'smooth', block: 'start' });
      heading?.setAttribute('tabindex', '-1');
      heading?.focus();
    }, 0);
  };
  if (readerOpen && selectedBook && chapter && quest) return <section className="in-app-reader" aria-labelledby="reader-title"><div className="reader-toolbar"><button className="secondary-button" type="button" onClick={() => setReaderOpen(false)}>Back to {selectedBook.title}</button><span>{progress.bookReading[selectedBook.id]?.chapterIds?.includes(chapter.id) ? 'Read' : 'Reading'}</span></div><p className="eyebrow">{selectedBook.title} · {chapter.title}</p><h1 id="reader-title">Read in LitLearn</h1><p className="reader-attribution">{selectedBook.requiredAttribution || 'Reviewed LitLearn passage.'}</p><article className="passage-card" aria-label={`${chapter.title} passage`}>{sentencesFor(quest).map((sentence) => <p key={sentence.id}>{sentence.text}</p>)}</article><div className="button-row"><button className="primary-button" type="button" onClick={() => { onUpdate((current) => markBookChapterRead(current, selectedBook.id, chapter.id)); onLaunchQuest(quest); }}>Start comprehension quest</button><button className="secondary-button" type="button" onClick={() => { onUpdate((current) => markBookChapterRead(current, selectedBook.id, chapter.id)); setReaderOpen(false); }}>Mark chapter read</button></div></section>;
  return <section className="feature-card platform-collection book-library" aria-labelledby="books-title"><div className="collection-hero"><div><p className="eyebrow">LitLearn library</p><h1 id="books-title">Books</h1><p>Read reviewed LitLearn passages without leaving the app. Unreviewed titles stay unavailable until their content is provided.</p></div><span className={`book-state is-${apiState.kind === 'ready' ? 'ready' : 'error'}`}>{apiState.kind === 'ready' ? 'Catalog synced' : 'Offline catalog'}</span></div><label className="book-category-filter" htmlFor="book-category">Category<select id="book-category" value={category} onChange={(event) => { setCategory(event.target.value); setSelectedBookId(''); }}><option>All categories</option>{categories.slice(1).map((item) => <option key={item}>{item}</option>)}</select></label>{visible.length ? <div className="book-library-layout"><section className="book-shelf" aria-label="Books by category">{visible.map((book) => { const state = bookAccessState(book, progress); return <article key={book.id} className={`book-card ${book.id === selectedBook?.id ? 'is-selected' : ''}`}><span className={`book-state is-${state}`}>{state === 'owned' ? 'Owned forever' : state === 'subscription' ? 'Readable with Premium' : state === 'free' ? 'Free chapters' : state === 'purchase-only' ? 'Purchase required' : 'Locked'}</span><h2>{book.title}</h2><p>{book.author} · {book.category || book.topic}</p><button className="secondary-button" type="button" onClick={() => choose(book)}>View reading path</button><button className="text-button" type="button" onClick={() => onUpdate((current) => toggleWishlist(current, book.id))}>{progress.wishlistIds.includes(book.id) ? '★ Wishlisted' : '☆ Add to wishlist'}</button></article>; })}</section>{selectedBook && <section className="book-reader-workspace" aria-labelledby="selected-book-title"><div className="book-detail-header"><div><h2 id="selected-book-title">{selectedBook.title}</h2><p>{selectedBook.author} · {selectedBook.edition}</p></div><button className="text-button" type="button" onClick={() => onNavigate('shop')}>Book options in Shop</button></div><p className="source-attribution"><strong>Attribution:</strong> {selectedBook.requiredAttribution || 'Catalog attribution pending review.'}</p><div className="chapter-list" aria-label={`${selectedBook.title} chapters`}>{(selectedBook.chapterMetadata || []).map((item) => <button key={item.id} type="button" className={chapter?.id === item.id ? 'is-selected' : ''} onClick={() => { setSelectedChapterId(item.id); setReaderOpen(false); }}>{item.title}<small>{progress.bookReading[selectedBook.id]?.chapterIds?.includes(item.id) ? 'Read' : 'Not read'}</small></button>)}</div>{chapter && quest && access !== 'locked' && access !== 'purchase-only' ? <div className="source-reader-state is-ready"><h3>{chapter.title}</h3><p>This provided LitLearn passage opens inside the app.</p><button className="primary-button" type="button" onClick={() => setReaderOpen(true)}>Read chapter in LitLearn</button></div> : <div className="source-reader-state is-unavailable"><h3>{chapter?.title || 'No chapter provided'}</h3><p>{access === 'purchase-only' ? 'Purchase access is available in Shop. The in-app chapter unlocks only after a successful purchase.' : 'This title has no provided readable passage yet. It remains in the catalog, but LitLearn will not redirect you elsewhere.'}</p></div>}</section>}</div> : <section className="book-empty-state"><h2>No books in this category</h2><p>Choose another category to continue browsing the provided LitLearn catalog.</p></section>}</section>;
}

function LegacyInAppBookLibraryScreenV2({ progress, quests, apiState, catalogBooks, profileId, onUpdate, onNavigate, onLaunchQuest, onStatus }) {
  const catalog = catalogBooks?.length ? catalogBooks : PLATFORM_CATALOG.books;
  const [category, setCategory] = useState('All categories');
  const [selectedBookId, setSelectedBookId] = useState(() => catalog[0]?.id || '');
  const [selectedChapterId, setSelectedChapterId] = useState('');
  const [reader, setReader] = useState({ kind: 'idle', sentences: [], attribution: null });
  const categories = ['All categories', ...new Set(catalog.map((book) => book.category || book.topic || 'Classics'))];
  const visible = catalog.filter((book) => category === 'All categories' || (book.category || book.topic || 'Classics') === category);
  const selectedBook = visible.find((book) => book.id === selectedBookId) || visible[0] || null;
  const chapter = selectedBook?.chapterMetadata?.find((item) => item.id === selectedChapterId) || selectedBook?.chapterMetadata?.[0] || null;
  const quest = selectedBook && chapter ? exactChapterQuest(selectedBook, chapter, quests) : null;
  const selectBook = (book) => {
    setSelectedBookId(book.id);
    setSelectedChapterId(book.chapterMetadata?.[0]?.id || '');
    setReader({ kind: 'idle', sentences: [], attribution: null });
    window.setTimeout(() => document.getElementById('selected-book-title')?.scrollIntoView({ behavior: progress.settings.reduceMotion ? 'auto' : 'smooth', block: 'start' }), 0);
  };
  const openReader = async () => {
    if (!selectedBook || !chapter) return;
    if (!profileId) {
      if (!quest) { setReader({ kind: 'unavailable', message: 'This chapter has no reviewed bundled passage in the offline demo.' }); return; }
      setReader({ kind: 'ready', sentences: sentencesFor(quest), attribution: selectedBook.requiredAttribution || 'Reviewed LitLearn passage.' });
      return;
    }
    setReader({ kind: 'loading', sentences: [], attribution: null });
    try {
      const result = await loadChapterReference(profileId, selectedBook.id, chapter.id);
      if (result.content?.mode !== 'bundled-passage') { setReader({ kind: 'unavailable', message: result.content?.reason || 'This chapter is not available for in-app reading yet.', attribution: result.attribution }); return; }
      setReader({ kind: 'ready', sentences: result.content.sentences || [], attribution: result.attribution });
    } catch { setReader({ kind: 'error', message: 'The chapter could not be loaded. Your local quest progress is still available offline.' }); }
  };
  const toggleBookWishlist = async (bookId) => {
    const wishlisted = !progress.wishlistIds.includes(bookId);
    if (profileId) {
      try { await setRemoteBookWishlist(profileId, bookId, wishlisted); } catch { onStatus('Wishlist could not sync; it remains saved in this browser.'); }
    }
    onUpdate((current) => toggleWishlist(current, bookId));
  };
  if (reader.kind === 'ready' && selectedBook && chapter) return <section className="in-app-reader" aria-labelledby="reader-title"><div className="reader-toolbar"><button className="secondary-button" type="button" onClick={() => setReader({ kind: 'idle', sentences: [], attribution: null })}>Back to {selectedBook.title}</button><span>In-app reading</span></div><p className="eyebrow">{selectedBook.title} · {chapter.title}</p><h1 id="reader-title">Read in LitLearn</h1><p className="reader-attribution">{reader.attribution?.requiredAttribution || reader.attribution || 'Reviewed LitLearn passage.'}</p><article className="passage-card" aria-label={`${chapter.title} passage`}>{reader.sentences.map((sentence, index) => <p key={sentence.id || index}>{sentence.text}</p>)}</article><div className="button-row"><button className="primary-button" type="button" disabled={!quest} onClick={() => { onUpdate((current) => markBookChapterRead(current, selectedBook.id, chapter.id)); onLaunchQuest(quest); }}>{quest ? 'Start comprehension quest' : 'Quest mapping unavailable'}</button><button className="secondary-button" type="button" onClick={() => { onUpdate((current) => markBookChapterRead(current, selectedBook.id, chapter.id)); setReader({ kind: 'idle', sentences: [], attribution: null }); }}>Mark chapter read</button></div></section>;
  return <section className="feature-card platform-collection book-library" aria-labelledby="books-title"><div className="collection-hero"><div><p className="eyebrow">LitLearn library</p><h1 id="books-title">Books</h1><p>Read provided bundled passages inside LitLearn. Titles without reviewed text remain visible and clearly unavailable.</p></div><span className={`book-state is-${apiState.kind === 'ready' ? 'ready' : 'error'}`}>{apiState.kind === 'ready' ? 'Catalog synced' : 'Offline catalog'}</span></div><label className="book-category-filter" htmlFor="book-category">Category<select id="book-category" value={category} onChange={(event) => { setCategory(event.target.value); setSelectedBookId(''); }}><option>All categories</option>{categories.slice(1).map((item) => <option key={item}>{item}</option>)}</select></label>{visible.length ? <div className="book-library-layout"><section className="book-shelf" aria-label="Books by category">{visible.map((book) => { const state = bookAccessState(book, progress); return <article key={book.id} className={`book-card ${book.id === selectedBook?.id ? 'is-selected' : ''}`}><span className={`book-state is-${state}`}>{state === 'owned' ? 'Owned forever' : state === 'subscription' ? 'Readable with Premium' : state === 'free' ? 'Free chapters' : state === 'purchase-only' ? 'Purchase required' : 'Locked'}</span><h2>{book.title}</h2><p>{book.author} · {book.category || book.topic}</p><button className="secondary-button" type="button" onClick={() => selectBook(book)}>View reading path</button><button className="text-button" type="button" onClick={() => toggleBookWishlist(book.id)}>{progress.wishlistIds.includes(book.id) ? '★ Wishlisted' : '☆ Add to wishlist'}</button></article>; })}</section>{selectedBook && <section className="book-reader-workspace" aria-labelledby="selected-book-title"><div className="book-detail-header"><div><h2 id="selected-book-title" tabIndex="-1">{selectedBook.title}</h2><p>{selectedBook.author} · {selectedBook.edition}</p></div><button className="text-button" type="button" onClick={() => onNavigate('shop')}>Book options in Shop</button></div><p className="source-attribution"><strong>Attribution:</strong> {selectedBook.requiredAttribution || 'Catalog attribution pending review.'}</p><div className="chapter-list" aria-label={`${selectedBook.title} chapters`}>{(selectedBook.chapterMetadata || []).map((item) => <button key={item.id} type="button" className={chapter?.id === item.id ? 'is-selected' : ''} onClick={() => { setSelectedChapterId(item.id); setReader({ kind: 'idle', sentences: [], attribution: null }); }}>{item.title}<small>{progress.bookReading[selectedBook.id]?.chapterIds?.includes(item.id) ? 'Read' : item.contentAvailability === 'bundled-passage' ? 'Ready in app' : 'Unavailable'}</small></button>)}</div>{reader.kind === 'loading' ? <div className="source-reader-state is-loading" role="status">Loading the reviewed in-app passage…</div> : reader.kind === 'error' || reader.kind === 'unavailable' ? <div className="source-reader-state is-unavailable" role="status"><h3>{chapter?.title}</h3><p>{reader.message}</p><button className="secondary-button" type="button" onClick={() => setReader({ kind: 'idle', sentences: [], attribution: null })}>Back to chapter list</button></div> : chapter?.contentAvailability === 'bundled-passage' ? <div className="source-reader-state is-ready"><h3>{chapter.title}</h3><p>This provided passage opens inside LitLearn.</p><button className="primary-button" type="button" onClick={openReader}>Read chapter in LitLearn</button></div> : <div className="source-reader-state is-unavailable"><h3>{chapter?.title || 'No chapter provided'}</h3><p>This title has no provided readable passage yet. LitLearn will not redirect you elsewhere.</p></div>}</section>}</div> : <section className="book-empty-state"><h2>No books in this category</h2><p>Choose another category to continue browsing the provided catalog.</p></section>}</section>;
}

function LegacyInteractiveBookLibraryScreen({ progress, quests, apiState, catalogBooks, bookQuizzes = [], profileId, shopItems = [], onUpdate, onNavigate, onLaunchQuest, onStatus }) {
  const catalog = catalogBooks?.length ? catalogBooks : PLATFORM_CATALOG.books;
  const [category, setCategory] = useState('All categories');
  const [accessFilter, setAccessFilter] = useState('all');
  const [selectedBookId, setSelectedBookId] = useState(() => catalog[0]?.id || '');
  const [selectedChapterId, setSelectedChapterId] = useState('');
  const [reader, setReader] = useState({ kind: 'idle', sentences: [], attribution: null });
  const categories = ['All categories', ...new Set(catalog.map((book) => book.category || book.topic || 'Classics'))];
  const visible = catalog.filter((book) => {
    const categoryMatches = category === 'All categories' || (book.category || book.topic || 'Classics') === category;
    const availability = bookAccessState(book, progress);
    const accessMatches = accessFilter === 'all'
      || (accessFilter === 'readable' && ['free', 'subscription', 'owned'].includes(availability))
      || availability === accessFilter;
    return categoryMatches && accessMatches;
  });
  const selectedBook = visible.find((book) => book.id === selectedBookId) || visible[0] || null;
  const chapter = selectedBook?.chapterMetadata?.find((item) => item.id === selectedChapterId) || selectedBook?.chapterMetadata?.[0] || null;
  const chapterAccess = selectedBook && chapter ? chapterAccessState(selectedBook, chapter, progress) : 'locked';
  const quest = selectedBook && chapter ? exactChapterQuest(selectedBook, chapter, quests) : null;
  const catalogQuiz = selectedBook && chapter ? bookQuizzes.find((quiz) => quiz.bookId === selectedBook.id && quiz.chapterIds?.includes(chapter.id)) : null;
  const accessLabel = (access) => ({ owned: 'Owned permanently', free: 'Free access', subscription: 'Premium access', 'purchase-only': 'Purchase with Diamonds', locked: 'Premium required' }[access] || access);
  const selectBook = (book) => {
    setSelectedBookId(book.id);
    setSelectedChapterId(book.chapterMetadata?.[0]?.id || '');
    setReader({ kind: 'idle', sentences: [], attribution: null });
    window.setTimeout(() => document.getElementById('selected-book-title')?.focus(), 0);
  };
  const toggleBookWishlist = async (bookId) => {
    const wishlisted = !progress.bookWishlistIds.includes(bookId);
    if (profileId) {
      try { await setRemoteBookWishlist(profileId, bookId, wishlisted); }
      catch { onStatus('Your book wishlist could not sync, so LitLearn kept the local change.'); }
    }
    onUpdate((current) => updateBookWishlist(current, bookId));
  };
  const buyBook = async () => {
    if (!selectedBook) return;
    const offer = shopItems.find((item) => item.id === `shop-book-${selectedBook.id}` || item.catalogId === selectedBook.id);
    const price = Number(offer?.price ?? selectedBook.priceDiamonds ?? 0);
    if (profileId && offer) {
      try {
        const purchase = await purchaseShopItem(profileId, offer.id);
        onUpdate((current) => ({ ...applyRemoteBalances(current, purchase), ownedBookIds: [...new Set([...current.ownedBookIds, purchase.bookId || purchase.selectedBookId || selectedBook.id])]}));
        onStatus(`${selectedBook.title} is now permanently owned.`);
      } catch { onStatus(`The purchase did not complete. You need ${price} Diamonds.`); }
      return;
    }
    if (progress.currencies.diamonds < price || !price) { onStatus(`You need ${price || 'the listed number of'} Diamonds to purchase this book.`); return; }
    onUpdate((current) => purchaseCatalogItem(current, { itemType: 'book', catalogId: selectedBook.id, price, currency: 'diamonds' }));
    onStatus(`${selectedBook.title} is now permanently owned in this demo.`);
  };
  const openReader = async () => {
    if (!selectedBook || !chapter) return;
    if (!['free', 'subscription', 'owned'].includes(chapterAccess)) { setReader({ kind: 'unavailable', message: `${accessLabel(chapterAccess)}. Unlock this chapter before reading it in LitLearn.` }); return; }
    if (!profileId) {
      if (!quest) { setReader({ kind: 'unavailable', message: 'This chapter has no reviewed bundled passage in the offline demo.' }); return; }
      setReader({ kind: 'ready', sentences: sentencesFor(quest), attribution: selectedBook.requiredAttribution || 'Reviewed LitLearn passage.' });
      return;
    }
    setReader({ kind: 'loading', sentences: [], attribution: null });
    try {
      const result = await loadChapterReference(profileId, selectedBook.id, chapter.id);
      if (result.content?.mode !== 'bundled-passage') { setReader({ kind: 'unavailable', message: result.content?.reason || 'This chapter is not available for in-app reading yet.', attribution: result.attribution }); return; }
      setReader({ kind: 'ready', sentences: result.content.sentences || [], attribution: result.attribution });
    } catch { setReader({ kind: 'error', message: 'The chapter could not be loaded. Your local quest progress is still available offline.' }); }
  };
  if (reader.kind === 'ready' && selectedBook && chapter) return <section className="in-app-reader" aria-labelledby="reader-title"><div className="reader-toolbar"><button className="secondary-button" type="button" onClick={() => setReader({ kind: 'idle', sentences: [], attribution: null })}>Back to {selectedBook.title}</button><span>In-app reading</span></div><p className="eyebrow">{selectedBook.title} · {chapter.title}</p><h1 id="reader-title">Read in LitLearn</h1><p className="reader-attribution">{reader.attribution?.requiredAttribution || reader.attribution || 'Reviewed LitLearn passage.'}</p><article className="passage-card" aria-label={`${chapter.title} passage`}>{reader.sentences.map((sentence, index) => <p key={sentence.id || index}>{sentence.text}</p>)}</article><div className="button-row">{catalogQuiz ? <div className="quiz-source-label"><strong>Comprehension quiz source:</strong> {selectedBook.title}, {catalogQuiz.edition || selectedBook.edition || 'reviewed edition'}, {chapter.title} · {catalogQuiz.accessTier === 'advanced' ? 'Premium quiz' : 'Included quiz'}</div> : <div className="quiz-source-label">No reviewed comprehension quiz is mapped to this chapter yet.</div>}<button className="primary-button" type="button" disabled={!quest || !catalogQuiz} onClick={() => { onUpdate((current) => markBookChapterRead(current, selectedBook.id, chapter.id)); onLaunchQuest(quest); }}>{quest && catalogQuiz ? 'Start comprehension quiz' : 'Quiz coming soon'}</button><button className="secondary-button" type="button" onClick={() => { onUpdate((current) => markBookChapterRead(current, selectedBook.id, chapter.id)); setReader({ kind: 'idle', sentences: [], attribution: null }); }}>Mark chapter read</button></div></section>;
  return <section className="feature-card platform-collection book-library" aria-labelledby="books-title"><div className="collection-hero"><div><p className="eyebrow">LitLearn library</p><h1 id="books-title">Books</h1><p>Browse every catalog record, then read only reviewed bundled passages inside LitLearn.</p></div><span className={`book-state is-${apiState.kind === 'ready' ? 'ready' : 'error'}`}>{apiState.kind === 'ready' ? 'Catalog synced' : 'Offline catalog'}</span></div><div className="book-filters"><label htmlFor="book-category">Category<select id="book-category" value={category} onChange={(event) => { setCategory(event.target.value); setSelectedBookId(''); }}><option>All categories</option>{categories.slice(1).map((item) => <option key={item}>{item}</option>)}</select></label><label htmlFor="book-access">Access<select id="book-access" value={accessFilter} onChange={(event) => { setAccessFilter(event.target.value); setSelectedBookId(''); }}><option value="all">All access</option><option value="readable">Readable now</option><option value="subscription">Premium</option><option value="purchase-only">Purchase with Diamonds</option></select></label></div>{visible.length ? <div className="book-library-layout"><section className="book-shelf" aria-label="Filtered book catalog">{visible.map((book) => { const state = bookAccessState(book, progress); return <article key={book.id} className={`book-card ${book.id === selectedBook?.id ? 'is-selected' : ''}`}><span className={`book-state is-${state}`}>{accessLabel(state)}</span><h2>{book.title}</h2><p>{book.author} · {book.category || book.topic}</p><button className="secondary-button" type="button" onClick={() => selectBook(book)}>Open book details</button><button className="text-button" type="button" onClick={() => toggleBookWishlist(book.id)}>{progress.bookWishlistIds.includes(book.id) ? '★ Remove from book wishlist' : '☆ Add to book wishlist'}</button></article>; })}</section>{selectedBook && <section className="book-reader-workspace" aria-labelledby="selected-book-title"><div className="book-detail-header"><div><span className={`book-state is-${bookAccessState(selectedBook, progress)}`}>{accessLabel(bookAccessState(selectedBook, progress))}</span><h2 id="selected-book-title" tabIndex="-1">{selectedBook.title}</h2><p>{selectedBook.author} · {selectedBook.edition || 'Reviewed edition'}</p></div><button className="text-button" type="button" onClick={() => onNavigate('shop')}>Open in Shop</button></div><p className="source-attribution"><strong>Project Gutenberg attribution:</strong> {selectedBook.requiredAttribution || 'Catalog attribution pending review.'}</p><div className="chapter-list" aria-label={`${selectedBook.title} available chapters and reading levels`}>{(selectedBook.chapterMetadata || []).map((item) => { const selected = chapter?.id === item.id; const levelLabels = (item.readingLevels || []).map((level) => `${level.label || level.id}${level.accessTier === 'premium' ? ' · Premium' : ''}`).join(', '); return <button key={item.id} type="button" className={selected ? 'is-selected' : ''} onClick={() => { setSelectedChapterId(item.id); setReader({ kind: 'idle', sentences: [], attribution: null }); }}><strong>{item.title}</strong><small>{levelLabels || 'Standard level'} · {progress.bookReading[selectedBook.id]?.chapterIds?.includes(item.id) ? 'Read' : item.contentAvailability === 'bundled-passage' ? accessLabel(chapterAccessState(selectedBook, item, progress)) : 'Unavailable in app'}</small></button>; })}</div>{reader.kind === 'loading' ? <div className="source-reader-state is-loading" role="status">Loading the reviewed in-app passage…</div> : reader.kind === 'error' || reader.kind === 'unavailable' ? <div className="source-reader-state is-unavailable" role="status"><h3>{chapter?.title}</h3><p>{reader.message}</p><button className="secondary-button" type="button" onClick={() => setReader({ kind: 'idle', sentences: [], attribution: null })}>Back to chapter list</button></div> : chapter?.contentAvailability === 'bundled-passage' ? <div className="source-reader-state is-ready"><h3>{chapter.title}</h3><p>{accessLabel(chapterAccess)} · this reviewed passage opens inside LitLearn.</p><button className="primary-button" type="button" onClick={openReader}>{chapterAccess === 'locked' ? 'Premium required' : 'Read chapter in LitLearn'}</button></div> : <div className="source-reader-state is-unavailable"><h3>{chapter?.title || 'No chapter provided'}</h3><p>This title has no provided readable passage yet. LitLearn will not redirect you elsewhere.</p></div>}{chapterAccess === 'purchase-only' && <button className="secondary-button" type="button" onClick={buyBook}>Buy permanently for {selectedBook.priceDiamonds || shopItems.find((item) => item.catalogId === selectedBook.id)?.price || 0} Diamonds</button>}</section>}</div> : <section className="book-empty-state"><h2>No books match those filters</h2><p>Clear a filter to browse another part of the catalog.</p></section>}</section>;
}

function LegacyChapterActivityDeck({ book, chapter, quest, quiz, activityPayload, sentences, onLaunchQuest }) {
  const [activity, setActivity] = useState('evidence');
  const [evidenceId, setEvidenceId] = useState('');
  const [sceneStep, setSceneStep] = useState('beginning');
  const [creativeResponse, setCreativeResponse] = useState('');
  const source = activityPayload?.sourceLabel || quiz?.sourceLabel || `${book.title}, ${chapter.title}`;
  const activeSentence = sentences.find((sentence) => sentence.id === evidenceId);
  return <section className="chapter-activities" aria-labelledby="chapter-activities-title"><div><p className="eyebrow">Chapter activity deck</p><h2 id="chapter-activities-title">Learn from this exact section</h2><p className="activity-source"><strong>Source:</strong> {source}</p></div><div className="activity-tabs" role="tablist" aria-label={`Activities for ${source}`}>{[['story', 'Story quest'], ['evidence', 'Evidence'], ['characters', 'Character map'], ['vocabulary', 'Vocabulary'], ['scene', 'Scene build'], ['creative', 'Create']].map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={activity === id} onClick={() => setActivity(id)}>{label}</button>)}</div>{activity === 'story' && <section className="activity-panel" role="tabpanel"><h3>Story quest</h3><p><strong>Source:</strong> {source}</p><p>{activityPayload?.activityType ? `Reviewed ${activityPayload.activityType} activity. ` : ''}{quiz ? 'This reviewed chapter quiz uses only this chapter’s mapped source.' : 'This chapter does not yet have a separate catalog quiz. Its mapped reading quest remains available when reviewed.'}</p><button className="primary-button" type="button" disabled={!quest} onClick={() => onLaunchQuest(quest)}>{quest ? 'Start exact-chapter quest' : 'Quest mapping unavailable'}</button></section>}{activity === 'evidence' && <section className="activity-panel" role="tabpanel"><h3>Evidence collection</h3><p><strong>Source:</strong> {source}. Choose a sentence you would collect as evidence; feedback stays private to this reading session.</p><div className="evidence-pick-list">{sentences.map((sentence, index) => <button type="button" key={sentence.id || index} aria-pressed={evidenceId === sentence.id} onClick={() => setEvidenceId(sentence.id)}>{sentence.text}</button>)}</div>{activeSentence && <p className="activity-feedback" role="status">Evidence collected from this chapter: “{activeSentence.text}”</p>}</section>}{activity === 'characters' && <section className="activity-panel" role="tabpanel"><h3>Character map</h3><p><strong>Source:</strong> {source}. Use an evidence sentence to map who acts, what they want, and what changes.</p><label>Character or person<input placeholder="Name from the chapter" /></label><label>Action or goal<input placeholder="What they do or want" /></label><button className="secondary-button" type="button" onClick={() => setActivity('evidence')}>Choose supporting evidence</button></section>}{activity === 'vocabulary' && <section className="activity-panel" role="tabpanel"><h3>Vocabulary in context</h3><p><strong>Source:</strong> {source}. Pick a word from the passage, then explain its meaning using a nearby clue.</p><label>Word from this chapter<input placeholder="Type a word you noticed" /></label><label>Context clue<textarea placeholder="Which sentence or detail helps explain it?" /></label></section>}{activity === 'scene' && <section className="activity-panel" role="tabpanel"><h3>Scene reconstruction</h3><p><strong>Source:</strong> {source}. Build the order of events from the exact passage.</p><div className="scene-steps">{['beginning', 'change', 'result'].map((step) => <button key={step} type="button" aria-pressed={sceneStep === step} onClick={() => setSceneStep(step)}>{step === 'beginning' ? 'First' : step === 'change' ? 'Then' : 'Result'}</button>)}</div><label>{sceneStep === 'beginning' ? 'What begins the scene?' : sceneStep === 'change' ? 'What changes?' : 'What is the result?'}<textarea placeholder="Use your own words and a detail from this chapter" /></label></section>}{activity === 'creative' && <section className="activity-panel" role="tabpanel"><h3>Creative response</h3><p><strong>Source:</strong> {source}. Write a short new line, journal entry, or sketch prompt that keeps faith with this chapter’s evidence.</p><label>Your response<textarea value={creativeResponse} onChange={(event) => setCreativeResponse(event.target.value.slice(0, 500))} maxLength="500" placeholder="Write up to 500 characters" /></label><p className="quiet">{creativeResponse.length}/500 · kept only in this browser session.</p></section>}</section>;
}

function ChapterActivityDeck({ book, chapter, quest, quiz, activityPayload, sentences, onLaunchQuest }) {
  const [activity, setActivity] = useState('story');
  const [evidenceId, setEvidenceId] = useState('');
  const [chapterPause, setChapterPause] = useState('');
  const [characterMap, setCharacterMap] = useState({ character: '', relationship: '', evidence: '' });
  const [sceneStep, setSceneStep] = useState('beginning');
  const [sceneNote, setSceneNote] = useState('');
  const [vocabulary, setVocabulary] = useState({ word: '', clue: '' });
  const [creativeResponse, setCreativeResponse] = useState('');
  const [worldNote, setWorldNote] = useState('');
  const activities = supportedChapterActivities({ activityPayload, quiz, quest });
  const supportedIds = new Set(activities.map((item) => item.id));
  const selectedActivity = supportedIds.has(activity) ? activity : activities[0]?.id;
  const source = chapterActivitySource(book, chapter, activityPayload, quiz);
  const activeSentence = sentences.find((sentence) => sentence.id === evidenceId);

  if (!activities.length) {
    return <section className="chapter-activities" aria-labelledby="chapter-activities-title">
      <p className="eyebrow">Chapter activity deck</p>
      <h2 id="chapter-activities-title">No reviewed activity for this section yet</h2>
      <p className="activity-source"><strong>Source:</strong> {source}</p>
      <p className="quiet">You can keep reading this exact chapter. LitLearn will add an activity only after it has a reviewed chapter mapping.</p>
    </section>;
  }

  return <section className="chapter-activities" aria-labelledby="chapter-activities-title">
    <div>
      <p className="eyebrow">Chapter activity deck</p>
      <h2 id="chapter-activities-title">Learn from this exact section</h2>
      <p className="activity-source"><strong>Source:</strong> {source}</p>
    </div>
    <div className="activity-tabs" role="tablist" aria-label={`Reviewed activities for ${source}`}>
      {activities.map(({ id, label }) => <button key={id} id={`activity-tab-${id}`} type="button" role="tab" aria-selected={selectedActivity === id} aria-controls={`activity-panel-${id}`} onClick={() => setActivity(id)}>{label}</button>)}
    </div>
    {selectedActivity === 'story' && <section className="activity-panel" id="activity-panel-story" role="tabpanel" aria-labelledby="activity-tab-story">
      <h3>Story quest</h3>
      <p><strong>Source:</strong> {source}</p>
      <p>{quiz ? 'This reviewed chapter quest uses only the source shown above. Check the chapter text whenever you need a clue.' : 'This mapped reading quest is reviewed against this exact chapter.'}</p>
      <button className="primary-button" type="button" disabled={!quest} onClick={() => onLaunchQuest(quest)}>{quest ? 'Start exact-chapter quest' : 'Quest mapping unavailable'}</button>
    </section>}
    {selectedActivity === 'evidence' && <section className="activity-panel" id="activity-panel-evidence" role="tabpanel" aria-labelledby="activity-tab-evidence">
      <h3>Evidence collection</h3>
      <p><strong>Source:</strong> {source}. Collect one sentence, then return to the quest to test your reasoning.</p>
      <div className="evidence-pick-list">{sentences.map((sentence, index) => <button type="button" key={sentence.id || index} aria-pressed={evidenceId === sentence.id} onClick={() => setEvidenceId(sentence.id)}>{sentence.text}</button>)}</div>
      {activeSentence && <p className="activity-feedback" role="status">Evidence note saved for this browser session: “{activeSentence.text}”</p>}
    </section>}
    {selectedActivity === 'characters' && <section className="activity-panel" id="activity-panel-characters" role="tabpanel" aria-labelledby="activity-tab-characters">
      <h3>Character relationship map</h3>
      <p><strong>Source:</strong> {source}. Identify a relationship, then support it with a detail you can verify in the chapter text.</p>
      <label>Character or person<input value={characterMap.character} onChange={(event) => setCharacterMap((current) => ({ ...current, character: event.target.value }))} placeholder="Name from the chapter" /></label>
      <label>Relationship, action, or goal<input value={characterMap.relationship} onChange={(event) => setCharacterMap((current) => ({ ...current, relationship: event.target.value }))} placeholder="What connects them?" /></label>
      <label>Text evidence<textarea value={characterMap.evidence} onChange={(event) => setCharacterMap((current) => ({ ...current, evidence: event.target.value }))} placeholder="Write the sentence ID or a detail you found" /></label>
    </section>}
    {selectedActivity === 'pause' && <section className="activity-panel" id="activity-panel-pause" role="tabpanel" aria-labelledby="activity-tab-pause">
      <h3>Interactive chapter pause</h3>
      <p><strong>Source:</strong> {source}. Pause at this reviewed decision point. Make a prediction, then confirm it against the chapter text.</p>
      <label>My prediction or choice<textarea value={chapterPause} onChange={(event) => setChapterPause(event.target.value.slice(0, 500))} maxLength="500" placeholder="Use a chapter detail to explain your thinking" /></label>
      <p className="quiet">{chapterPause.length}/500 · kept only in this browser session.</p>
    </section>}
    {selectedActivity === 'vocabulary' && <section className="activity-panel" id="activity-panel-vocabulary" role="tabpanel" aria-labelledby="activity-tab-vocabulary">
      <h3>Vocabulary in context</h3>
      <p><strong>Source:</strong> {source}. Use a nearby sentence to explain a word in this reviewed vocabulary activity.</p>
      <label>Word from this chapter<input value={vocabulary.word} onChange={(event) => setVocabulary((current) => ({ ...current, word: event.target.value }))} placeholder="Type a word you noticed" /></label>
      <label>Context clue<textarea value={vocabulary.clue} onChange={(event) => setVocabulary((current) => ({ ...current, clue: event.target.value }))} placeholder="Which chapter detail helps explain it?" /></label>
    </section>}
    {selectedActivity === 'scene' && <section className="activity-panel" id="activity-panel-scene" role="tabpanel" aria-labelledby="activity-tab-scene">
      <h3>Scene reconstruction</h3>
      <p><strong>Source:</strong> {source}. Rebuild the reviewed scene in order using the chapter.</p>
      <div className="scene-steps">{['beginning', 'change', 'result'].map((step) => <button key={step} type="button" aria-pressed={sceneStep === step} onClick={() => setSceneStep(step)}>{step === 'beginning' ? 'First' : step === 'change' ? 'Then' : 'Result'}</button>)}</div>
      <label>{sceneStep === 'beginning' ? 'What begins the scene?' : sceneStep === 'change' ? 'What changes?' : 'What is the result?'}<textarea value={sceneNote} onChange={(event) => setSceneNote(event.target.value.slice(0, 500))} maxLength="500" placeholder="Use your own words and a detail from this chapter" /></label>
    </section>}
    {selectedActivity === 'creative' && <section className="activity-panel" id="activity-panel-creative" role="tabpanel" aria-labelledby="activity-tab-creative">
      <h3>Creative response</h3>
      <p><strong>Source:</strong> {source}. Try an alternate ending or another character’s viewpoint while staying faithful to the chapter evidence.</p>
      <label>Your response<textarea value={creativeResponse} onChange={(event) => setCreativeResponse(event.target.value.slice(0, 500))} maxLength="500" placeholder="Write up to 500 characters" /></label>
      <p className="quiet">{creativeResponse.length}/500 · kept only in this browser session.</p>
    </section>}
    {selectedActivity === 'world' && <section className="activity-panel" id="activity-panel-world" role="tabpanel" aria-labelledby="activity-tab-world">
      <h3>Book-world map</h3>
      <p><strong>Source:</strong> {source}. Record one setting or route from this reviewed chapter, then cite the detail that locates it.</p>
      <label>Setting and evidence<textarea value={worldNote} onChange={(event) => setWorldNote(event.target.value.slice(0, 500))} maxLength="500" placeholder="Place, route, or setting clue from this chapter" /></label>
      <p className="quiet">{worldNote.length}/500 · kept only in this browser session.</p>
    </section>}
  </section>;
}

function LegacyInAppBookLibraryScreenV3({ progress, quests, apiState, catalogBooks, bookQuizzes = [], bookActivities = [], profileId, shopItems = [], onUpdate, onNavigate, onLaunchQuest, onStatus }) {
  const catalog = catalogBooks?.length ? catalogBooks : PLATFORM_CATALOG.books;
  const [category, setCategory] = useState('All categories');
  const [accessFilter, setAccessFilter] = useState('all');
  const [selectedBookId, setSelectedBookId] = useState(() => catalog[0]?.id || '');
  const [selectedChapterId, setSelectedChapterId] = useState('');
  const [reader, setReader] = useState({ kind: 'idle', sentences: [], attribution: null });
  const categories = ['All categories', ...new Set(catalog.map((book) => book.category || book.topic || 'Classics'))];
  const visible = catalog.filter((book) => {
    const access = bookAccessState(book, progress);
    return (category === 'All categories' || (book.category || book.topic || 'Classics') === category) && (accessFilter === 'all' || (accessFilter === 'readable' && ['free', 'subscription', 'owned'].includes(access)) || access === accessFilter);
  });
  const selectedBook = visible.find((book) => book.id === selectedBookId) || visible[0] || null;
  const chapter = selectedBook?.chapterMetadata?.find((item) => item.id === selectedChapterId) || selectedBook?.chapterMetadata?.[0] || null;
  const chapterAccess = selectedBook && chapter ? chapterAccessState(selectedBook, chapter, progress) : 'locked';
  const quest = selectedBook && chapter ? exactChapterQuest(selectedBook, chapter, quests) : null;
  const quiz = selectedBook && chapter ? bookQuizzes.find((item) => item.bookId === selectedBook.id && item.chapterIds?.includes(chapter.id)) : null;
  const activityPayload = selectedBook && chapter ? bookActivities.find((item) => item.bookId === selectedBook.id && item.chapterIds?.includes(chapter.id)) : null;
  const accessLabel = (access) => ({ owned: 'Owned forever', free: 'Free access', subscription: 'Readable with Premium', 'purchase-only': 'Purchase required', locked: 'Locked' }[access] || access);
  const choose = (book) => { setSelectedBookId(book.id); setSelectedChapterId(book.chapterMetadata?.[0]?.id || ''); setReader({ kind: 'idle', sentences: [], attribution: null }); window.setTimeout(() => document.getElementById('selected-book-title')?.focus(), 0); };
  const toggleWishlist = async (bookId) => { const next = !progress.bookWishlistIds.includes(bookId); if (profileId) try { await setRemoteBookWishlist(profileId, bookId, next); } catch { onStatus('Wishlist sync is unavailable; the book remains saved in this browser.'); } onUpdate((current) => updateBookWishlist(current, bookId)); };
  const buyBook = async () => { const offer = shopItems.find((item) => item.id === `shop-book-${selectedBook?.id}`); if (!selectedBook || !offer) return; try { const purchase = profileId ? await purchaseShopItem(profileId, offer.id) : null; onUpdate((current) => purchase ? { ...applyRemoteBalances(current, purchase), ownedBookIds: purchase.ownedBookIds || [...new Set([...current.ownedBookIds, selectedBook.id])] } : purchaseCatalogItem(current, { itemType: 'book', catalogId: selectedBook.id, price: offer.price, currency: offer.currency })); onStatus(`${selectedBook.title} is now permanently owned.`); } catch { onStatus(`Purchase unavailable. You need ${offer.price} ${offer.currency === 'diamonds' ? 'Diamonds' : 'Gold'}.`); } };
  const openReader = async () => { if (!selectedBook || !chapter) return; if (!profileId) { if (!['free', 'subscription', 'owned'].includes(chapterAccess)) { setReader({ kind: 'unavailable', message: `${accessLabel(chapterAccess)}. Change plan or purchase this title to continue.` }); return; } if (!quest) { setReader({ kind: 'unavailable', message: 'This chapter has no reviewed bundled passage available offline.' }); return; } setReader({ kind: 'ready', sentences: sentencesFor(quest), attribution: selectedBook.requiredAttribution }); return; } setReader({ kind: 'loading', sentences: [], attribution: null }); try { const result = await loadChapterReference(profileId, selectedBook.id, chapter.id); const chapterSentences = readableChapterSentences(result.content); if (!chapterSentences.length) { setReader({ kind: 'unavailable', message: result.content?.reason || 'This chapter is unavailable in the reader.', attribution: result.attribution }); return; } setReader({ kind: 'ready', sentences: chapterSentences, attribution: result.attribution }); } catch { setReader({ kind: 'error', message: 'Chapter loading failed. Your local reading and quest progress are preserved.' }); } };
  if (reader.kind === 'ready' && selectedBook && chapter) return <section className="in-app-reader" aria-labelledby="reader-title"><div className="reader-toolbar"><button className="secondary-button" type="button" onClick={() => setReader({ kind: 'idle', sentences: [], attribution: null })}>Back to {selectedBook.title}</button><span>In-app reading</span></div><p className="eyebrow">{selectedBook.title} · {chapter.title}</p><h1 id="reader-title">Read in LitLearn</h1><p className="reader-attribution">{reader.attribution?.requiredAttribution || reader.attribution || selectedBook.requiredAttribution}</p><article className="passage-card" aria-label={`${chapter.title} passage`}>{reader.sentences.map((sentence, index) => <p key={sentence.id || index}>{sentence.text}</p>)}</article><ChapterActivityDeck book={selectedBook} chapter={chapter} quest={quest} quiz={quiz} activityPayload={activityPayload} sentences={reader.sentences} onLaunchQuest={(nextQuest) => { onUpdate((current) => markBookChapterRead(current, selectedBook.id, chapter.id)); onLaunchQuest(nextQuest); }} /><div className="button-row"><button className="primary-button" type="button" disabled={!quest} onClick={() => { onUpdate((current) => markBookChapterRead(current, selectedBook.id, chapter.id)); onLaunchQuest(quest); }}>{quest ? 'Start comprehension quest' : 'Quest mapping unavailable'}</button><button className="secondary-button" type="button" onClick={() => { onUpdate((current) => markBookChapterRead(current, selectedBook.id, chapter.id)); setReader({ kind: 'idle', sentences: [], attribution: null }); }}>Mark chapter read</button></div></section>;
  return <section className="feature-card platform-collection book-library" aria-labelledby="books-title"><div className="collection-hero"><div><p className="eyebrow">LitLearn library</p><h1 id="books-title">Books</h1><p>Open approved bundled passages here. Every reader, activity, and quiz displays its exact book and chapter.</p></div><span className={`book-state is-${apiState.kind === 'ready' ? 'ready' : 'error'}`}>{apiState.kind === 'ready' ? 'Catalog synced' : 'Offline catalog'}</span></div><div className="book-filters"><label htmlFor="book-category">Category<select id="book-category" value={category} onChange={(event) => { setCategory(event.target.value); setSelectedBookId(''); }}><option>All categories</option>{categories.slice(1).map((item) => <option key={item}>{item}</option>)}</select></label><label htmlFor="book-access">Access<select id="book-access" value={accessFilter} onChange={(event) => { setAccessFilter(event.target.value); setSelectedBookId(''); }}><option value="all">All access</option><option value="readable">Readable now</option><option value="subscription">Premium</option><option value="purchase-only">Purchase required</option></select></label></div>{visible.length ? <div className="book-library-layout"><section className="book-shelf" aria-label="Filtered approved book catalog">{visible.map((book) => <article key={book.id} className={`book-card ${book.id === selectedBook?.id ? 'is-selected' : ''}`}><span className={`book-state is-${bookAccessState(book, progress)}`}>{accessLabel(bookAccessState(book, progress))}</span><h2>{book.title}</h2><p>{book.author} · {book.category || book.topic}</p><button className="secondary-button" type="button" onClick={() => choose(book)}>Open book details</button><button className="text-button" type="button" onClick={() => toggleWishlist(book.id)}>{progress.bookWishlistIds.includes(book.id) ? '★ Remove from book wishlist' : '☆ Add to book wishlist'}</button></article>)}</section>{selectedBook && <section className="book-reader-workspace" aria-labelledby="selected-book-title"><div className="book-detail-header"><div><span className={`book-state is-${bookAccessState(selectedBook, progress)}`}>{accessLabel(bookAccessState(selectedBook, progress))}</span><h2 id="selected-book-title" tabIndex="-1">{selectedBook.title}</h2><p>{selectedBook.author} · {selectedBook.edition || 'Reviewed edition'}</p></div><button className="text-button" type="button" onClick={() => onNavigate('shop')}>Open in Shop</button></div><p className="source-attribution"><strong>Source attribution:</strong> {selectedBook.requiredAttribution || 'Catalog attribution pending review.'}</p><div className="chapter-list" aria-label={`${selectedBook.title} chapter navigation`}>{(selectedBook.chapterMetadata || []).map((item) => <button key={item.id} type="button" className={chapter?.id === item.id ? 'is-selected' : ''} onClick={() => { setSelectedChapterId(item.id); setReader({ kind: 'idle', sentences: [], attribution: null }); }}><strong>{item.title}</strong><small>{progress.bookReading[selectedBook.id]?.chapterIds?.includes(item.id) ? 'Read' : item.contentAvailability === 'bundled-passage' ? accessLabel(chapterAccessState(selectedBook, item, progress)) : 'Unavailable in app'}</small></button>)}</div>{reader.kind === 'loading' ? <div className="source-reader-state is-loading" role="status">Loading the approved in-app chapter…</div> : reader.kind === 'error' || reader.kind === 'unavailable' ? <div className="source-reader-state is-unavailable" role="status"><h3>{chapter?.title}</h3><p>{reader.message}</p><button className="secondary-button" type="button" onClick={() => setReader({ kind: 'idle', sentences: [], attribution: null })}>Back to chapter list</button></div> : chapter?.contentAvailability === 'bundled-passage' ? <div className="source-reader-state is-ready"><h3>{chapter.title}</h3><p>{accessLabel(chapterAccess)} · reviewed text stays in LitLearn.</p><button className="primary-button" type="button" onClick={openReader}>{chapterAccess === 'locked' ? 'Premium required' : 'Read chapter in LitLearn'}</button></div> : <div className="source-reader-state is-unavailable"><h3>{chapter?.title || 'No chapter selected'}</h3><p>This chapter has no approved bundled passage yet, so LitLearn keeps it unavailable instead of sending you elsewhere.</p></div>}{chapterAccess === 'purchase-only' && <button className="secondary-button" type="button" onClick={buyBook}>Buy permanently for {shopItems.find((item) => item.id === `shop-book-${selectedBook.id}`)?.price || 0} Diamonds</button>}</section>}</div> : <section className="book-empty-state"><h2>No books match those filters</h2><p>Change a category or access filter to explore another approved title.</p></section>}</section>;
}

function InAppBookLibraryScreen({ progress, quests, apiState, catalogBooks, bookQuizzes = [], bookActivities = [], profileId, shopItems = [], onUpdate, onNavigate, onLaunchQuest, onStatus }) {
  const catalog = catalogBooks?.length ? catalogBooks : PLATFORM_CATALOG.books;
  const [category, setCategory] = useState('All categories');
  const [accessFilter, setAccessFilter] = useState('all');
  const [selectedBookId, setSelectedBookId] = useState(() => catalog[0]?.id || '');
  const [selectedChapterId, setSelectedChapterId] = useState('');
  const [reader, setReader] = useState({ kind: 'idle', sentences: [], attribution: null });
  const categories = ['All categories', ...new Set(catalog.map((book) => book.category || book.topic || 'Classics'))];
  const visible = catalog.filter((book) => {
    const state = bookAccessState(book, progress);
    const categoryMatches = category === 'All categories' || (book.category || book.topic || 'Classics') === category;
    const accessMatches = accessFilter === 'all' || (accessFilter === 'readable' && ['free', 'subscription', 'owned'].includes(state)) || state === accessFilter;
    return categoryMatches && accessMatches;
  });
  const selectedBook = visible.find((book) => book.id === selectedBookId) || visible[0] || null;
  const chapter = selectedBook?.chapterMetadata?.find((item) => item.id === selectedChapterId) || selectedBook?.chapterMetadata?.[0] || null;
  const chapterAccess = selectedBook && chapter ? chapterAccessState(selectedBook, chapter, progress) : 'locked';
  const chapterReady = hasInAppChapterContent(chapter);
  const quest = selectedBook && chapter ? exactChapterQuest(selectedBook, chapter, quests) : null;
  const quiz = selectedBook && chapter ? bookQuizzes.find((item) => item.bookId === selectedBook.id && item.chapterIds?.includes(chapter.id)) : null;
  const activityPayload = selectedBook && chapter ? bookActivities.find((item) => item.bookId === selectedBook.id && item.chapterIds?.includes(chapter.id)) : null;
  const accessLabel = (access) => ({ owned: 'Owned forever', free: 'Free access', subscription: 'Readable with Premium', 'purchase-only': 'Purchase required', locked: 'Locked' }[access] || access);

  const choose = (book) => {
    setSelectedBookId(book.id);
    setSelectedChapterId(book.chapterMetadata?.[0]?.id || '');
    setReader({ kind: 'idle', sentences: [], attribution: null });
    globalThis.window?.setTimeout(() => document.getElementById('selected-book-title')?.focus(), 0);
  };

  const toggleWishlist = async (bookId) => {
    const next = !progress.bookWishlistIds.includes(bookId);
    if (profileId) {
      try { await setRemoteBookWishlist(profileId, bookId, next); }
      catch { onStatus('Wishlist sync is unavailable; the book remains saved in this browser.'); }
    }
    onUpdate((current) => updateBookWishlist(current, bookId));
  };

  const buyBook = async () => {
    const offer = shopItems.find((item) => item.id === `shop-book-${selectedBook?.id}` || item.catalogId === selectedBook?.id);
    if (!selectedBook || !offer) {
      onStatus('A permanent purchase offer is not available for this title yet.');
      return;
    }
    try {
      const purchase = profileId ? await purchaseShopItem(profileId, offer.id) : null;
      onUpdate((current) => purchase
        ? { ...applyRemoteBalances(current, purchase), ownedBookIds: purchase.ownedBookIds || [...new Set([...current.ownedBookIds, selectedBook.id])] }
        : purchaseCatalogItem(current, { itemType: 'book', catalogId: selectedBook.id, price: offer.price, currency: offer.currency }));
      onStatus(`${selectedBook.title} is now permanently owned.`);
    } catch {
      onStatus(`Purchase unavailable. You need ${offer.price} ${offer.currency === 'diamonds' ? 'Diamonds' : 'Gold'}.`);
    }
  };

  const openReader = async () => {
    if (!selectedBook || !chapter) return;
    if (!profileId) {
      if (!['free', 'subscription', 'owned'].includes(chapterAccess)) {
        setReader({ kind: 'unavailable', message: `${accessLabel(chapterAccess)}. Change plan or purchase this title to continue.` });
        return;
      }
      if (!quest) {
        setReader({ kind: 'unavailable', message: 'This chapter has no reviewed offline passage available yet.' });
        return;
      }
      setReader({ kind: 'ready', sentences: sentencesFor(quest), attribution: selectedBook.requiredAttribution });
      return;
    }
    setReader({ kind: 'loading', sentences: [], attribution: null });
    try {
      const result = await loadChapterReference(profileId, selectedBook.id, chapter.id);
      const sentences = readableChapterSentences(result.content);
      if (!sentences.length) {
        setReader({ kind: 'unavailable', message: result.content?.reason || 'This approved chapter is not available in the reader yet.', attribution: result.attribution });
        return;
      }
      setReader({ kind: 'ready', sentences, attribution: result.attribution });
    } catch {
      setReader({ kind: 'error', message: 'Chapter loading failed. Your local reading and quest progress are preserved.' });
    }
  };

  if (reader.kind === 'ready' && selectedBook && chapter) {
    return <section className="in-app-reader" aria-labelledby="reader-title">
      <div className="reader-toolbar"><button className="secondary-button" type="button" onClick={() => setReader({ kind: 'idle', sentences: [], attribution: null })}>Back to {selectedBook.title}</button><span>In-app reading</span></div>
      <p className="eyebrow">{selectedBook.title} · {chapter.title}</p>
      <h1 id="reader-title">Read in LitLearn</h1>
      <p className="reader-attribution">{reader.attribution?.requiredAttribution || reader.attribution || selectedBook.requiredAttribution}</p>
      <article className="passage-card" aria-label={`${chapter.title} passage`}>{reader.sentences.map((sentence, index) => <p key={sentence.id || index}>{sentence.text}</p>)}</article>
      <ChapterActivityDeck book={selectedBook} chapter={chapter} quest={quest} quiz={quiz} activityPayload={activityPayload} sentences={reader.sentences} onLaunchQuest={(nextQuest) => { onUpdate((current) => markBookChapterRead(current, selectedBook.id, chapter.id)); onLaunchQuest(nextQuest); }} />
      <div className="button-row"><button className="primary-button" type="button" disabled={!quest} onClick={() => { onUpdate((current) => markBookChapterRead(current, selectedBook.id, chapter.id)); onLaunchQuest(quest); }}>{quest ? 'Start comprehension quest' : 'Quest mapping unavailable'}</button><button className="secondary-button" type="button" onClick={() => { onUpdate((current) => markBookChapterRead(current, selectedBook.id, chapter.id)); setReader({ kind: 'idle', sentences: [], attribution: null }); }}>Mark chapter read</button></div>
    </section>;
  }

  return <section className="feature-card platform-collection book-library" aria-labelledby="books-title">
    <div className="collection-hero"><div><p className="eyebrow">LitLearn library</p><h1 id="books-title">Books</h1><p>{catalog.length} approved catalog titles, grouped by category. Readable chapters stay inside LitLearn.</p></div><span className={`book-state is-${apiState.kind === 'ready' ? 'ready' : 'error'}`}>{apiState.kind === 'ready' ? 'Catalog synced' : 'Offline catalog'}</span></div>
    <div className="book-filters"><label htmlFor="book-category">Category<select id="book-category" value={category} onChange={(event) => { setCategory(event.target.value); setSelectedBookId(''); }}><option>All categories</option>{categories.slice(1).map((item) => <option key={item}>{item}</option>)}</select></label><label htmlFor="book-access">Access<select id="book-access" value={accessFilter} onChange={(event) => { setAccessFilter(event.target.value); setSelectedBookId(''); }}><option value="all">All access</option><option value="readable">Readable now</option><option value="subscription">Premium</option><option value="purchase-only">Purchase required</option></select></label></div>
    {visible.length ? <div className="book-library-layout">
      <section className="book-shelf" aria-label="Filtered approved book catalog">{visible.map((book) => <article key={book.id} className={`book-card ${book.id === selectedBook?.id ? 'is-selected' : ''}`}><span className={`book-state is-${bookAccessState(book, progress)}`}>{accessLabel(bookAccessState(book, progress))}</span><h2>{book.title}</h2><p>{book.author} · {book.category || book.topic}</p><button className="secondary-button" type="button" onClick={() => choose(book)}>Open book details</button><button className="text-button" type="button" onClick={() => toggleWishlist(book.id)}>{progress.bookWishlistIds.includes(book.id) ? '★ Remove from book wishlist' : '☆ Add to book wishlist'}</button></article>)}</section>
      {selectedBook && <section className="book-reader-workspace" aria-labelledby="selected-book-title">
        <div className="book-detail-header"><div><span className={`book-state is-${bookAccessState(selectedBook, progress)}`}>{accessLabel(bookAccessState(selectedBook, progress))}</span><h2 id="selected-book-title" tabIndex="-1">{selectedBook.title}</h2><p>{selectedBook.author} · {selectedBook.edition || 'Reviewed edition'}</p></div><button className="text-button" type="button" onClick={() => onNavigate('shop')}>Open in Shop</button></div>
        <p className="source-attribution"><strong>Source attribution:</strong> {selectedBook.requiredAttribution || 'Catalog attribution pending review.'}</p>
        <div className="chapter-list" aria-label={`${selectedBook.title} chapter navigation`}>{(selectedBook.chapterMetadata || []).map((item) => <button key={item.id} type="button" className={chapter?.id === item.id ? 'is-selected' : ''} onClick={() => { setSelectedChapterId(item.id); setReader({ kind: 'idle', sentences: [], attribution: null }); }}><strong>{item.title}</strong><small>{progress.bookReading[selectedBook.id]?.chapterIds?.includes(item.id) ? 'Read' : hasInAppChapterContent(item) ? accessLabel(chapterAccessState(selectedBook, item, progress)) : 'Unavailable in app'}</small></button>)}</div>
        {reader.kind === 'loading' ? <div className="source-reader-state is-loading" role="status">Loading the approved in-app chapter…</div> : reader.kind === 'error' || reader.kind === 'unavailable' ? <div className="source-reader-state is-unavailable" role="status"><h3>{chapter?.title}</h3><p>{reader.message}</p><button className="secondary-button" type="button" onClick={() => setReader({ kind: 'idle', sentences: [], attribution: null })}>Back to chapter list</button></div> : chapterReady ? <div className="source-reader-state is-ready"><h3>{chapter.title}</h3><p>{accessLabel(chapterAccess)} · approved text stays in LitLearn.</p><button className="primary-button" type="button" onClick={openReader}>{chapterAccess === 'locked' ? 'Premium required' : 'Read chapter in LitLearn'}</button></div> : <div className="source-reader-state is-unavailable"><h3>{chapter?.title || 'No chapter selected'}</h3><p>This chapter has no approved in-app text yet, so LitLearn keeps it unavailable instead of sending you elsewhere.</p></div>}
        {chapterAccess === 'purchase-only' && <button className="secondary-button" type="button" onClick={buyBook}>Buy permanently for {shopItems.find((item) => item.id === `shop-book-${selectedBook.id}`)?.price || selectedBook.priceDiamonds || 0} Diamonds</button>}
      </section>}
    </div> : <section className="book-empty-state"><h2>No books match those filters</h2><p>Change a category or access filter to explore another approved title.</p></section>}
  </section>;
}

function BookLibraryScreen({ progress, quests, apiState, catalogBooks, onUpdate, onStatus, onNavigate, onLaunchQuest }) {
  const [view, setView] = useState('library');
  const allBooks = useMemo(() => catalogBooks?.length ? catalogBooks : PLATFORM_CATALOG.books, [catalogBooks]);
  const [selectedBookId, setSelectedBookId] = useState(() => { try { return window.sessionStorage.getItem('litlab.bookFocus') || allBooks[0]?.id || ''; } catch { return allBooks[0]?.id || ''; } });
  const [selectedLevel, setSelectedLevel] = useState(1);
  const visibleBooks = view === 'library' ? libraryBooks(allBooks, progress) : allBooks;
  const selectedBook = visibleBooks.find((book) => book.id === selectedBookId) || visibleBooks[0] || null;
  const levels = selectedBook ? bookLevelNodes(selectedBook, quests, 10) : [];
  const selectedNode = levels.find((node) => node.level === selectedLevel) || levels[0] || null;
  const chapterAccess = selectedBook && selectedNode?.chapter ? chapterAccessState(selectedBook, selectedNode.chapter, progress) : 'locked';
  const reader = selectedBook ? sourceReaderState(selectedBook, selectedNode?.chapter, chapterAccess) : { kind: 'empty', message: 'Choose a book to view its reading path.' };
  const catalogStatus = apiState.kind === 'checking' ? { kind: 'loading', label: 'Checking the optional catalog service…' } : apiState.kind === 'ready' ? { kind: 'ready', label: 'Optional catalog service available; local reviewed catalog remains active.' } : { kind: 'error', label: 'Catalog service unavailable. Showing the bundled reviewed catalog instead.' };
  const chooseBook = (book) => { setSelectedBookId(book.id); setSelectedLevel(1); };
  const labelForAccess = (access) => ({ owned: 'Owned permanently', free: 'Free reading path', subscription: 'Premium reading', 'purchase-only': 'Purchase-only', locked: 'Locked' }[access] || access);
  const isWishlisted = (bookId) => progress.wishlistIds.includes(bookId);
  return <section className="feature-card platform-collection book-library" aria-labelledby="books-title">
    <div className="collection-hero"><div><p className="eyebrow">Web reading shelf</p><h1 id="books-title">Books</h1><p>{allBooks.length} titles across adventure, mystery, fantasy, nature, history, and classics. Open a verified chapter when it is available.</p></div><span className={`book-state is-${catalogStatus.kind}`}>{catalogStatus.kind === 'error' ? 'Offline fallback' : 'Local catalog ready'}</span></div>
    <p className={`book-catalog-status is-${catalogStatus.kind}`} role="status">{catalogStatus.label}</p>
    <div className="book-library-tabs" role="tablist" aria-label="Books view">
      <button type="button" role="tab" aria-selected={view === 'library'} className={view === 'library' ? 'is-selected' : ''} onClick={() => setView('library')}>Library</button>
      <button type="button" role="tab" aria-selected={view === 'catalog'} className={view === 'catalog' ? 'is-selected' : ''} onClick={() => setView('catalog')}>Catalog</button>
    </div>
    <p className="book-view-note">{view === 'library' ? 'Books you own, can sample for free, or can read with this browser’s Premium preview.' : 'All reviewed catalog entries and their available reading access.'}</p>
    {visibleBooks.length === 0 ? <section className="book-empty-state" aria-live="polite"><h2>Your Library is waiting</h2><p>No books are available through this membership yet. Browse the catalog or enable the local Premium preview to see eligible titles.</p><button className="secondary-button" type="button" onClick={() => setView('catalog')}>Browse catalog</button></section> : <div className="book-library-layout">
      <section className="book-shelf" aria-label={`${view === 'library' ? 'Library' : 'Catalog'} books`}>
        {visibleBooks.map((book) => { const access = bookAccessState(book, progress); const selected = book.id === selectedBook?.id; return <article className={`book-card ${selected ? 'is-selected' : ''}`} key={book.id}><span className={`book-state is-${access}`}>{labelForAccess(access)}</span><h2>{book.title}</h2><p>{book.author} · {book.category || book.topic}</p><p className="book-difficulty"><span aria-label={`${book.difficulty || 1} of 5 stars`}>{'★'.repeat(book.difficulty || 1)}{'☆'.repeat(5 - (book.difficulty || 1))}</span> {book.difficultyLabel || 'Explorer'}</p><button className="secondary-button" type="button" aria-pressed={selected} onClick={() => chooseBook(book)}>{selected ? 'Viewing path' : 'View reading path'}</button><button className="text-button" type="button" onClick={() => onUpdate((current) => toggleWishlist(current, book.id))}>{isWishlisted(book.id) ? '★ Wishlisted' : '☆ Add to wishlist'}</button></article>; })}
      </section>
      {selectedBook && <section className="book-reader-workspace" aria-labelledby="selected-book-title">
        <div className="book-detail-header"><div><span className={`book-state is-${bookAccessState(selectedBook, progress)}`}>{labelForAccess(bookAccessState(selectedBook, progress))}</span><h2 id="selected-book-title">{selectedBook.title}</h2><p>{selectedBook.author} · {selectedBook.edition || 'Reviewed edition'}</p></div><button className="text-button" type="button" onClick={() => onNavigate('shop')}>Book options in Shop</button></div>
        <p className="source-attribution"><strong>Source attribution:</strong> {selectedBook.requiredAttribution || 'Catalog attribution pending review.'} {selectedBook.license && <span> {selectedBook.license}</span>}</p>
        <ol className="book-level-map" aria-label={`${selectedBook.title} reading levels, left to right`}>{levels.map((node) => { const nodeAccess = node.chapter ? chapterAccessState(selectedBook, node.chapter, progress) : 'locked'; const nodeSelected = node.level === selectedNode?.level; return <li className={`${nodeSelected ? 'is-selected' : ''} is-${nodeAccess}`} key={node.id}><button className="book-level-node" type="button" aria-pressed={nodeSelected} onClick={() => setSelectedLevel(node.level)}><span>Level {node.level}</span><strong>{node.chapter?.title || 'Awaiting reviewed map'}</strong><small>{node.chapter ? labelForAccess(nodeAccess) : 'Catalog mapping needed'}</small></button></li>; })}</ol>
        <section className={`source-reader-state is-${reader.kind}`} aria-live="polite"><p className="eyebrow">Selected level {selectedNode?.level || 1}</p><h3>{selectedNode?.chapter?.title || 'No reviewed chapter yet'}</h3><p>{reader.message}</p>{selectedNode?.quest ? <button className="primary-button" type="button" onClick={() => onLaunchQuest(selectedNode.quest)}>Start comprehension quest</button> : selectedNode?.chapter && <p className="quest-unavailable">No reviewed comprehension quest is mapped to this exact chapter yet.</p>}{chapterAccess === 'purchase-only' && <button className="secondary-button" type="button" onClick={() => onNavigate('shop')}>Find purchase option in Shop</button>}</section>
      </section>}
    </div>}
    <section className="plan-grid"><article><h2>Free membership</h2><p>Free chapters can support the early reading path. Levels without a reviewed chapter stay clearly unavailable.</p><button className={progress.subscriptionPlan === 'free' ? 'equipped-reward' : 'secondary-button'} type="button" onClick={() => onUpdate((current) => setSubscriptionPlan(current, 'free'))}>{progress.subscriptionPlan === 'free' ? 'Current plan' : 'Choose free'}</button></article><article className="is-premium"><h2>Premium membership</h2><p>Eligible titles and chapters open in this local preview. Purchase-only titles remain separate.</p><button className={progress.subscriptionPlan === 'premium' ? 'equipped-reward' : 'primary-button'} type="button" onClick={() => { onUpdate((current) => setSubscriptionPlan(current, 'premium')); onStatus('Premium preview enabled locally. No payment was processed.'); }}>{progress.subscriptionPlan === 'premium' ? 'Premium active' : 'Try Premium preview'}</button></article></section>
  </section>;
}

function RecommendedBookCard({ onNavigate, catalogBooks, recommendations }) {
  const catalog = catalogBooks?.length ? catalogBooks : PLATFORM_CATALOG.books;
  const book = catalog.find((item) => item.id === recommendations?.[0]?.bookId) || catalog[0];
  return <section className="recommended-book-card" aria-labelledby="recommended-book-title"><div><p className="eyebrow">Recommended book</p><h2 id="recommended-book-title">{book.title}</h2><p>{book.author} · {book.category || book.topic} · {'★'.repeat(book.difficulty || 1)}{'☆'.repeat(5 - (book.difficulty || 1))}</p></div><button className="primary-button" type="button" onClick={() => { try { window.sessionStorage.setItem('litlab.bookFocus', book.id); } catch { /* optional convenience only */ } onNavigate('books'); }}>Open book <span aria-hidden="true">→</span></button></section>;
}

function LegacyProfileScreen({ progress, profileId, onNavigate, onUpdate, onStatus }) {
  const [selected, setSelected] = useState(null);
  const level = levelForXp(progress.xp);
  const current = xpIntoLevel(progress.xp);
  const required = xpForNextLevel(progress.xp);
  const percent = required ? Math.round((current / required) * 100) : 100;
  const collection = [
    ...PLATFORM_CATALOG.achievements.map((item) => ({ ...item, type: 'Achievement', earned: progress.completedQuestIds.length > 0, how: 'Complete a reviewed reading quest.' })),
    ...PLATFORM_CATALOG.badges.map((item) => ({ ...item, type: 'Badge', earned: progress.badgeIds.includes(item.id) || progress.badgeIds.length > 0, how: item.description })),
    ...PLATFORM_CATALOG.trophies.map((item) => ({ ...item, type: 'Trophy', earned: level >= 2, how: item.description })),
    ...progress.wishlistIds.map((id) => ({ id, title: id.replaceAll('-', ' '), description: 'Saved in your local wishlist.', type: 'Wishlist', earned: false, how: 'Open its matching Books, Pets, or Shop card to acquire it.' })),
  ];
  const selectedItem = collection.find((item) => item.id === selected) || null;
  const redeem = async () => {
    if (progress.inventory.wishlistPages < 5 || !progress.wishlistIds.length) {
      onStatus('You need five Wishlist Pages and at least one eligible wishlisted book.');
      return;
    }
    if (!window.confirm('Spend 5 Wishlist Pages for one random eligible book from your wishlist? The selected book will be permanently owned after a successful claim.')) return;
    if (profileId) {
      try {
        const result = await redeemWishlistPagesRemote(profileId);
        onUpdate((current) => ({ ...applyRemoteBalances(current, result), ownedBookIds: [...new Set([...current.ownedBookIds, result.selectedBookId])] }));
        onStatus(`${result.selectedBookId.replaceAll('-', ' ')} is now owned forever.`);
      } catch { onStatus('The synced claim could not be completed, so no Wishlist Pages were spent.'); }
      return;
    }
    const result = redeemWishlistPages(progress, progress.wishlistIds);
    if (!result.selectedBookId) { onStatus('The claim could not be completed, so no Wishlist Pages were spent.'); return; }
    onUpdate(() => result.progress);
    onStatus(`${result.selectedBookId.replaceAll('-', ' ')} is now owned forever.`);
  };
  return <section className="feature-card platform-collection profile-v2" aria-labelledby="profile-title"><div className="profile-v2-hero"><div className="xp-avatar" style={{ '--xp-fill': `${percent * 3.6}deg` }} aria-label={`Level ${level}, ${current} of ${required || current} XP toward the next level`}><span>{progress.profileName.slice(0, 1).toUpperCase()}</span></div><div><p className="eyebrow">Reader profile</p><h1 id="profile-title">{progress.profileName}</h1><p>Level {level} · {current}/{required || current} XP toward the next level</p></div></div><div className="wallet-row" aria-label="Wallet"><button type="button" onClick={() => onNavigate('shop', { shopSection: 'gold' })}>🪙 <strong>{progress.currencies.gold}</strong> Gold <span aria-hidden="true">+</span></button><button type="button" onClick={() => onNavigate('shop', { shopSection: 'diamonds' })}>💎 <strong>{progress.currencies.diamonds}</strong> Diamonds <span aria-hidden="true">+</span></button><span className="wishlist-page-chip">📜 {progress.inventory.wishlistPages} Wishlist Pages</span></div><section className="xp-breakdown" aria-labelledby="xp-breakdown-title"><h2 id="xp-breakdown-title">Latest XP breakdown</h2><p>Correct answers +{progress.lastXpBreakdown?.answers || 0} · evidence reasoning +{progress.lastXpBreakdown?.evidence || 0} · quality +{progress.lastXpBreakdown?.reasoning || 0}. Incorrect or unanswered questions earn 0 XP.</p></section><section className="wishlist-redemption"><h2>Wishlist Page draw</h2><p>Spend five Wishlist Pages to receive one random eligible book from your wishlist permanently. The selected title is shown only after the claim succeeds.</p><button className="secondary-button" type="button" disabled={progress.inventory.wishlistPages < 5 || !progress.wishlistIds.length} onClick={redeem}>Use 5 Wishlist Pages</button></section><section className="interactive-collection"><h2>Collection journal</h2>{collection.length ? <div className="collection-list">{collection.map((item) => <button type="button" key={`${item.type}-${item.id}`} className={selected === item.id ? 'is-selected' : ''} onClick={() => setSelected(item.id)}>✦ {item.title} <small>{item.earned ? 'Earned' : item.type === 'Wishlist' ? 'Saved' : 'Locked'}</small></button>)}</div> : <p className="empty-summary">No keepsakes yet—your first quest will add one.</p>}{selectedItem && <article className="collection-detail" role="status"><p className="eyebrow">{selectedItem.type} · {selectedItem.earned ? 'Earned' : 'Not yet earned'}</p><h3>{selectedItem.title}</h3><p>{selectedItem.description}</p><p><strong>How to get it:</strong> {selectedItem.how}</p></article>}</section></section>;
}

function ProfileScreen({ progress, profileId, catalogBooks = [], onNavigate, onUpdate, onStatus }) {
  const [selected, setSelected] = useState(null);
  const level = levelForXp(progress.xp);
  const current = xpIntoLevel(progress.xp);
  const required = xpForNextLevel(progress.xp);
  const percent = required ? Math.round((current / required) * 100) : 100;
  const books = catalogBooks.length ? catalogBooks : PLATFORM_CATALOG.books;
  const bookWishlist = progress.bookWishlistIds.map((id) => books.find((book) => book.id === id) || { id, title: id.replaceAll('-', ' '), author: 'Catalog title' });
  const removeBook = async (bookId) => {
    if (profileId) {
      try { await setRemoteBookWishlist(profileId, bookId, false); }
      catch { onStatus('The wishlist could not sync, but it was removed from this browser.'); }
    }
    onUpdate((state) => updateBookWishlist(state, bookId));
  };
  const redeem = async () => {
    if (progress.inventory.wishlistPages < 5 || !progress.bookWishlistIds.length) { onStatus('You need five Wishlist Pages and one unowned book in your book wishlist.'); return; }
    if (!window.confirm('Spend 5 Wishlist Pages for one random eligible book from your book wishlist? The selected book will be permanently owned after a successful claim.')) return;
    if (profileId) {
      try {
        const result = await redeemWishlistPagesRemote(profileId);
        onUpdate((state) => ({ ...applyRemoteBalances(state, result), ownedBookIds: [...new Set([...state.ownedBookIds, result.selectedBookId])] }));
        onStatus(`${result.selectedBookId.replaceAll('-', ' ')} is now owned forever.`);
      } catch { onStatus('The synced claim could not be completed, so no Wishlist Pages were spent.'); }
      return;
    }
    const result = redeemWishlistPages(progress, progress.bookWishlistIds);
    if (!result.selectedBookId) { onStatus('The claim could not be completed, so no Wishlist Pages were spent.'); return; }
    onUpdate(() => result.progress);
    onStatus(`${result.selectedBookId.replaceAll('-', ' ')} is now owned forever.`);
  };
  return <section className="feature-card platform-collection profile-v2" aria-labelledby="profile-title"><div className="profile-v2-hero"><div className="xp-avatar" style={{ '--xp-fill': `${percent * 3.6}deg` }} aria-label={`Level ${level}, ${current} of ${required || current} XP toward the next level`}><span>{progress.profileName.slice(0, 1).toUpperCase()}</span></div><div><p className="eyebrow">Reader profile</p><h1 id="profile-title">{progress.profileName}</h1><p>Level {level} · {current}/{required || current} XP toward the next level</p></div></div><div className="wallet-row" aria-label="Wallet"><button type="button" onClick={() => onNavigate('shop')}><strong>{progress.currencies.gold}</strong> Gold</button><button type="button" onClick={() => onNavigate('shop')}><strong>{progress.currencies.diamonds}</strong> Diamonds</button><span className="wishlist-page-chip">{progress.inventory.wishlistPages} Wishlist Pages</span></div><section className="wishlist-redemption"><h2>Book wishlist</h2><p>Saved books are separate from pet and accessory wishes. Spend five Wishlist Pages to receive one eligible saved book permanently.</p>{bookWishlist.length ? <div className="collection-list">{bookWishlist.map((book) => <article key={book.id}><strong>{book.title}</strong><small>{book.author}</small><button className="text-button" type="button" onClick={() => removeBook(book.id)}>Remove from wishlist</button></article>)}</div> : <p className="empty-summary">No books saved yet. Browse the catalog to add one.</p>}<div className="button-row"><button className="secondary-button" type="button" onClick={() => onNavigate('books')}>Browse catalog</button><button className="primary-button" type="button" disabled={progress.inventory.wishlistPages < 5 || !progress.bookWishlistIds.length} onClick={redeem}>Use 5 Wishlist Pages</button></div></section><section className="interactive-collection"><h2>Progress collection</h2><div className="profile-progress"><article><span>Quests complete</span><strong>{progress.completedQuestIds.length}</strong><small>{progress.storyFragmentIds.length} story fragments</small></article><article><span>General wishlist</span><strong>{progress.wishlistIds.length}</strong><small>Pets and accessories remain separate from saved books.</small></article></div>{selected && <p role="status">{selected}</p>}<button className="text-button" type="button" onClick={() => setSelected(`Level ${level} reader profile`)}>View profile status</button></section></section>;
}

function LegacyPetCollectionScreen({ progress, onUpdate, onStatus }) {
  const level = levelForXp(progress.xp);
  const starterPets = PLATFORM_CATALOG.pets.filter((pet) => pet.availability === 'starter');
  return <section className="feature-card platform-collection" aria-labelledby="pets-title"><div className="collection-hero"><div><p className="eyebrow">Companion milestones</p><h1 id="pets-title">Pets</h1><p>Companions unlock on the Level Road. Unlock one to name, equip, and customize it.</p></div></div><div className="pet-grid">{starterPets.map((pet) => { const milestone = PET_LEVEL_MILESTONES.find((item) => item.petId === pet.id); const owned = progress.ownedPetIds.includes(pet.id); const active = progress.activePetId === pet.id; return <article className={`pet-card ${active ? 'is-active' : ''}`} key={pet.id}><PetAvatar pet={pet} nickname={progress.petNicknames[pet.id]} /><span className="rarity-chip" style={{ color: RARITY_COLORS[pet.rarity] }}>{owned ? pet.rarity : `Unlocks at level ${milestone?.level || '—'}`}</span><h2>{progress.petNicknames[pet.id] || pet.name}</h2><p>{owned ? pet.description : `Locked until Level ${milestone?.level || '—'}. You are currently Level ${level}.`}</p><button className="secondary-button" type="button" disabled={!owned || active} onClick={() => { onUpdate((current) => equipPet(current, pet.id)); onStatus(`${pet.name} is now your active companion.`); }}>{active ? 'Active companion' : owned ? 'Choose pet' : 'Locked'}</button></article>; })}</div></section>;
}

function PetCollectionScreen({ progress, petCatalog, onUpdate, onStatus }) {
  const [nameDrafts, setNameDrafts] = useState({});
  const level = levelForXp(progress.xp);
  const starterPets = PLATFORM_CATALOG.pets.filter((pet) => pet.starterClaim).slice(0, 6);
  return (
    <section className="feature-card platform-collection" aria-labelledby="pets-title">
      <div className="collection-hero"><div><p className="eyebrow">Companion collection</p><h1 id="pets-title">Pets</h1><p>Every companion starts locked. Level Road milestones unlock naming, equipping, and accessories.</p></div></div>
      <div className="pet-grid">
        {starterPets.map((pet) => {
          const serverPet = petCatalog?.find((item) => item.id === pet.id);
          const milestone = { petId: pet.id, level: serverPet?.unlockLevel ?? PET_LEVEL_MILESTONES.find((item) => item.petId === pet.id)?.level };
          const owned = progress.ownedPetIds.includes(pet.id);
          const active = progress.activePetId === pet.id;
          const draft = nameDrafts[pet.id] ?? progress.petNicknames[pet.id] ?? '';
          const accessoryCount = owned ? Object.keys(progress.equippedAccessories).length : 0;
          return <article className={`pet-card ${active ? 'is-active' : ''} ${owned ? 'is-unlocked' : 'is-locked'}`} key={pet.id}>
            <PetAvatar pet={pet} nickname={progress.petNicknames[pet.id]} />
            <span className="rarity-chip" style={{ color: RARITY_COLORS[pet.rarity] }}>{pet.rarity}</span>
            <h2>{progress.petNicknames[pet.id] || pet.name}</h2>
            <p>{owned ? `${active ? 'Active' : 'Unlocked'} · ${accessoryCount ? `${accessoryCount} accessory slots equipped` : 'Ready to customize'}.` : `Locked · unlocks at Level ${milestone?.level || '—'} (you are Level ${level}).`}</p>
            <button className="secondary-button" type="button" disabled={!owned || active} onClick={() => { onUpdate((current) => equipPet(current, pet.id)); onStatus(`${pet.name} is now your active companion.`); }}>{active ? 'Active companion' : owned ? 'Make active' : `Reach Level ${milestone?.level || '—'}`}</button>
            {owned && <label className="pet-name-row">Name <input aria-label={`Name ${pet.name}`} value={draft} maxLength="24" onChange={(event) => setNameDrafts((current) => ({ ...current, [pet.id]: event.target.value }))} /><button className="text-button" type="button" onClick={() => { onUpdate((current) => namePet(current, pet.id, draft)); setNameDrafts((current) => ({ ...current, [pet.id]: '' })); onStatus(`${pet.name} has a new name.`); }}>Save name</button></label>}
          </article>;
        })}
      </div>
      <p className="placeholder-note">Storybook pet art is coming later. These accessible illustrated placeholders preserve each pet’s lock, rarity, active, and customizable states.</p>
    </section>
  );
}

function ReadingPlanControl({ progress, onUpdate, onStatus }) {
  return <section className="reading-plan-control" aria-label="Reading plan access"><div><p className="eyebrow">Reader access</p><h2>{progress.subscriptionPlan === 'premium' ? 'Premium plan active' : 'Free plan active'}</h2><p>Changing the local demo plan immediately rechecks book and chapter access. Reading progress stays saved.</p></div><div className="button-row"><button className="secondary-button" type="button" aria-pressed={progress.subscriptionPlan === 'free'} onClick={() => { onUpdate((current) => setSubscriptionPlan(current, 'free')); onStatus('Free plan active. Your reading progress was preserved.'); }}>Use Free</button><button className="primary-button" type="button" aria-pressed={progress.subscriptionPlan === 'premium'} onClick={() => { onUpdate((current) => setSubscriptionPlan(current, 'premium')); onStatus('Premium preview active. Your reading progress was preserved.'); }}>Preview Premium</button></div></section>;
}

function PlatformCollection({ section, progress, quests, apiState, catalogBooks, bookQuizzes, bookActivities, shopItems, profileId, onUpdate, onStatus, onNavigate, onLaunchQuest }) {
  if (section === 'books') return <><ReadingPlanControl progress={progress} onUpdate={onUpdate} onStatus={onStatus} /><InAppBookLibraryScreen progress={progress} quests={quests} apiState={apiState} catalogBooks={catalogBooks} bookQuizzes={bookQuizzes} bookActivities={bookActivities} shopItems={shopItems} profileId={profileId} onUpdate={onUpdate} onStatus={onStatus} onNavigate={onNavigate} onLaunchQuest={onLaunchQuest} /></>;
  const [nameDrafts, setNameDrafts] = useState({});
  const [selectedPassStop, setSelectedPassStop] = useState(PASS_STOPS[0].id);
  const activePet = petById(progress.activePetId) || PLATFORM_CATALOG.pets[0];
  const activeAccessoryId = Object.values(progress.equippedAccessories).at(-1);
  const starterPets = PLATFORM_CATALOG.pets.filter((pet) => pet.availability === 'starter');
  const mythicalPets = PLATFORM_CATALOG.pets.filter((pet) => pet.eventOnly);
  const selectedStop = PASS_STOPS.find((stop) => stop.id === selectedPassStop) || PASS_STOPS[0];
  const selectedReward = selectedStop.rewardId ? rewardById(selectedStop.rewardId) : null;
  const bookOffers = PLATFORM_CATALOG.shopItems.filter((item) => item.itemType === 'book').map((item) => {
    const book = PLATFORM_CATALOG.books.find((candidate) => candidate.id === item.catalogId);
    return { ...item, label: book?.title || item.catalogId.replaceAll('-', ' '), category: 'Books', premium: book?.accessTier === 'premium' };
  });
  const accessoryOffers = PLATFORM_CATALOG.shopItems.filter((item) => item.itemType !== 'egg').map((item) => ({ ...item, label: item.catalogId.replaceAll('-', ' '), category: item.catalogId.includes('scarf') ? 'Pet clothing' : 'Pet accessories' }));
  const eggOffers = PLATFORM_CATALOG.shopItems.filter((item) => item.itemType === 'egg').map((item) => ({ ...item, label: item.catalogId.replaceAll('-', ' '), category: 'Eggs' }));
  const buy = (item) => {
    if (item.grant) {
      onUpdate((current) => grantDemoCurrency(current, item.grant.currency, item.grant.amount));
      onStatus(`${item.label} added to this browser demo.`);
      return;
    }
    const alreadyOwned = item.itemType === 'book' && progress.ownedBookIds.includes(item.catalogId);
    if (alreadyOwned) return;
    if (item.premium && progress.subscriptionPlan !== 'premium') {
      onStatus('This book is Premium-locked. Try the local Premium preview first.');
      return;
    }
    const balance = Number(progress.currencies[item.currency]) || 0;
    if (balance < item.price) { onStatus(`Not enough ${displayCurrency(item.currency)} for ${item.label}. Keep reading to earn more.`); return; }
    onUpdate((current) => purchaseCatalogItem(current, item));
    onStatus(`${item.label} was added to this local demo collection.`);
  };
  const wishlist = (id) => onUpdate((current) => toggleWishlist(current, id));
  const ShopCard = ({ item }) => {
    const owned = item.itemType === 'book' && progress.ownedBookIds.includes(item.catalogId);
    const premiumLocked = item.premium && progress.subscriptionPlan !== 'premium';
    return <article className="shop-product" key={item.id}><span className="eyebrow">{item.category}</span><h3>{item.label}</h3><p>{item.grant ? `Local demo bundle · +${item.grant.amount} ${displayCurrency(item.grant.currency)}` : owned ? 'Owned in this browser' : premiumLocked ? 'Premium-locked' : item.price === 0 ? 'Free demo' : `${item.price} ${displayCurrency(item.currency)}`}</p><button className="secondary-button" type="button" disabled={owned} onClick={() => buy(item)}>{owned ? 'Owned' : premiumLocked ? 'Premium required' : item.grant ? 'Add demo bundle' : item.price === 0 ? 'Add free demo' : 'Buy locally'}</button><button className="text-button" type="button" onClick={() => wishlist(item.catalogId)}>{progress.wishlistIds.includes(item.catalogId) ? '★ Wishlisted' : '☆ Add to wishlist'}</button></article>;
  };
  if (section === 'profile') return <section className="feature-card platform-collection" aria-labelledby="profile-title"><div className="collection-hero"><div><p className="eyebrow">Reader profile</p><h1 id="profile-title">{progress.profileName}</h1><p>Level {levelForXp(progress.xp)} · {progress.xp} XP · {progress.completedQuestIds.length} quests completed</p></div><div className="profile-medallion" aria-hidden="true">✦</div></div><div className="profile-progress"><article><span>Reading progress</span><strong>{progress.completedQuestIds.length} quests</strong><small>{progress.storyFragmentIds.length} story fragments · {progress.streak.current} day streak</small></article><article><span>Evidence practice</span><strong>{progress.signals.evidenceReveals} reveals</strong><small>{progress.responses.length} local responses reviewed</small></article></div><div className="profile-grid"><article><h2>Achievements</h2>{PLATFORM_CATALOG.achievements.map((item) => <p key={item.id}>✦ {item.title}<small>{item.description}</small></p>)}</article><article><h2>Badges &amp; trophies</h2>{[...PLATFORM_CATALOG.badges, ...PLATFORM_CATALOG.trophies].map((item) => <p key={item.id}>🏅 {item.title}<small>{item.description}</small></p>)}</article><article><h2>Wishlist</h2>{progress.wishlistIds.length ? progress.wishlistIds.map((id) => <p key={id}>♡ {id.replaceAll('-', ' ')}</p>) : <p>Your wishlist is empty. Add books, companions, or accessories from their own pages.</p>}</article></div></section>;
  if (section === 'pets') return <section className="feature-card platform-collection" aria-labelledby="pets-title"><div className="collection-hero"><div><p className="eyebrow">Your companion collection</p><h1 id="pets-title">Dress a story friend</h1><p>Six starter companions are free. Name one, make it active, and equip accessories earned on your routes.</p><p className="placeholder-note">Storybook art is coming later; these accessible in-app companions are temporary placeholders.</p></div><PetAvatar pet={activePet} nickname={progress.petNicknames[activePet.id]} accessoryId={activeAccessoryId} /></div><div className="pet-grid">{starterPets.map((pet) => { const active = progress.activePetId === pet.id; const favorite = progress.favoritePetIds.includes(pet.id); const draftName = nameDrafts[pet.id] ?? progress.petNicknames[pet.id] ?? ''; return <article className={`pet-card ${active ? 'is-active' : ''}`} key={pet.id}><PetAvatar pet={pet} nickname={progress.petNicknames[pet.id]} accessoryId={active ? activeAccessoryId : undefined} /><button className="icon-button pet-favorite" type="button" aria-label={`${favorite ? 'Remove' : 'Add'} ${pet.name} ${favorite ? 'from' : 'to'} favorites`} aria-pressed={favorite} onClick={() => onUpdate((current) => toggleFavoritePet(current, pet.id))}>{favorite ? '★' : '☆'}</button><span className="rarity-chip" style={{ color: RARITY_COLORS[pet.rarity] }}>{pet.rarity}</span><h2>{progress.petNicknames[pet.id] || pet.name}</h2><p>{pet.description}</p><button className="secondary-button" type="button" disabled={active} onClick={() => onUpdate((current) => equipPet(current, pet.id))}>{active ? 'Active companion' : 'Choose pet'}</button><div className="pet-name-row"><input aria-label={`Name ${pet.name}`} value={draftName} placeholder="Name your pet" onChange={(event) => setNameDrafts((current) => ({ ...current, [pet.id]: event.target.value }))} /><button className="text-button" type="button" onClick={() => { onUpdate((current) => namePet(current, pet.id, draftName)); setNameDrafts((current) => ({ ...current, [pet.id]: '' })); onStatus(`${pet.name} has a new name.`); }}>Save</button></div></article>; })}</div><section className="event-pets"><h2>Event companions</h2>{mythicalPets.map((pet) => <p key={pet.id}><strong>{pet.name}</strong> · Mythical · Event-only. It cannot be purchased in this local demo.</p>)}</section><h2>Accessory wardrobe</h2><div className="accessory-grid">{PLATFORM_CATALOG.accessories.map((item) => { const owned = progress.ownedAccessoryIds.includes(item.id); return <button type="button" className={progress.equippedAccessories[item.category] === item.id ? 'is-equipped' : ''} key={item.id} disabled={!owned} onClick={() => onUpdate((current) => equipPetAccessory(current, item.category, item.id))}>{item.id.replaceAll('-', ' ')} · {item.category}{owned ? ' · Equip' : ' · Locked'}</button>; })}</div></section>;
  if (section === 'shop') return <section className="feature-card platform-collection" aria-labelledby="shop-title"><div className="collection-hero"><div><p className="eyebrow">Local demo store</p><h1 id="shop-title">Story shop</h1><p>Every purchase stays in this browser. No money, account, or payment is used.</p></div><div className="currency-bar"><span>🪙 {progress.currencies.gold ?? progress.currencies.leafTokens} Gold</span><span>💎 {progress.currencies.diamonds ?? progress.currencies.storyShards} Diamonds</span></div></div><section className="shop-section"><h2>Gold &amp; Diamonds</h2><div className="shop-grid"><ShopCard item={{ id: 'demo-gold', label: 'Gold starter bundle', category: 'Gold', grant: { currency: 'gold', amount: 40 } }} /><ShopCard item={{ id: 'demo-diamonds', label: 'Diamond starter bundle', category: 'Diamonds', grant: { currency: 'diamonds', amount: 10 } }} /></div></section><section className="shop-section"><h2>Books</h2>{bookOffers.length ? <div className="shop-grid">{bookOffers.map((item) => <ShopCard key={item.id} item={item} />)}</div> : <div className="book-empty-state"><h3>No reviewed book offers yet</h3><p>The catalog currently has reading access metadata but no reviewed book shop items. Browse Books while purchase offers are added to the shared contract.</p><button className="secondary-button" type="button" onClick={() => onNavigate('books')}>Browse Books</button></div>}</section><section className="shop-section"><h2>Pet clothing &amp; accessories</h2><div className="shop-grid">{accessoryOffers.map((item) => <ShopCard key={item.id} item={item} />)}</div></section><section className="shop-section"><h2>Eggs</h2>{PLATFORM_CATALOG.eggs.map((egg) => <article className="egg-panel" key={egg.id}><div><span className="eyebrow">Deterministic local demo</span><h3>{egg.id.replaceAll('-', ' ')}</h3><p>{egg.rarityRange.map((rarity) => `${rarity} ${Math.round(egg.odds[rarity] * 100)}%`).join(' · ')}</p><small>Duplicates become {egg.duplicateBehavior.quantity} Diamonds.</small></div><button className="secondary-button" type="button" disabled={!progress.ownedEggIds.includes(egg.id)} onClick={() => { onUpdate((current) => openCatalogEgg(current, egg)); onStatus('Egg opened. The local reward was added to your collection.'); }}>{progress.ownedEggIds.includes(egg.id) ? 'Open egg' : 'Buy from the list'}</button></article>)}<div className="shop-grid">{eggOffers.map((item) => <ShopCard key={item.id} item={item} />)}</div></section></section>;
  if (section === 'pass') return <section className="feature-card platform-collection" aria-labelledby="pass-title"><div className="collection-hero"><div><p className="eyebrow">Monthly reward route · November 2026</p><h1 id="pass-title">{PASS_PRODUCT_NAME}</h1><p>One seasonal route with a Free track and an optional Premium track. It is separate from membership plan names.</p></div><span className="road-level">{progress.xp} XP</span></div><ol className="pass-road-list" aria-label={`${PASS_PRODUCT_NAME} reward path`}>{PASS_STOPS.map((stop, index) => { const unlocked = progress.xp >= stop.requiredXp; const reward = stop.rewardId ? rewardById(stop.rewardId) : null; const claimed = reward && progress.claimedRewardIds.includes(reward.id); const premiumLocked = stop.premium && progress.subscriptionPlan !== 'premium'; return <li key={stop.id} className={`${selectedPassStop === stop.id ? 'is-selected' : ''} ${unlocked ? 'is-unlocked' : ''} ${stop.premium ? 'is-premium' : ''}`}><button className="road-stop-button" type="button" aria-pressed={selectedPassStop === stop.id} onClick={() => setSelectedPassStop(stop.id)}><span className="road-node" aria-hidden="true">{unlocked ? '✦' : index + 1}</span><span><small>{stop.track}</small><strong>{stop.title}</strong></span></button><span className="road-status">{premiumLocked ? 'Premium track' : claimed ? 'Collected' : unlocked ? 'Ready' : `${stop.requiredXp} XP`}</span></li>; })}</ol><div className="road-reward-pop" role="status" aria-live="polite"><div className="reward-pop-art" aria-hidden="true">{selectedStop.art}</div><div><p className="eyebrow">{selectedStop.track} · {selectedStop.requiredXp} XP</p><h2>{selectedStop.title}</h2><p>{selectedStop.detail}</p>{selectedReward && <button className="secondary-button" type="button" disabled={progress.xp < selectedStop.requiredXp || progress.claimedRewardIds.includes(selectedReward.id) || (selectedStop.premium && progress.subscriptionPlan !== 'premium')} onClick={() => onUpdate((current) => claimCatalogReward(current, selectedReward))}>{selectedStop.premium && progress.subscriptionPlan !== 'premium' ? 'Premium track required' : progress.claimedRewardIds.includes(selectedReward.id) ? 'Collected' : progress.xp >= selectedStop.requiredXp ? 'Claim local reward' : 'Keep reading'}</button>}</div></div></section>;
  return <section className="feature-card platform-collection" aria-labelledby="books-title"><div className="collection-hero"><div><p className="eyebrow">Your reading shelf</p><h1 id="books-title">Books</h1><p>Browse the full catalog. Purchase options remain in Story Shop.</p></div></div><div className="book-grid">{PLATFORM_CATALOG.books.map((book) => { const owned = progress.ownedBookIds.includes(book.id); const status = owned ? 'Owned' : book.accessTier === 'free-demo' ? 'Free demo' : progress.subscriptionPlan === 'premium' ? 'Available to buy' : 'Premium-locked'; return <article className="book-card" key={book.id}><span className={`book-state is-${status.toLowerCase().replaceAll(' ', '-')}`}>{status}</span><h2>{book.title}</h2><p>{book.author} · {book.topic}</p><p>{book.chapterMetadata.map((chapter) => `${chapter.title} (${chapter.accessTier})`).join(' · ')}</p>{book.accessTier === 'premium' && !owned && <button className="secondary-button" type="button" onClick={() => onNavigate('shop')}>View purchase in Shop</button>}<button className="text-button" type="button" onClick={() => wishlist(book.id)}>{progress.wishlistIds.includes(book.id) ? '★ Wishlisted' : '☆ Add to wishlist'}</button></article>; })}</div><section className="plan-grid"><article><h2>Free membership</h2><p>Demo chapters and local practice.</p><button className={progress.subscriptionPlan === 'free' ? 'equipped-reward' : 'secondary-button'} type="button" onClick={() => onUpdate((current) => setSubscriptionPlan(current, 'free'))}>{progress.subscriptionPlan === 'free' ? 'Current plan' : 'Choose free'}</button></article><article className="is-premium"><h2>Premium membership</h2><p>Unlocks the Premium shelf in this browser demo. No payment is processed.</p><button className={progress.subscriptionPlan === 'premium' ? 'equipped-reward' : 'primary-button'} type="button" onClick={() => { onUpdate((current) => setSubscriptionPlan(current, 'premium')); onStatus('Premium preview enabled locally. No payment was processed.'); }}>{progress.subscriptionPlan === 'premium' ? 'Premium active' : 'Try Premium preview'}</button></article></section></section>;
}

function FeatureLab({ progress, quests, onStatus, onSetting, onUpdate }) {
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
  const [libraryEnhancement, setLibraryEnhancement] = useState({ kind: 'loading', books: [], recommendations: [] });
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
      .then((data) => {
        setApiState({ kind: 'ready', label: data.status || 'Optional API available' });
        loadLibraryEnhancement().then((library) => {
          setLibraryEnhancement({ kind: 'ready', ...library });
          setProgress((current) => ({
            ...applyRemoteBalances(current, library),
            ownedPetIds: library.profile?.ownedPetIds || current.ownedPetIds,
            activePetId: library.profile?.activePetId || current.activePetId,
            petNicknames: library.profile?.petNicknames || current.petNicknames,
            ownedBookIds: library.profile?.ownedBookIds || current.ownedBookIds,
            bookWishlistIds: library.bookWishlistIds || library.profile?.bookWishlistIds || current.bookWishlistIds,
          }));
        }).catch(() => setLibraryEnhancement({ kind: 'error', books: [], recommendations: [] }));
      })
      .catch((error) => { if (error.name !== 'AbortError') { setApiState({ kind: 'offline', label: 'Offline demo mode — reviewed local quests are ready.' }); setLibraryEnhancement({ kind: 'offline', books: [], recommendations: [] }); } })
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
    const reasoningQuality = questResponses.filter((response) => response.answerCorrect && response.evidenceCorrect).length;
    setProgress((current) => completeQuest(current, quest.id, { correctAnswers, correctEvidence, reasoningQuality, questionCount: questions.length }));
    if (progress.settings.soundEnabled && progress.settings.soundCompletion) playCue('completion', progress.settings);
    setShowCelebration(true); setScreen('complete'); setRevealed(false);
  }

  function updateSettings(settings) { setProgress((current) => setProgressSettings(current, settings)); }
  function resetDemo() {
    if (window.confirm('Reset this browser’s anonymous LitLab progress, settings, and local demo data?')) {
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
          <div className="home-copy"><p className="eyebrow">Your next reading adventure</p><h1 id="home-title">Find the clue. <em>Light the path.</em></h1><p className="lede">LitLab makes evidence practice feel like a small adventure. Careful reasoning—not speed—moves your story forward.</p><div className="how-it-works" aria-label="How LitLab works"><span>Read the story</span><span>Find the proof</span><span>Grow your trail</span></div><div className="button-row"><button className="primary-button" type="button" disabled={!recommendation.quest} onClick={() => launchQuest(recommendation.quest)}>{recommendation.kind === 'resume' ? 'Resume your quest' : 'Start recommended quest'} <span aria-hidden="true">→</span></button><button className="secondary-button" type="button" onClick={() => navigate('dashboard')}>View practice summary</button></div><p className={`api-note is-${apiState.kind}`}><span className="status-dot" /> {apiState.label}</p></div>
          <div className="quest-preview"><div className="quest-world"><QuestHeroIllustration /></div>{recommendation.quest ? <><p className="card-label">{recommendation.kind === 'resume' ? 'Continue your route' : 'Recommended quest'}</p><h2>{recommendation.quest.title}</h2><p>{recommendation.quest.topic} · {recommendation.quest.difficulty}</p><div className="tag-row">{recommendation.quest.skillTags.map((tag) => <span key={tag}>{humanSkill(tag)}</span>)}</div><p className="time-label">◷ About {recommendation.quest.readingTimeMinutes} minutes · 3 evidence choices</p><p className="recommendation-reason">{recommendation.reason}</p><SourceNotice source={recommendation.quest.source} /></> : <section className="content-gate"><h2>Reviewed quests are loading.</h2><p>Local quest content will appear here once it passes its source and evidence checks.</p></section>}</div>
          <QuestMap arc={arc} activeQuestId={quest?.id} onContinue={launchQuest} />
          <section className="library-controls" aria-labelledby="library-title"><div><p className="eyebrow">Choose your quest</p><h2 id="library-title">The local quest library</h2></div><label className="search-label" htmlFor="quest-search">Search quests<input id="quest-search" value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} placeholder="Title, topic, or skill" /></label><label>Topic<select value={filters.topic} onChange={(event) => setFilters((current) => ({ ...current, topic: event.target.value }))}><option value="">All topics</option>{[...new Set(quests.map((item) => item.topic))].map((topic) => <option key={topic}>{topic}</option>)}</select></label><label>Skill<select value={filters.skill} onChange={(event) => setFilters((current) => ({ ...current, skill: event.target.value }))}><option value="">All skills</option>{[...new Set(quests.flatMap((item) => item.skillTags))].map((skill) => <option key={skill}>{humanSkill(skill)}</option>)}</select></label><label>Difficulty<select value={filters.difficulty} onChange={(event) => setFilters((current) => ({ ...current, difficulty: event.target.value }))}><option value="">All levels</option>{[...new Set(quests.map((item) => item.difficulty))].map((difficulty) => <option key={difficulty}>{difficulty}</option>)}</select></label><label className="toggle-row"><input type="checkbox" checked={filters.bookmarkOnly} onChange={(event) => setFilters((current) => ({ ...current, bookmarkOnly: event.target.checked }))} /><span>Bookmarks only</span></label></section>
          {progress.activeSession && <section className="resume-banner"><div><strong>Resume where you left off</strong><p>{questById(quests, progress.activeSession.questId)?.title || 'Your local quest'} · question {progress.activeSession.questionIndex + 1}</p></div><button className="secondary-button" type="button" onClick={() => navigate(progress.activeSession.screen, { questId: progress.activeSession.questId, questionIndex: progress.activeSession.questionIndex })}>Resume</button></section>}
          {filteredQuests.length ? <div className="library-grid">{filteredQuests.map((item) => <QuestCard key={item.id} quest={item} complete={isQuestComplete(progress, item.id)} bookmarked={progress.bookmarkedQuestIds.includes(item.id)} recommended={recommendation.quest?.id === item.id} progress={progress} onStart={launchQuest} onBookmark={(id) => setProgress((current) => toggleBookmark(current, id))} />)}</div> : <section className="empty-summary"><h2>No quests match those filters</h2><p>Clear a filter or bookmark a quest to bring it back into your library.</p><button className="secondary-button" type="button" onClick={() => setFilters({ search: '', topic: '', skill: '', difficulty: '', bookmarkOnly: false })}>Clear filters</button></section>}
          {unavailableCount > 0 && <section className="content-gate"><h2>{unavailableCount} quest{unavailableCount === 1 ? '' : 's'} unavailable</h2><p>They are hidden until source, rights, and sentence-evidence metadata are reviewed.</p></section>}
          <Guide accessory={progress.activeAccessoryId} message="Choose a quest, then look for the line that proves your idea." />
          <RecommendedBookCard onNavigate={navigate} catalogBooks={libraryEnhancement.books} recommendations={libraryEnhancement.recommendations} />
        </section>}
        {screen === 'example' && content.ready && <section className="lesson-view narrow-view" aria-labelledby="example-title"><p className="eyebrow">{quest.title} · worked example</p><h1 id="example-title">{quest.workedExample.title || 'Try the evidence routine'}</h1><div className="routine-grid"><article><span>1</span><h2>Notice</h2><p>{quest.workedExample.notice}</p></article><article><span>2</span><h2>Think</h2><p>{quest.workedExample.think}</p></article><article><span>3</span><h2>Prove</h2><p>{quest.workedExample.prove}</p></article></div><div className="example-callout"><strong>Example answer:</strong> {quest.workedExample.answer}<br /><strong>Evidence:</strong> {quest.workedExample.evidence}</div><div className="button-row"><button className="primary-button" type="button" onClick={() => navigate('reading')}>Read the passage <span aria-hidden="true">→</span></button><button className="text-button" type="button" onClick={() => navigate('reading')}>Skip example</button></div><Guide accessory={progress.activeAccessoryId} message="First, watch the routine. Then you will try it yourself." /></section>}
        {screen === 'reading' && content.ready && <section className="reading-view" aria-labelledby="reading-title"><div className="reading-heading"><div><p className="eyebrow">{quest.skillTags.map(humanSkill).join(' + ')}</p><h1 id="reading-title">{quest.title}</h1><p>{quest.topic} · about {quest.readingTimeMinutes} minutes</p></div><div className="reading-meter" aria-label="Reading step complete"><span>Reading</span><strong>1 / 2</strong><i><b /></i></div></div><article className="passage-card" aria-label={`${quest.title} passage`}>{sentencesFor(quest).map((sentence) => <p key={sentence.id} id={`passage-${sentence.id}`}>{sentence.text}</p>)}</article><div className="reading-footer"><p>When you are ready, answer one question at a time and choose the sentence that supports your idea.</p><button className="primary-button" type="button" onClick={() => beginQuestion(0)}>Start questions <span aria-hidden="true">→</span></button></div><Guide accessory={progress.activeAccessoryId} mood="thoughtful" message="There is no speed bonus. Take the time you need to find the strongest clue." /></section>}
        {screen === 'question' && content.ready && activeQuestion && <section className="question-view narrow-view" aria-labelledby="question-title"><div className="question-progress" aria-label={`Question ${questionIndex + 1} of ${questions.length}`}><span>Question {questionIndex + 1} of {questions.length}</span><div className="clue-trail" aria-label={`${questionIndex} of ${questions.length} evidence clues collected`}>{questions.map((question, index) => { const response = responseFor(progress, quest.id, question.id); return <i key={question.id} className={index === questionIndex ? 'is-current' : response?.evidenceCorrect ? 'is-strong' : response ? 'is-practice' : ''}>{response ? response.evidenceCorrect ? '✦' : '•' : index + 1}</i>; })}</div></div><p className="eyebrow">{quest.title} · skill: {humanSkill(questionSkill(activeQuestion, quest))}</p><h1 id="question-title">{activeQuestion.prompt}</h1><fieldset className="choice-fieldset"><legend>1. Choose your answer</legend>{activeQuestion.choices.map((choice) => <label className={`choice-card ${draft.answerId === choice.id ? 'selected' : ''}`} key={choice.id}><input type="radio" name="answer" value={choice.id} checked={draft.answerId === choice.id} onChange={() => setDraft((current) => ({ ...current, answerId: choice.id }))} /><span>{choice.text}</span></label>)}</fieldset><fieldset className="choice-fieldset evidence-fieldset"><legend>2. Choose the sentence that best supports your answer</legend><p className="field-help">Your evidence is saved before feedback appears.</p>{activeQuestion.evidenceSentenceIds.map((sentenceId) => { const sentence = sentenceById(quest, sentenceId); return sentence ? <label className={`choice-card evidence-choice ${draft.evidenceId === sentenceId ? 'selected' : ''}`} key={sentenceId}><input type="radio" name="evidence" value={sentenceId} checked={draft.evidenceId === sentenceId} onChange={() => setDraft((current) => ({ ...current, evidenceId: sentenceId }))} /><span>{sentence.text}</span></label> : null; })}</fieldset><button className="primary-button" type="button" onClick={submitResponse} disabled={!draft.answerId || !draft.evidenceId}>Submit answer &amp; evidence <span aria-hidden="true">→</span></button><Guide accessory={progress.activeAccessoryId} message="Choose an answer, then the sentence that best supports it." /></section>}
        {screen === 'feedback' && content.ready && activeQuestion && activeResponse && <section className="feedback-view narrow-view" aria-labelledby="feedback-title"><p className="eyebrow">{quest.title} · your feedback</p><h1 id="feedback-title">{activeResponse.answerCorrect && activeResponse.evidenceCorrect ? 'That idea is well supported.' : 'Let’s check the proof together.'}</h1><div className="feedback-grid"><article><span className={activeResponse.answerCorrect ? 'result-good' : 'result-note'}>{activeResponse.answerCorrect ? '✓' : '↗'}</span><h2>Your answer</h2><p>{choiceById(activeQuestion, activeResponse.answerId)?.text}</p></article><article><span className={activeResponse.evidenceCorrect ? 'result-good' : 'result-note'}>{activeResponse.evidenceCorrect ? '✓' : '↗'}</span><h2>Your evidence</h2><p>{sentenceById(quest, activeResponse.evidenceId)?.text}</p></article></div><div className="explanation"><strong>Why:</strong> {activeQuestion.explanation}</div><button className="text-button" type="button" aria-pressed={progress.confusingQuestionIds.includes(activeQuestion.id)} onClick={() => setProgress((current) => toggleConfusingQuestion(current, activeQuestion.id))}>{progress.confusingQuestionIds.includes(activeQuestion.id) ? 'Marked for local review' : 'This question seems confusing'}</button>{!revealed ? <button className="secondary-button" type="button" onClick={revealEvidence}>Show passage evidence</button> : <div className="evidence-reveal" aria-live="polite"><p className="eyebrow">Passage evidence</p><p>The highlighted sentence is the strongest support for the answer.</p><article className="evidence-passage" aria-label="Passage with supporting evidence highlighted">{sentencesFor(quest).map((sentence) => <p key={sentence.id} id={`evidence-${sentence.id}`} className={sentence.id === activeQuestion.correctEvidenceSentenceId ? 'is-evidence' : ''}>{sentence.id === activeQuestion.correctEvidenceSentenceId ? <mark>{sentence.text}</mark> : sentence.text}</p>)}</article></div>}<div className="button-row"><button className="primary-button" type="button" onClick={() => navigate('consequence')}>See what your clue changes <span aria-hidden="true">→</span></button></div><Guide accessory={progress.activeAccessoryId} mood={activeResponse.evidenceCorrect ? 'happy' : 'thoughtful'} message={activeResponse.evidenceCorrect ? 'That clue lights a stronger route on your map.' : 'A practice clue still helps the guide map the next route.'} /></section>}
        {screen === 'consequence' && content.ready && activeQuestion && activeResponse && <section className="consequence-view narrow-view" aria-labelledby="consequence-title"><div className={`consequence-scene ${activeResponse.evidenceCorrect ? 'scene-unlocked' : 'scene-mapped'}`} aria-hidden="true"><span>✦</span><span>⌁</span><span>◌</span></div><p className="eyebrow">{quest.title} · story consequence</p><h1 id="consequence-title">{activeResponse.evidenceCorrect ? activeQuestion.storyConsequence.strongTitle : activeQuestion.storyConsequence.practiceTitle}</h1><p className="consequence-copy">{activeResponse.evidenceCorrect ? activeQuestion.storyConsequence.strongMessage : activeQuestion.storyConsequence.practiceMessage}</p><p className="consequence-note">{activeResponse.evidenceCorrect ? 'Evidence Shard collected: the clearest route is now lit.' : 'Practice clue added: the guide marked the evidence for your next try.'}</p>{questionIndex < questions.length - 1 ? <button className="primary-button" type="button" onClick={() => beginQuestion(questionIndex + 1)}>Next question <span aria-hidden="true">→</span></button> : <button className="primary-button" type="button" onClick={finishQuest}>Finish quest <span aria-hidden="true">→</span></button>}<Guide accessory={progress.activeAccessoryId} mood={activeResponse.evidenceCorrect ? 'happy' : 'thoughtful'} message="Your evidence choice changed the story scene. Keep following the trail." /></section>}
        {screen === 'complete' && content.ready && <section className="complete-view narrow-view" aria-labelledby="complete-title">{showCelebration && <button className="skip-celebration" type="button" onClick={() => setShowCelebration(false)}>Skip celebration</button>}<div className={`completion-star ${showCelebration ? 'is-celebrating' : ''}`} aria-hidden="true">✦</div><p className="eyebrow">{quest.title} · quest complete</p><h1 id="complete-title">You followed the evidence trail.</h1><p className="completion-score">{correctAnswers} of {questions.length} answers matched the passage · {correctEvidence} of {questions.length} evidence choices were on target.</p><div className="reward-card"><span>+ {progress.lastCompletedQuestId === quest.id ? progress.lastCompletionXp : 0} XP</span><strong>Story fragment collected · {progress.badgeIds.includes(BADGES.EVIDENCE_EXPLORER) ? 'Strong Clue Finder badge earned' : 'Evidence Explorer badge earned'}</strong></div><div className="quest-debrief"><h2>Quest debrief</h2><p>You practiced {quest.skillTags.map(humanSkill).join(', ')}. Your next route can build on this clue trail or explore another skill.</p></div><div className="button-row"><button className="primary-button" type="button" onClick={() => navigate('review')}>Review your evidence <span aria-hidden="true">→</span></button><button className="secondary-button" type="button" onClick={() => navigate('dashboard')}>View progress</button><button className="text-button" type="button" onClick={() => navigate('home')}>Choose another quest</button></div><Guide accessory={progress.activeAccessoryId} mood="happy" message="A new story fragment is in your journal. Your next quest is ready whenever you are." /></section>}
        {screen === 'review' && content.ready && <ReviewScreen quest={quest} progress={progress} onBack={() => navigate('dashboard')} />}
        {screen === 'dashboard' && <section className="dashboard-view" aria-labelledby="dashboard-title"><div className="dashboard-heading"><div><p className="eyebrow">Anonymous learner · local demo</p><h1 id="dashboard-title">Practice &amp; progress</h1><p>This view records practice signals to guide a next step. It is not a diagnosis or a measure of mastery.</p></div><button className="secondary-button" type="button" onClick={resetDemo}>Reset demo progress</button></div><div className="stat-grid"><article><span>XP</span><strong>{progress.xp}</strong><small>Level {levelForXp(progress.xp)} · {xpIntoLevel(progress.xp)}/100 to next</small></article><article><span>Quest trail</span><strong>{progress.completedQuestIds.length}/{quests.length}</strong><small>{progress.storyFragmentIds.length} story fragments</small></article><article><span>Daily goal</span><strong>{dailyGoal.completed}/{dailyGoal.target}</strong><small>{dailyGoal.complete ? 'Goal complete' : 'One quest moves it forward'}</small></article><article><span>Streak</span><strong>{progress.streak.current}</strong><small>Days with a completed activity</small></article></div><section className="daily-goal"><div><p className="eyebrow">Flexible daily goal</p><h2>{dailyGoal.complete ? 'Today’s goal is complete' : 'Set a gentle reading goal'}</h2><p>{dailyGoal.completed} of {dailyGoal.target} completed today. Missing a day never removes earned progress.</p></div><div><label htmlFor="daily-target">Quest target</label><select id="daily-target" value={dailyGoal.target} onChange={(event) => setProgress((current) => setDailyGoalTarget(current, event.target.value))}><option value="1">1 quest</option><option value="2">2 quests</option><option value="3">3 quests</option></select></div></section><section className="skill-strengths" aria-labelledby="skill-strengths-title"><div><p className="eyebrow">Skill map</p><h2 id="skill-strengths-title">What this practice has covered</h2></div><div className="strength-grid">{skills.map((skill) => { const percent = skill.attempts ? Math.round((skill.evidenceCorrect / skill.attempts) * 100) : 0; return <article key={skill.key} tabIndex="0"><strong>{humanSkill(skill.key)}</strong><span>{skill.attempts ? `${skill.evidenceCorrect}/${skill.attempts} evidence choices on target` : 'Not practiced yet'}</span><i aria-label={`${percent}% evidence choices on target`}><b style={{ width: `${percent}%` }} /></i></article>; })}</div></section><section className="collection-panel"><div><p className="eyebrow">Collection journal</p><h2>Badges, fragments &amp; companion details</h2></div>{progress.badgeIds.length ? <div className="collection-list">{progress.badgeIds.map((badge) => <span key={badge}>✦ {BADGE_COPY[badge] || badge}</span>)}{progress.storyFragmentIds.map((fragment) => <span key={fragment}>▣ {fragment.replace('fragment-', '').replaceAll('-', ' ')}</span>)}</div> : <div className="empty-badges"><strong>No badges yet</strong><p>Finish a quest to add your first Evidence Explorer badge and story fragment.</p></div>}<div className="accessory-picker"><span>Guide accessory</span>{['compass', ...progress.unlockedAccessoryIds].map((accessory) => <button key={accessory} type="button" className={progress.activeAccessoryId === accessory ? 'is-selected' : ''} onClick={() => markAccessory(accessory)}>{humanSkill(accessory)}</button>)}</div></section>{quest && questResponses.length > 0 ? <section className="tutor-summary" aria-labelledby="tutor-summary-title"><div><p className="eyebrow">Tutor session summary</p><h2 id="tutor-summary-title">{quest.title}</h2><p>{quest.skillTags.map(humanSkill).join(' · ')} · {questResponses.length} responses recorded</p></div><div className="summary-rows">{questions.map((question, index) => { const response = responseFor(progress, quest.id, question.id); return <article key={question.id}><strong>Question {index + 1}</strong><p><span>Learner answer</span>{response ? choiceById(question, response.answerId)?.text : 'Not answered yet'}</p><p><span>Chosen evidence</span>{response ? sentenceById(quest, response.evidenceId)?.text : 'Not chosen yet'}</p><p><span>Suggested next practice</span>{question.followUpSuggestion}</p></article>; })}</div><button className="secondary-button" type="button" onClick={() => navigate('review')}>Review answer details</button></section> : <section className="empty-summary"><h2>No practice recorded for this quest yet</h2><p>Choose a reviewed quest to record anonymous answers, evidence choices, and a focused next practice.</p></section>}<section className="next-step"><div><p className="eyebrow">Next recommendation</p><h2>{recommendation.quest?.title || 'A reviewed local quest'}</h2><p>{recommendation.reason}</p></div><button className="primary-button" type="button" disabled={!recommendation.quest} onClick={() => launchQuest(recommendation.quest)}>{recommendation.kind === 'resume' ? 'Resume quest' : 'Start quest'} <span aria-hidden="true">→</span></button></section><Guide accessory={progress.activeAccessoryId} message="Your next quest is chosen from unfinished routes and skills you have practiced least." /></section>}
        {screen === 'leaderboard' && <LeaderboardScreen progress={progress} onNavigate={navigate} />}
        {screen === 'trophy-road' && <TrophyRoadScreen progress={progress} onNavigate={navigate} />}
        {screen === 'level-road' && <LevelRoad100 progress={progress} petCatalog={libraryEnhancement.pets} onNavigate={navigate} />}
        {screen === 'profile' && <ProfileScreen progress={progress} profileId={libraryEnhancement.profileId} catalogBooks={libraryEnhancement.books} onNavigate={navigate} onUpdate={setProgress} onStatus={addStatus} />}
        {screen === 'basics' && <ReadingBasicsScreen progress={progress} onUpdate={setProgress} onNavigate={navigate} />}
        {screen === 'pets' && <PetCollectionScreen progress={progress} petCatalog={libraryEnhancement.pets} onUpdate={setProgress} onStatus={addStatus} />}
        {screen === 'shop' && <LitLearnShopScreen progress={progress} profileId={libraryEnhancement.profileId} shopItems={libraryEnhancement.shopItems} onUpdate={setProgress} onNavigate={navigate} onStatus={addStatus} />}
        {['pass', 'books'].includes(screen) && <PlatformCollection section={screen} progress={progress} quests={quests} apiState={apiState} catalogBooks={libraryEnhancement.books} bookQuizzes={libraryEnhancement.bookQuizzes} bookActivities={libraryEnhancement.bookActivities} shopItems={libraryEnhancement.shopItems} profileId={libraryEnhancement.profileId} onUpdate={setProgress} onStatus={addStatus} onNavigate={navigate} onLaunchQuest={launchQuest} />}
        {screen === 'settings' && <ControlsPanel progress={progress} onUpdate={updateSettings} onJudge={loadJudgeDemo} onReset={resetDemo} />}
        {screen === 'explore' && <FeatureLab progress={progress} quests={quests} onStatus={addStatus} onSetting={updateSettings} onUpdate={setProgress} />}
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
