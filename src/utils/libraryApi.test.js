import assert from 'node:assert/strict';
import test from 'node:test';
import { displayDifficulty, normalizeApiBook } from './libraryApi.js';

test('normalizes backend book metadata without displaying grade-band wording', () => {
  const book = normalizeApiBook({ id: 'book-1', category: 'Adventure', difficultyLabel: 'Grades 4-8', starRating: 4, accessRules: { mode: 'subscription' }, source: { landingUrl: 'https://example.test' }, rights: { requiredAttribution: 'Source credit' } });
  assert.equal(book.difficultyLabel, 'Trailblazer');
  assert.equal(book.difficulty, 4);
  assert.equal(book.accessTier, 'premium');
  assert.equal(book.sourceUrl, 'https://example.test');
  assert.equal(displayDifficulty('Grades 4-6', 2), 'Explorer');
});
