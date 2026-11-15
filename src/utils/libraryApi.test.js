import assert from 'node:assert/strict';
import test from 'node:test';
import { displayDifficulty, loadChapterReference, normalizeApiBook, purchaseShopItem, redeemWishlistPagesRemote, setRemoteBookWishlist } from './libraryApi.js';

test('normalizes backend book metadata without displaying grade-band wording or an external reader URL', () => {
  const book = normalizeApiBook({ id: 'book-1', category: 'Adventure', difficultyLabel: 'Grades 4-8', starRating: 4, accessRules: { mode: 'subscription' }, source: { landingUrl: 'https://example.test' }, rights: { requiredAttribution: 'Source credit' }, contentAvailability: 'bundled-passage' });
  assert.equal(book.difficultyLabel, 'Trailblazer');
  assert.equal(book.difficulty, 4);
  assert.equal(book.accessTier, 'premium');
  assert.equal(book.sourceUrl, undefined);
  assert.equal(book.contentAvailability, 'bundled-passage');
  assert.equal(displayDifficulty('Grades 4-6', 2), 'Explorer');
});

test('uses the bundled reader, wishlist, and local-demo purchase contracts', async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (path, options = {}) => {
    calls.push([path, options]);
    return { ok: true, json: async () => ({ content: { mode: 'bundled-passage', sentences: [] }, wallet: { gold: 9, diamonds: 3 }, inventory: { wishlistPages: 5 } }) };
  };
  try {
    await loadChapterReference('profile-1', 'book-1', 'chapter-1');
    await redeemWishlistPagesRemote('profile-1');
    await purchaseShopItem('profile-1', 'shop-wishlist-page');
    await setRemoteBookWishlist('profile-1', 'book-1', true);
    await setRemoteBookWishlist('profile-1', 'book-1', false);
  } finally { globalThis.fetch = originalFetch; }
  assert.equal(calls[0][0], '/api/profiles/profile-1/books/book-1/chapters/chapter-1');
  assert.equal(calls[1][0], '/api/profiles/profile-1/wishlist/redemptions');
  assert.equal(calls[1][1].method, 'POST');
  assert.equal(calls[2][0], '/api/profiles/profile-1/purchases');
  assert.equal(calls[3][0], '/api/profiles/profile-1/book-wishlist/book-1');
  assert.equal(calls[3][1].method, 'PUT');
  assert.equal(calls[4][1].method, 'DELETE');
});

test('normalizes chapter reading levels and Premium access from the catalog contract', () => {
  const book = normalizeApiBook({ id: 'book-1', access: { state: 'purchase-only', priceDiamonds: 24 }, chapterMetadata: [{ id: 'chapter-1', title: 'Chapter I', contentAvailability: 'bundled-passage', readingLevels: [{ id: 'starter', label: 'Starter', access: 'free' }, { id: 'stretch', label: 'Stretch', access: 'premium' }] }] });
  assert.equal(book.accessTier, 'purchase-only');
  assert.equal(book.priceDiamonds, 24);
  assert.equal(book.chapterMetadata[0].readingLevels[1].accessTier, 'premium');
});
