export const PROGRESS_STORAGE_KEY = 'readquest.progress.v2';
export const LEGACY_PROGRESS_STORAGE_KEY = 'readquest.progress.v1';
export const PROGRESS_VERSION = 2;

export const BADGES = {
  FIRST_QUEST: 'first-evidence-quest',
  EVIDENCE_EXPLORER: 'evidence-explorer',
  QUEST_CARTOGRAPHER: 'quest-cartographer',
  COMEBACK_READER: 'comeback-reader',
};

function getStorage() {
  try { return globalThis.window?.localStorage ?? null; } catch { return null; }
}

export function localDateKey(date = new Date()) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}

export function createEmptyProgress() {
  return {
    version: PROGRESS_VERSION,
    xp: 0,
    lastCompletionXp: 0,
    lastCompletedQuestId: null,
    selectedQuestId: null,
    completedQuestIds: [],
    bookmarkedQuestIds: [],
    badgeIds: [],
    storyFragmentIds: [],
    unlockedAccessoryIds: [],
    activeAccessoryId: 'compass',
    responses: [],
    confusingQuestionIds: [],
    activeSession: null,
    onboardingComplete: false,
    dailyGoal: { date: localDateKey(), target: 1, completed: 0 },
    streak: { current: 0, best: 0, lastCompletedDate: null },
    settings: {
      textSize: 'regular',
      reduceMotion: false,
      soundEnabled: false,
      soundVolume: 'soft',
      soundFeedback: true,
      soundCompletion: true,
      colorMode: 'system',
      theme: 'twilight',
      judgeMode: false,
      hideGameSignals: false,
    },
    signals: {
      completedQuestCount: 0,
      evidenceReveals: 0,
      nextQuestSelections: 0,
      questStarts: 0,
      returnVisits: 0,
      coachUses: 0,
      discoverySearches: 0,
    },
  };
}

function asArray(value) { return Array.isArray(value) ? value : []; }

function mergeProgress(value) {
  const empty = createEmptyProgress();
  const candidate = value && typeof value === 'object' ? value : {};
  return {
    ...empty,
    ...candidate,
    version: PROGRESS_VERSION,
    completedQuestIds: asArray(candidate.completedQuestIds),
    bookmarkedQuestIds: asArray(candidate.bookmarkedQuestIds),
    badgeIds: asArray(candidate.badgeIds),
    storyFragmentIds: asArray(candidate.storyFragmentIds),
    unlockedAccessoryIds: asArray(candidate.unlockedAccessoryIds),
    responses: asArray(candidate.responses),
    confusingQuestionIds: asArray(candidate.confusingQuestionIds),
    dailyGoal: { ...empty.dailyGoal, ...(candidate.dailyGoal ?? {}) },
    streak: { ...empty.streak, ...(candidate.streak ?? {}) },
    settings: { ...empty.settings, ...(candidate.settings ?? {}) },
    signals: { ...empty.signals, ...(candidate.signals ?? {}) },
  };
}

function isProgress(value) {
  return value && typeof value === 'object' && Array.isArray(value.responses)
    && Array.isArray(value.completedQuestIds) && typeof value.signals === 'object';
}

export function loadProgress() {
  const storage = getStorage();
  if (!storage) return createEmptyProgress();
  try {
    const current = storage.getItem(PROGRESS_STORAGE_KEY);
    if (current) {
      const parsed = JSON.parse(current);
      if (isProgress(parsed)) return mergeProgress(parsed);
    }
    const legacy = storage.getItem(LEGACY_PROGRESS_STORAGE_KEY);
    if (legacy) {
      const parsed = JSON.parse(legacy);
      if (isProgress(parsed)) {
        const migrated = mergeProgress(parsed);
        storage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(migrated));
        return migrated;
      }
    }
  } catch {
    // The demo stays usable when browser storage is blocked or malformed.
  }
  return createEmptyProgress();
}

export function saveProgress(progress) {
  try { getStorage()?.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(mergeProgress(progress))); } catch { /* in-memory demo */ }
}

export function resetProgress() {
  try {
    getStorage()?.removeItem(PROGRESS_STORAGE_KEY);
    getStorage()?.removeItem(LEGACY_PROGRESS_STORAGE_KEY);
  } catch { /* in-memory demo */ }
  return createEmptyProgress();
}

export function recordResponse(progress, response) {
  const retainedResponses = progress.responses.filter(
    (item) => !(item.questId === response.questId && item.questionId === response.questionId),
  );
  return { ...mergeProgress(progress), responses: [...retainedResponses, response] };
}

export function responseFor(progress, questId, questionId) {
  return progress.responses.find((item) => item.questId === questId && item.questionId === questionId);
}

export function responsesForQuest(progress, questId) {
  return progress.responses.filter((item) => item.questId === questId);
}

export function setActiveSession(progress, activeSession) {
  return { ...mergeProgress(progress), activeSession };
}

export function beginQuest(progress, questId) {
  const normalized = mergeProgress(progress);
  return {
    ...normalized,
    selectedQuestId: questId,
    activeSession: { questId, screen: 'example', questionIndex: 0 },
    signals: {
      ...normalized.signals,
      questStarts: normalized.signals.questStarts + 1,
      nextQuestSelections: normalized.signals.nextQuestSelections + 1,
    },
  };
}

