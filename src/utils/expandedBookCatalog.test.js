import assert from 'node:assert/strict';
import test from 'node:test';
import { EXPANDED_BOOK_CATALOG, fullBookCatalog } from './expandedBookCatalog.js';

test('provides a 100-plus web catalog across the requested reading categories', () => {
  const catalog = fullBookCatalog([]);
  assert.ok(catalog.length >= 100);
  ['Adventure', 'Mystery', 'Fantasy', 'Nature', 'History', 'Classics'].forEach((category) => assert.ok(catalog.some((book) => book.category === category)));
  assert.ok(EXPANDED_BOOK_CATALOG.every((book) => book.difficulty >= 1 && book.difficulty <= 5));
  assert.ok(EXPANDED_BOOK_CATALOG.every((book) => book.difficultyLabel));
});

test('keeps unreviewed web catalog entries text-free and explicitly unavailable', () => {
  const sample = EXPANDED_BOOK_CATALOG[0];
  assert.equal(sample.chapterMetadata.length, 0);
  assert.equal(sample.webSourceStatus, 'unavailable');
  assert.equal('text' in sample, false);
});
