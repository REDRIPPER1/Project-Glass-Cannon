import assert from 'node:assert/strict';
import test from 'node:test';
import { chapterActivitySource, supportedChapterActivities } from './chapterActivities.js';

test('shows only activity formats supported by reviewed exact-chapter data', () => {
  const supported = supportedChapterActivities({
    activityPayload: { reviewStatus: 'reviewed', activityTypes: ['character-map', 'vocabulary-in-context', 'book-world-map'] },
    quiz: { reviewStatus: 'generated-unreviewed', activityType: 'scene-reconstruction' },
  });
  assert.deepEqual(supported.map((activity) => activity.id), ['characters', 'vocabulary', 'world']);
});

test('keeps story and evidence routes for an existing reviewed quest without inventing other formats', () => {
  const supported = supportedChapterActivities({ quest: { id: 'reviewed-quest' } });
  assert.deepEqual(supported.map((activity) => activity.id), ['story', 'evidence']);
});

test('labels a chapter activity with its exact backend source before using a safe local fallback', () => {
  const book = { title: 'The Sample Book', edition: 'Project Gutenberg eBook #1' };
  const chapter = { title: 'Chapter II' };
  assert.equal(chapterActivitySource(book, chapter, { sourceLabel: 'PG #1 · Chapter II' }), 'PG #1 · Chapter II');
  assert.equal(chapterActivitySource(book, chapter), 'The Sample Book · Project Gutenberg eBook #1 · Chapter II');
});
