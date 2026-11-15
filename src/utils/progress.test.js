import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BADGES,
  LEGACY_PROGRESS_STORAGE_KEYS,
  PROGRESS_STORAGE_KEY,
  beginQuest,
  completeQuest,
  createEmptyProgress,
  loadProgress,
  openCatalogEgg,
  recordResponse,
  resetProgress,
  saveProgress,
  setActiveSession,
  setProgressSettings,
  toggleBookmark,
  toggleFavoritePet,
} from './progress.js';

function installStorage() {
  const values = new Map();
  globalThis.window = { localStorage: { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) } };
  return values;
}

test('records an answer and evidence choice without duplicating the response', () => {
  let progress = createEmptyProgress();
  progress = recordResponse(progress, { questId: 'quest-1', questionId: 'q-1', answerId: 'a', evidenceId: 's-2', answerCorrect: true, evidenceCorrect: true });
  progress = recordResponse(progress, { questId: 'quest-1', questionId: 'q-1', answerId: 'b', evidenceId: 's-3', answerCorrect: false, evidenceCorrect: false });
  assert.equal(progress.responses.length, 1);
  assert.deepEqual(progress.responses[0].evidenceId, 's-3');
});

test('completes a quest once and grants transparent local rewards', () => {
  const first = completeQuest(createEmptyProgress(), 'quest-1', { correctAnswers: 3, correctEvidence: 3, questionCount: 3, date: new Date('2026-11-14T12:00:00') });
  assert.equal(first.completedQuestIds.includes('quest-1'), true);
  assert.equal(first.badgeIds.includes(BADGES.FIRST_QUEST), true);
  assert.equal(first.badgeIds.includes(BADGES.EVIDENCE_EXPLORER), true);
  assert.equal(first.xp, 125);
  const replay = completeQuest(first, 'quest-1', { correctAnswers: 3, correctEvidence: 3, questionCount: 3 });
  assert.equal(replay.xp, first.xp);
  assert.equal(replay.completedQuestIds.length, 1);
});

test('persists, resumes, bookmarks, and resets the versioned local progress schema', () => {
  const values = installStorage();
  let progress = beginQuest(createEmptyProgress(), 'quest-2');
  progress = setActiveSession(progress, { questId: 'quest-2', screen: 'question', questionIndex: 1 });
  progress = toggleBookmark(progress, 'quest-2');
  saveProgress(progress);
  const loaded = loadProgress();
  assert.deepEqual(loaded.activeSession, { questId: 'quest-2', screen: 'question', questionIndex: 1 });
  assert.deepEqual(loaded.bookmarkedQuestIds, ['quest-2']);
  assert.equal(values.size > 0, true);
  const cleared = resetProgress();
  assert.equal(cleared.responses.length, 0);
  assert.equal(loadProgress().bookmarkedQuestIds.length, 0);
});

test('migrates anonymous progress from an earlier product-name storage key', () => {
  const values = installStorage();
  const legacy = { ...createEmptyProgress(), xp: 125, completedQuestIds: ['quest-1'] };
  values.set(LEGACY_PROGRESS_STORAGE_KEYS[0], JSON.stringify(legacy));
  const loaded = loadProgress();
  assert.equal(loaded.xp, 125);
  assert.deepEqual(loaded.completedQuestIds, ['quest-1']);
  assert.ok(values.has(PROGRESS_STORAGE_KEY));
});

test('keeps optional sound preferences in local progress', () => {
  const values = installStorage();
  const configured = setProgressSettings(createEmptyProgress(), { soundEnabled: true, soundVolume: 'standard', soundFeedback: false, soundCompletion: true });
  saveProgress(configured);
  const loaded = loadProgress();
  assert.deepEqual(loaded.settings, { ...createEmptyProgress().settings, soundEnabled: true, soundVolume: 'standard', soundFeedback: false, soundCompletion: true });
  assert.equal(values.size > 0, true);
});

test('favorites and active pet state stay local and only owned pets can be favorited', () => {
  let progress = createEmptyProgress();
  progress = toggleFavoritePet(progress, 'moss-mouse');
  assert.deepEqual(progress.favoritePetIds, ['moss-mouse']);
  progress = toggleFavoritePet(progress, 'moss-mouse');
  assert.deepEqual(progress.favoritePetIds, []);
  progress = toggleFavoritePet(progress, 'comet-bat');
  assert.deepEqual(progress.favoritePetIds, []);
});

test('opens an owned egg deterministically and converts duplicate pets to shards', () => {
  const egg = { id: 'storybook-egg', rarityRange: ['Common', 'Rare'], possibleRewards: { Common: ['new-pet'] }, duplicateBehavior: { currency: 'storyShards', quantity: 30 } };
  let progress = { ...createEmptyProgress(), ownedEggIds: ['storybook-egg'] };
  progress = openCatalogEgg(progress, egg);
  assert.equal(progress.ownedPetIds.includes('new-pet'), true);
  assert.deepEqual(progress.ownedEggIds, []);
  progress = openCatalogEgg({ ...progress, ownedEggIds: ['storybook-egg'] }, egg);
  assert.equal(progress.currencies.storyShards, 30);
});

test('defaults appearance to the device setting and persists a dark preference', () => {
  const values = installStorage();
  assert.equal(createEmptyProgress().settings.colorMode, 'system');
  saveProgress(setProgressSettings(createEmptyProgress(), { colorMode: 'dark', theme: 'sky' }));
  assert.equal(loadProgress().settings.colorMode, 'dark');
  assert.equal(loadProgress().settings.theme, 'sky');
  assert.equal(values.size > 0, true);
});