export function toggleBookmark(progress, questId) {
  const normalized = mergeProgress(progress);
  const current = new Set(normalized.bookmarkedQuestIds);
  current.has(questId) ? current.delete(questId) : current.add(questId);
  return { ...normalized, bookmarkedQuestIds: [...current] };
}

export function toggleConfusingQuestion(progress, questionId) {
  const normalized = mergeProgress(progress);
  const current = new Set(normalized.confusingQuestionIds);
  current.has(questionId) ? current.delete(questionId) : current.add(questionId);
  return { ...normalized, confusingQuestionIds: [...current] };
}

export function setProgressSettings(progress, settings) {
  const normalized = mergeProgress(progress);
  return { ...normalized, settings: { ...normalized.settings, ...settings } };
}

export function setDailyGoalTarget(progress, target) {
  const normalized = mergeProgress(progress);
  return {
    ...normalized,
    dailyGoal: { ...normalized.dailyGoal, target: Math.max(1, Math.min(3, Number(target) || 1)) },
  };
}

function currentDailyGoal(progress, date) {
  const key = localDateKey(date);
  return progress.dailyGoal.date === key ? progress.dailyGoal : { ...progress.dailyGoal, date: key, completed: 0 };
}

function updateStreak(streak, date) {
  const today = localDateKey(date);
  if (streak.lastCompletedDate === today) return streak;
  const yesterday = new Date(date);
  yesterday.setDate(yesterday.getDate() - 1);
  const nextCurrent = streak.lastCompletedDate === localDateKey(yesterday) ? streak.current + 1 : 1;
  return { current: nextCurrent, best: Math.max(streak.best, nextCurrent), lastCompletedDate: today };
}

export function completeQuest(progress, questId, { correctAnswers = 0, correctEvidence = 0, questionCount = 3, date = new Date() } = {}) {
  const normalized = mergeProgress(progress);
  const alreadyCompleted = normalized.completedQuestIds.includes(questId);
  const earnedXp = alreadyCompleted ? 0 : 80 + (correctEvidence * 10) + (correctAnswers * 5);
  const badgeIds = new Set(normalized.badgeIds);
  const fragments = new Set(normalized.storyFragmentIds);
  const accessories = new Set(normalized.unlockedAccessoryIds);
  if (!alreadyCompleted) {
    badgeIds.add(BADGES.FIRST_QUEST);
    fragments.add(`fragment-${questId}`);
    accessories.add('trail-ribbon');
    if (correctEvidence === questionCount) badgeIds.add(BADGES.EVIDENCE_EXPLORER);
    if (normalized.completedQuestIds.length + 1 >= 3) {
      badgeIds.add(BADGES.QUEST_CARTOGRAPHER);
      accessories.add('map-pin');
    }
  }
  const dailyGoal = currentDailyGoal(normalized, date);
  return {
    ...normalized,
    xp: normalized.xp + earnedXp,
    lastCompletionXp: earnedXp,
    lastCompletedQuestId: questId,
    completedQuestIds: alreadyCompleted ? normalized.completedQuestIds : [...normalized.completedQuestIds, questId],
    badgeIds: [...badgeIds],
    storyFragmentIds: [...fragments],
    unlockedAccessoryIds: [...accessories],
    activeSession: null,
    dailyGoal: { ...dailyGoal, completed: alreadyCompleted ? dailyGoal.completed : dailyGoal.completed + 1 },
    streak: alreadyCompleted ? normalized.streak : updateStreak(normalized.streak, date),
    signals: {
      ...normalized.signals,
      completedQuestCount: alreadyCompleted ? normalized.signals.completedQuestCount : normalized.signals.completedQuestCount + 1,
    },
  };
}

export function markEvidenceReveal(progress) {
  const normalized = mergeProgress(progress);
  return { ...normalized, signals: { ...normalized.signals, evidenceReveals: normalized.signals.evidenceReveals + 1 } };
}

export function recordReturnVisit(progress) {
  const normalized = mergeProgress(progress);
  return { ...normalized, signals: { ...normalized.signals, returnVisits: normalized.signals.returnVisits + 1 } };
}

export function completeOnboarding(progress) {
  return { ...mergeProgress(progress), onboardingComplete: true };
}

export function createJudgeProgress(quests = []) {
  const firstQuest = quests[0];
  const seeded = createEmptyProgress();
  if (!firstQuest) return { ...seeded, onboardingComplete: true, settings: { ...seeded.settings, judgeMode: true } };
  return {
    ...seeded,
    onboardingComplete: true,
    xp: 105,
    lastCompletionXp: 105,
    lastCompletedQuestId: firstQuest.id,
    selectedQuestId: firstQuest.id,
    completedQuestIds: [firstQuest.id],
    badgeIds: [BADGES.FIRST_QUEST, BADGES.EVIDENCE_EXPLORER],
    storyFragmentIds: [`fragment-${firstQuest.id}`],
    unlockedAccessoryIds: ['trail-ribbon'],
    activeAccessoryId: 'trail-ribbon',
    dailyGoal: { date: localDateKey(), target: 1, completed: 1 },
    streak: { current: 2, best: 2, lastCompletedDate: localDateKey() },
    settings: { ...seeded.settings, judgeMode: true },
    signals: { ...seeded.signals, completedQuestCount: 1, questStarts: 2, evidenceReveals: 3, nextQuestSelections: 2 },
  };
}

export function levelForXp(xp) { return Math.max(1, Math.floor(xp / 100) + 1); }
export function xpIntoLevel(xp) { return xp % 100; }
