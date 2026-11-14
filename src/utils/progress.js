export const PROGRESS_STORAGE_KEY = 'readquest.progress.v1';
export const PROGRESS_VERSION = 1;

const emptyProgress = () => ({
  version: PROGRESS_VERSION,
  xp: 0,
  lastCompletionXp: 0,
  lastCompletedQuestId: null,
  selectedQuestId: null,
  completedQuestIds: [],
  badgeIds: [],
  responses: [],
  activeSession: null,
  signals: {
    completedQuestCount: 0,
    evidenceReveals: 0,
    nextQuestSelections: 0,
  },
});

function isProgress(value) {
  return value
    && value.version === PROGRESS_VERSION
    && Array.isArray(value.completedQuestIds)
    && Array.isArray(value.badgeIds)
    && Array.isArray(value.responses)
    && typeof value.signals === 'object';
}

export function loadProgress() {
  try {
    const stored = window.localStorage.getItem(PROGRESS_STORAGE_KEY);
    const parsed = stored ? JSON.parse(stored) : null;
    return isProgress(parsed) ? { ...emptyProgress(), ...parsed } : emptyProgress();
  } catch {
    return emptyProgress();
  }
}

export function saveProgress(progress) {
  try {
    window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // The demo remains usable when browser storage is unavailable.
  }
}

export function resetProgress() {
  try {
    window.localStorage.removeItem(PROGRESS_STORAGE_KEY);
  } catch {
    // Nothing else is needed for an in-memory reset.
  }
  return emptyProgress();
}

export function recordResponse(progress, response) {
  const retainedResponses = progress.responses.filter(
    (item) => !(item.questId === response.questId && item.questionId === response.questionId),
  );
  return { ...progress, responses: [...retainedResponses, response] };
}

export function responseFor(progress, questId, questionId) {
  return progress.responses.find(
    (item) => item.questId === questId && item.questionId === questionId,
  );
}

export function responsesForQuest(progress, questId) {
  return progress.responses.filter((item) => item.questId === questId);
}

export function levelForXp(xp) { return Math.max(1, Math.floor(xp / 100) + 1); }
export function xpIntoLevel(xp) { return xp % 100; }
