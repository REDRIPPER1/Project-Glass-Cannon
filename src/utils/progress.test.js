import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BADGES,
  beginQuest,
  completeQuest,
  createEmptyProgress,
  loadProgress,
  recordResponse,
  resetProgress,
  saveProgress,
  setActiveSession,
  setProgressSettings,
  toggleBookmark,
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

test('keeps optional sound preferences in local progress', () => {
  const values = installStorage();
  const configured = setProgressSettings(createEmptyProgress(), { soundEnabled: true, soundVolume: 'standard', soundFeedback: false, soundCompletion: true });
  saveProgress(configured);
  const loaded = loadProgress();
  assert.deepEqual(loaded.settings, { ...createEmptyProgress().settings, soundEnabled: true, soundVolume: 'standard', soundFeedback: false, soundCompletion: true });
  assert.equal(values.size > 0, true);
});
