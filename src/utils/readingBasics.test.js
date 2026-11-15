import assert from 'node:assert/strict';
import test from 'node:test';
import { createEmptyProgress, loadProgress, PROGRESS_STORAGE_KEY, saveProgress } from './progress.js';
import { activityProgressId, isBasicsActivityComplete, READING_BASICS_BUNDLE, READING_BASICS_LESSONS, recordBasicsAttempt } from './readingBasics.js';

test('loads the reviewed offline bundle for all seven starter skills and supported game formats', () => {
  assert.equal(READING_BASICS_BUNDLE.schemaVersion, 1);
  assert.equal(READING_BASICS_LESSONS.length, 7);
  const types = new Set();
  for (const lesson of READING_BASICS_LESSONS) {
    assert.ok(lesson.version > 0 && lesson.explanation && lesson.workedExample);
    assert.ok(lesson.activities.length > 0);
    for (const activity of lesson.activities) {
      types.add(activity.type);
      assert.equal(activity.reviewStatus, 'reviewed');
      assert.ok(activity.version > 0 && activity.task.correctChoiceId);
      assert.equal(activity.source.sourceType, 'original-companion');
      assert.equal(activity.source.rightsStatus, 'project-original');
      const sentenceIds = new Set(activity.source.passage.map((sentence) => sentence.id));
      assert.ok(activity.task.correctEvidenceSentenceIds.every((id) => sentenceIds.has(id)));
    }
  }
  assert.deepEqual([...types].sort(), ['character-connections', 'clue-hunt', 'context-clues', 'creative-response', 'prediction-path', 'scene-reconstruction', 'story-quest', 'timeline-repair'].sort());
});

test('stores versioned activity attempts and awards first-clear XP only for answer plus evidence success', () => {
  const lesson = READING_BASICS_LESSONS.find((item) => item.id === 'reading-basics-inference');
  const activity = lesson.activities[0];
  const id = activityProgressId(activity);
  const date = new Date('2026-11-15T12:00:00Z');
  let progress = createEmptyProgress();
  progress = recordBasicsAttempt(progress, lesson, activity, { correct: false, answerId: 'wrong', evidenceId: 's1', date });
  assert.equal(progress.xp, 0);
  assert.equal(progress.readingBasics.attempts[id].count, 1);
  assert.equal(isBasicsActivityComplete(progress, activity), false);
  progress = recordBasicsAttempt(progress, lesson, activity, { correct: true, answerId: activity.task.correctChoiceId, evidenceId: activity.task.correctEvidenceSentenceIds[0], date });
  assert.equal(progress.xp, 15);
  assert.equal(isBasicsActivityComplete(progress, activity), true);
  assert.equal(progress.readingBasics.activityVersions[activity.id], activity.version);
  progress = recordBasicsAttempt(progress, lesson, activity, { correct: true, answerId: activity.task.correctChoiceId, evidenceId: activity.task.correctEvidenceSentenceIds[0], date });
  assert.equal(progress.xp, 15);
  assert.equal(progress.readingBasics.attempts[id].count, 3);
});

test('awards a lesson badge only after every reviewed activity is cleared', () => {
  const lesson = READING_BASICS_LESSONS.find((item) => item.activities.length > 1);
  let progress = createEmptyProgress();
  for (const activity of lesson.activities) {
    progress = recordBasicsAttempt(progress, lesson, activity, { correct: true, answerId: activity.task.correctChoiceId, evidenceId: activity.task.correctEvidenceSentenceIds[0] });
    if (activity !== lesson.activities.at(-1)) assert.equal(progress.readingBasics.earnedBadgeIds.includes(`basics-badge:${lesson.id}`), false);
  }
  assert.ok(progress.readingBasics.completedLessonIds.includes(lesson.id));
  assert.ok(progress.readingBasics.earnedBadgeIds.includes(`basics-badge:${lesson.id}`));
});

test('saves and reloads only lesson/activity completion and attempt metadata locally', () => {
  const values = new Map();
  globalThis.window = { localStorage: { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) } };
  const lesson = READING_BASICS_LESSONS[0];
  const activity = lesson.activities[0];
  const progress = recordBasicsAttempt(createEmptyProgress(), lesson, activity, { correct: true, answerId: 'b', evidenceId: 's4' });
  saveProgress(progress);
  const reloaded = loadProgress();
  assert.ok(values.has(PROGRESS_STORAGE_KEY));
  assert.ok(isBasicsActivityComplete(reloaded, activity));
  assert.equal(reloaded.readingBasics.attempts[activityProgressId(activity)].version, activity.version);
  assert.equal(JSON.stringify(reloaded.readingBasics).includes(activity.source.passage[0].text), false);
  assert.equal(reloaded.xp, 15);
  delete globalThis.window;
});
