import assert from 'node:assert/strict';
import test from 'node:test';
import { bookAccessState, bookLevelNodes, chapterAccessState, exactChapterQuest, hasInAppChapterContent, libraryBooks, readableChapterSentences, sourceReaderState } from './bookLibrary.js';

const freeBook = { id: 'free', title: 'Free Book', accessTier: 'free-demo', sourceUrl: 'https://example.test', chapterMetadata: [{ id: 'c1', title: 'Chapter I', accessTier: 'free-demo' }] };
const premiumBook = { id: 'premium', title: 'Premium Book', accessTier: 'premium', sourceUrl: 'https://example.test', chapterMetadata: [{ id: 'c1', title: 'Chapter I', accessTier: 'premium' }] };
const purchaseBook = { id: 'purchase', title: 'Purchase Book', accessTier: 'purchase-only', sourceUrl: 'https://example.test', chapterMetadata: [{ id: 'c1', title: 'Chapter I', accessTier: 'premium' }] };
const freeProgress = { ownedBookIds: [], subscriptionPlan: 'free' };

test('labels owned, free, subscription, purchase-only, and locked book access', () => {
  assert.equal(bookAccessState(freeBook, freeProgress), 'free');
  assert.equal(bookAccessState(premiumBook, freeProgress), 'locked');
  assert.equal(bookAccessState(premiumBook, { ...freeProgress, subscriptionPlan: 'premium' }), 'subscription');
  assert.equal(bookAccessState(purchaseBook, { ...freeProgress, subscriptionPlan: 'premium' }), 'purchase-only');
  assert.equal(bookAccessState(premiumBook, { ...freeProgress, ownedBookIds: ['premium'] }), 'owned');
  assert.equal(chapterAccessState(premiumBook, premiumBook.chapterMetadata[0], freeProgress), 'locked');
});

test('filters the Library to books available through ownership, free access, or subscription', () => {
  assert.deepEqual(libraryBooks([freeBook, premiumBook, purchaseBook], freeProgress).map((book) => book.id), ['free']);
  assert.deepEqual(libraryBooks([freeBook, premiumBook, purchaseBook], { ...freeProgress, subscriptionPlan: 'premium' }).map((book) => book.id), ['free', 'premium']);
  assert.deepEqual(libraryBooks([freeBook, premiumBook, purchaseBook], { ...freeProgress, ownedBookIds: ['purchase'] }).map((book) => book.id), ['free', 'purchase']);
});

test('ties a comprehension quest only to its exact reviewed book chapter', () => {
  const quest = { source: { bookTitle: 'Free Book', chapter: 'Chapter I' } };
  assert.equal(exactChapterQuest(freeBook, freeBook.chapterMetadata[0], [quest]), quest);
  assert.equal(exactChapterQuest(freeBook, { id: 'c2', title: 'Chapter II' }, [quest]), null);
  assert.equal(sourceReaderState(freeBook, freeBook.chapterMetadata[0], 'free').kind, 'ready');
  assert.equal(sourceReaderState(freeBook, freeBook.chapterMetadata[0], 'locked').kind, 'locked');
});

test('creates a ten-level path without fabricating missing chapter mappings', () => {
  const nodes = bookLevelNodes(freeBook, [], 10);
  assert.equal(nodes.length, 10);
  assert.equal(nodes[0].chapter.id, 'c1');
  assert.equal(nodes[1].chapter, null);
  assert.equal(sourceReaderState(freeBook, nodes[1].chapter, 'locked').kind, 'empty');
});

test('accepts approved cached chapter text without requiring one hard-coded transport mode', () => {
  assert.equal(hasInAppChapterContent({ contentAvailability: 'bundled-chapter' }), true);
  assert.equal(hasInAppChapterContent({ contentAvailability: 'cached-chapter' }), true);
  assert.equal(hasInAppChapterContent({ contentAvailability: 'unavailable' }), false);
  assert.deepEqual(readableChapterSentences({ sentences: [{ id: 's1', text: 'Readable text.' }, { id: 's2', text: '' }] }), [{ id: 's1', text: 'Readable text.' }]);
  assert.deepEqual(readableChapterSentences({ mode: 'cached-chapter' }), []);
});
