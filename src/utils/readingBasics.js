import basicsBundle from '../../backend/data/reading-basics/lessons.json' with { type: 'json' };

export const READING_BASICS_BUNDLE = basicsBundle;
export const READING_BASICS_LESSONS = basicsBundle.lessons;

export function activityProgressId(activity) {
  return `${activity.id}@${activity.version}`;
}

export function isBasicsActivityComplete(progress, activity) {
  const id = activityProgressId(activity);
  return (progress.readingBasics?.completedActivityIds || []).includes(id);
}

export function recordBasicsAttempt(progress, lesson, activity, { correct = false, answerId = '', evidenceId = '', date = new Date() } = {}) {
  const empty = { completedActivityIds: [], completedLessonIds: [], attempts: {}, earnedActivityXp: [], earnedBadgeIds: [] };
  const basics = { ...empty, ...(progress.readingBasics || {}) };
  const id = activityProgressId(activity);
  const attempts = basics.attempts || {};
  const previous = attempts[id] || { count: 0, lastCorrect: false };
  const firstSuccess = correct && !basics.completedActivityIds.includes(id);
  const completedActivityIds = firstSuccess ? [...basics.completedActivityIds, id] : basics.completedActivityIds;
  const allLessonActivitiesDone = lesson.activities.every((item) => completedActivityIds.includes(activityProgressId(item)));
  const completedLessonIds = allLessonActivitiesDone && !basics.completedLessonIds.includes(lesson.id)
    ? [...basics.completedLessonIds, lesson.id]
    : basics.completedLessonIds;
  const badgeId = `basics-badge:${lesson.id}`;
  return {
    ...progress,
    xp: progress.xp + (firstSuccess ? 15 : 0),
    readingBasics: {
      ...basics,
      completedActivityIds,
      completedLessonIds,
      earnedActivityXp: firstSuccess ? [...basics.earnedActivityXp, id] : basics.earnedActivityXp,
      earnedBadgeIds: allLessonActivitiesDone ? [...new Set([...basics.earnedBadgeIds, badgeId])] : basics.earnedBadgeIds,
      activityVersions: { ...(basics.activityVersions || {}), [activity.id]: activity.version },
      attempts: {
        ...attempts,
        [id]: { version: activity.version, count: previous.count + 1, lastCorrect: Boolean(correct), lastAnswerId: answerId, lastEvidenceId: evidenceId, lastPracticedAt: date.toISOString() },
      },
    },
  };
}
