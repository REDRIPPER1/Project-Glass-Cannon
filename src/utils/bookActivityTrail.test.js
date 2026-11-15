import assert from 'node:assert/strict';
import test from 'node:test';
import { chapterTrailProgress, isTrailActivityComplete, recordTrailActivityAttempt, reviewedChapterTrailActivities, trailActivityProgressId, validateTrailResponse } from './bookActivityTrail.js';
import { createEmptyProgress, loadProgress, PROGRESS_STORAGE_KEY, saveProgress } from './progress.js';

const source = { bookId: 'alice-11', chapterId: 'chapter-1', edition: 'Project Gutenberg eBook #11', sourceLabel: 'Project Gutenberg eBook #11 · Chapter I' };
const activities = [
  { ...source, id: 'alice-ch1-mystery', version: 1, reviewStatus: 'reviewed', activityType: 'mystery-investigation', task: { mode: 'choice', correctChoiceId: 'answer-a', correctEvidenceSentenceIds: ['s1'], evidenceOptions: [{ sentenceId: 's1', text: 'A verified clue.' }] }, reward: { rewardId: 'alice-ch1-evidence', kind: 'evidence', xp: 10 } },
  { ...source, id: 'alice-ch1-order', version: 1, reviewStatus: 'reviewed', activityType: 'story-reconstruction', task: { mode: 'order', items: [{ id: 'a', label: 'First' }, { id: 'b', label: 'Then' }], correctOrderIds: ['a', 'b'], correctEvidenceSentenceIds: ['s2'] }, reward: { rewardId: 'alice-ch1-understanding', kind: 'understanding', xp: 10 } },
  { ...source, id: 'alice-ch1-ending', version: 1, reviewStatus: 'reviewed', activityType: 'alternate-ending', task: { mode: 'creative', responsePrompt: 'Write an ending.', minCharacters: 4, correctEvidenceSentenceIds: ['s3'] }, reward: { rewardId: 'alice-ch1-creativity', kind: 'creativity', xp: 10 } },
];

test('selects only reviewed activities with an exact book, chapter, edition, and source label', () => {
  const grouped = [{ schemaVersion: 1, bookId: 'alice-11', chapters: [{ chapterId: 'chapter-1', edition: source.edition, sourceLabel: source.sourceLabel, activities }, { chapterId: 'chapter-2', edition: source.edition, sourceLabel: 'Project Gutenberg eBook #11 · Chapter II', activities: [{ ...activities[0], id: 'draft', chapterId: 'chapter-2', reviewStatus: 'draft' }] }] }];
  assert.deepEqual(reviewedChapterTrailActivities(grouped, 'alice-11', 'chapter-1').map((activity) => activity.id), ['alice-ch1-ending', 'alice-ch1-mystery', 'alice-ch1-order']);
  assert.equal(reviewedChapterTrailActivities(grouped, 'alice-11', 'chapter-2').length, 0);
});

test('enriches a reviewed chapter summary with its already-selected book and chapter source context', () => {
  const summaries = [{ id: 'alice-ch1-mystery', version: 1, activityType: 'mystery-investigation', reviewStatus: 'reviewed', sourceSentenceIds: ['s1'], reward: { rewardId: 'quest-wishlist-page', kind: 'evidence', quantity: 1 } }];
  const activities = reviewedChapterTrailActivities(summaries, 'alice-11', 'chapter-1', { edition: source.edition, sourceLabel: source.sourceLabel });
  assert.equal(activities.length, 1);
  assert.equal(activities[0].sourceLabel, source.sourceLabel);
  assert.equal(activities[0].bookId, 'alice-11');
});

test('requires a meaningful response and the exact supporting evidence for every activity mode', () => {
  assert.equal(validateTrailResponse(activities[0], { choiceId: 'answer-a', evidenceSentenceIds: ['s1'] }).complete, true);
  assert.equal(validateTrailResponse(activities[1], { orderIds: ['b', 'a'], evidenceSentenceIds: ['s2'] }).complete, false);
  assert.equal(validateTrailResponse(activities[2], { responseText: 'new', evidenceSentenceIds: ['s3'] }).complete, false);
  assert.equal(validateTrailResponse(activities[2], { responseText: 'A new ending', evidenceSentenceIds: ['s3'] }).complete, true);
});

test('records stable completion and rewards only once while preserving chapter progress', () => {
  let progress = createEmptyProgress();
  progress = recordTrailActivityAttempt(progress, activities[0], { choiceId: 'wrong', evidenceSentenceIds: ['s1'] }, { chapterActivities: activities });
  assert.equal(progress.xp, 0);
  assert.equal(progress.bookActivityTrail.attempts[trailActivityProgressId(activities[0])].count, 1);
  progress = recordTrailActivityAttempt(progress, activities[0], { choiceId: 'answer-a', evidenceSentenceIds: ['s1'] }, { chapterActivities: activities });
  assert.equal(progress.xp, 10);
  assert.ok(isTrailActivityComplete(progress, activities[0]));
  progress = recordTrailActivityAttempt(progress, activities[0], { choiceId: 'answer-a', evidenceSentenceIds: ['s1'] }, { chapterActivities: activities });
  assert.equal(progress.xp, 10);
  progress = recordTrailActivityAttempt(progress, activities[1], { orderIds: ['a', 'b'], evidenceSentenceIds: ['s2'] }, { chapterActivities: activities });
  progress = recordTrailActivityAttempt(progress, activities[2], { responseText: 'A new ending', evidenceSentenceIds: ['s3'] }, { chapterActivities: activities });
  assert.deepEqual(chapterTrailProgress(progress, activities), { complete: 3, total: 3, isComplete: true });
  assert.ok(progress.bookActivityTrail.completedChapterIds.includes('alice-11:chapter-1'));
});

test('persists only versioned activity progress and reward event IDs across refresh', () => {
  const values = new Map();
  globalThis.window = { localStorage: { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) } };
  const progress = recordTrailActivityAttempt(createEmptyProgress(), activities[0], { choiceId: 'answer-a', evidenceSentenceIds: ['s1'] }, { chapterActivities: activities });
  saveProgress(progress);
  const reloaded = loadProgress();
  assert.ok(values.has(PROGRESS_STORAGE_KEY));
  assert.ok(isTrailActivityComplete(reloaded, activities[0]));
  assert.equal(reloaded.bookActivityTrail.activityVersions[activities[0].id], 1);
  assert.equal(JSON.stringify(reloaded.bookActivityTrail).includes('A verified clue.'), false);
  delete globalThis.window;
});
