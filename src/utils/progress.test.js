import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BADGES,
  LEGACY_PROGRESS_STORAGE_KEYS,
  PROGRESS_STORAGE_KEY,
  beginQuest,
  completeQuest,
  createEmptyProgress,
  grantDemoCurrency,
  loadProgress,
  openCatalogEgg,
  PET_LEVEL_MILESTONES,
  buyWishlistPages,
  markBookChapterRead,
  purchaseCatalogItem,
  recordResponse,
  redeemWishlistPages,
  resetProgress,
  saveProgress,
  setActiveSession,
  setProgressSettings,
  toggleBookWishlist,
  toggleBookmark,
  toggleFavoritePet,
  xpRequiredForLevel,
  xpForNextLevel,
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
  assert.equal(first.xp, 75);
  assert.deepEqual(first.lastXpBreakdown, { answers: 45, evidence: 30, reasoning: 0 });
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

test('pets stay locked until their Level Road milestone, then can be favorited', () => {
  let progress = { ...createEmptyProgress(), xp: xpRequiredForLevel(2) };
  progress = toggleFavoritePet(progress, 'moss-mouse');
  assert.deepEqual(progress.favoritePetIds, ['moss-mouse']);
  progress = toggleFavoritePet(progress, 'moss-mouse');
  assert.deepEqual(progress.favoritePetIds, []);
  progress = toggleFavoritePet(progress, 'comet-bat');
  assert.deepEqual(progress.favoritePetIds, []);
});

test('Level Road scales through 100 levels and never awards XP for an incorrect empty completion', () => {
  assert.equal(xpRequiredForLevel(1), 0);
  assert.ok(xpRequiredForLevel(10) > xpRequiredForLevel(5));
  assert.ok(xpRequiredForLevel(100) > xpRequiredForLevel(99));
  assert.ok(xpForNextLevel(0) > 0);
  assert.equal(PET_LEVEL_MILESTONES.length, 6);
  const untouched = completeQuest(createEmptyProgress(), 'no-credit', { correctAnswers: 0, correctEvidence: 0, reasoningQuality: 0 });
  assert.equal(untouched.xp, 0);
});

test('opens an owned egg deterministically and converts duplicate pets to Diamonds', () => {
  const egg = { id: 'storybook-egg', rarityRange: ['Common', 'Rare'], possibleRewards: { Common: ['new-pet'] }, duplicateBehavior: { currency: 'storyShards', quantity: 30 } };
  let progress = { ...createEmptyProgress(), ownedEggIds: ['storybook-egg'] };
  progress = openCatalogEgg(progress, egg);
  assert.equal(progress.ownedPetIds.includes('new-pet'), true);
  assert.deepEqual(progress.ownedEggIds, []);
  progress = openCatalogEgg({ ...progress, ownedEggIds: ['storybook-egg'] }, egg);
  assert.equal(progress.currencies.diamonds, 30);
});

test('keeps local book ownership and demo currency rewards in the progress schema', () => {
  let progress = purchaseCatalogItem(createEmptyProgress(), { itemType: 'book', catalogId: 'book-1', price: 20, currency: 'leafTokens' });
  assert.deepEqual(progress.ownedBookIds, ['book-1']);
  progress = grantDemoCurrency(progress, 'storyShards', 15);
  assert.equal(progress.currencies.diamonds, 15);
  progress = grantDemoCurrency(progress, 'gold', 10);
  assert.equal(progress.currencies.gold, 90);
});

test('tracks in-app chapter reading and redeems exactly five Wishlist Pages for permanent ownership', () => {
  let progress = { ...createEmptyProgress(), inventory: { wishlistPages: 5 }, bookWishlistIds: ['book-1', 'book-2'] };
  progress = markBookChapterRead(progress, 'book-1', 'chapter-1');
  assert.deepEqual(progress.bookReading['book-1'].chapterIds, ['chapter-1']);
  const redeemed = redeemWishlistPages(progress, progress.bookWishlistIds);
  assert.equal(redeemed.progress.inventory.wishlistPages, 0);
  assert.equal(redeemed.progress.ownedBookIds.includes(redeemed.selectedBookId), true);
  assert.equal(redeemed.progress.bookWishlistIds.includes(redeemed.selectedBookId), true);
});

test('keeps the book wishlist separate from generic saved pet and accessory items', () => {
  let progress = { ...createEmptyProgress(), wishlistIds: ['pet-accessory'] };
  progress = toggleBookWishlist(progress, 'book-1');
  assert.deepEqual(progress.bookWishlistIds, ['book-1']);
  assert.deepEqual(progress.wishlistIds, ['pet-accessory']);
});

test('only Diamonds purchase Wishlist Pages and a failed purchase keeps the wallet intact', () => {
  const emptyWallet = { ...createEmptyProgress(), currencies: { gold: 100, diamonds: 0 } };
  assert.equal(buyWishlistPages(emptyWallet).inventory.wishlistPages, 0);
  assert.equal(buyWishlistPages(emptyWallet).currencies.diamonds, 0);
  const purchased = buyWishlistPages({ ...emptyWallet, currencies: { gold: 100, diamonds: 10 } });
  assert.equal(purchased.currencies.diamonds, 0);
  assert.equal(purchased.inventory.wishlistPages, 1);
});

test('defaults appearance to the device setting and persists a dark preference', () => {
  const values = installStorage();
  assert.equal(createEmptyProgress().settings.colorMode, 'system');
  saveProgress(setProgressSettings(createEmptyProgress(), { colorMode: 'dark', theme: 'sky' }));
  assert.equal(loadProgress().settings.colorMode, 'dark');
  assert.equal(loadProgress().settings.theme, 'sky');
  assert.equal(values.size > 0, true);
});
