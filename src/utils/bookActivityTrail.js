export const BOOK_TRAIL_ACTIVITY_TYPES = Object.freeze({
  'mystery-investigation': { label: 'Mystery investigation', icon: '🔎', defaultMode: 'choice', rewardFocus: 'Evidence' },
  'character-choice': { label: 'Character choice', icon: '🧭', defaultMode: 'choice', rewardFocus: 'Understanding' },
  'story-reconstruction': { label: 'Story reconstruction', icon: '🧩', defaultMode: 'order', rewardFocus: 'Understanding' },
  'vocabulary-crafting': { label: 'Vocabulary crafting', icon: '🛠️', defaultMode: 'choice', rewardFocus: 'Understanding' },
  'alternate-ending': { label: 'Alternate ending', icon: '✨', defaultMode: 'creative', rewardFocus: 'Creativity' },
});

const REVIEWED = 'reviewed';
const asArray = (value) => Array.isArray(value) ? value : [];
const unique = (values) => [...new Set(values.filter(Boolean))];
const compactText = (value) => String(value || '').trim();

export function trailActivityProgressId(activity) {
  const bookId = compactText(activity?.bookId || activity?.source?.bookId);
  const chapterId = compactText(activity?.chapterId || activity?.source?.chapterId);
  return `${bookId}:${chapterId}:${compactText(activity?.id)}@${Math.max(1, Number(activity?.version) || 1)}`;
}

export function trailRewardEventId(activity, reward) {
  return `${trailActivityProgressId(activity)}:${compactText(reward?.rewardId || reward?.id)}`;
}

export function trailActivityMode(activity) {
  return compactText(activity?.task?.mode) || BOOK_TRAIL_ACTIVITY_TYPES[activity?.activityType]?.defaultMode || 'choice';
}

function inheritedActivity(activity, parent, chapter) {
  const source = { ...(parent?.source || {}), ...(chapter?.source || {}), ...(activity?.source || {}) };
  return {
    ...parent,
    ...chapter,
    ...activity,
    bookId: activity?.bookId || chapter?.bookId || parent?.bookId || source.bookId,
    chapterId: activity?.chapterId || chapter?.chapterId || parent?.chapterId || source.chapterId,
    edition: activity?.edition || chapter?.edition || parent?.edition || source.edition,
    sourceLabel: activity?.sourceLabel || chapter?.sourceLabel || parent?.sourceLabel || source.sourceLabel,
    source,
    task: { ...(parent?.task || {}), ...(chapter?.task || {}), ...(activity?.task || {}) },
  };
}

function flattenPayload(payload) {
  if (!payload || typeof payload !== 'object') return [];
  const grouped = asArray(payload.chapters).flatMap((chapter) => asArray(chapter?.activities).map((activity) => inheritedActivity(activity, payload, chapter)));
  if (grouped.length) return grouped;
  if (Array.isArray(payload.activities)) return payload.activities.map((activity) => inheritedActivity(activity, payload, null));
  return [inheritedActivity(payload, null, null)];
}

export function reviewedChapterTrailActivities(payloads, bookId, chapterId, context = {}) {
  return unique(asArray(payloads)
    .flatMap(flattenPayload)
    .map((activity) => inheritedActivity({
      ...activity,
      bookId: activity.bookId || bookId,
      chapterId: activity.chapterId || chapterId,
      edition: activity.edition || context.edition,
      sourceLabel: activity.sourceLabel || context.sourceLabel,
      source: { ...(context.source || {}), ...(activity.source || {}) },
    }, null, null))
    .filter((activity) => activity.bookId === bookId && activity.chapterId === chapterId)
    .filter((activity) => activity.reviewStatus === REVIEWED)
    .filter((activity) => BOOK_TRAIL_ACTIVITY_TYPES[activity.activityType])
    .filter((activity) => compactText(activity.id) && compactText(activity.sourceLabel) && compactText(activity.edition))
    .map((activity) => JSON.stringify(activity)))
    .map((serialized) => JSON.parse(serialized))
    .sort((first, second) => compactText(first.id).localeCompare(compactText(second.id)));
}

export function isTrailActivityComplete(progress, activity) {
  return asArray(progress?.bookActivityTrail?.completedActivityIds).includes(trailActivityProgressId(activity));
}

export function chapterTrailProgress(progress, activities) {
  const reviewed = asArray(activities);
  const complete = reviewed.filter((activity) => isTrailActivityComplete(progress, activity)).length;
  return { complete, total: reviewed.length, isComplete: reviewed.length > 0 && complete === reviewed.length };
}

function requiredEvidence(activity) {
  return unique(asArray(activity?.task?.correctEvidenceSentenceIds || activity?.correctEvidenceSentenceIds));
}

function expectedOrder(activity) {
  return asArray(activity?.task?.correctOrderIds || activity?.correctOrderIds);
}

function selectedEvidence(response) {
  return unique(asArray(response?.evidenceSentenceIds));
}

function sameSet(first, second) {
  return first.length === second.length && first.every((item) => second.includes(item));
}

function sameOrder(first, second) {
  return first.length === second.length && first.every((item, index) => item === second[index]);
}

export function validateTrailResponse(activity, response = {}) {
  const mode = trailActivityMode(activity);
  const evidenceIds = selectedEvidence(response);
  const required = requiredEvidence(activity);
  const evidenceValid = required.length > 0 && sameSet(evidenceIds, required);
  const responseText = compactText(response.responseText);
  const minimum = Math.max(1, Number(activity?.task?.minCharacters) || 1);
  const orderIds = asArray(response.orderIds);
  let answerValid = false;

  if (mode === 'creative') answerValid = responseText.length >= minimum;
  else if (mode === 'order') answerValid = sameOrder(orderIds, expectedOrder(activity));
  else answerValid = compactText(response.choiceId) === compactText(activity?.task?.correctChoiceId || activity?.correctChoiceId);

  return {
    mode,
    answerValid,
    evidenceValid,
    complete: answerValid && evidenceValid,
    needsAnswer: !answerValid,
    needsEvidence: !evidenceValid,
  };
}

function rewardEvents(activity) {
  const listed = asArray(activity?.rewardEvents || activity?.rewards);
  return listed.length ? listed : activity?.reward ? [activity.reward] : [];
}

function rewardXp(reward) {
  if (reward?.currency || reward?.itemId || reward?.inventoryItemId || reward?.rewardId === 'quest-wishlist-page') return 0;
  return Math.max(0, Number(reward?.xp ?? reward?.quantity) || 0);
}

function rewardPatch(progress, rewards) {
  let currencies = progress.currencies || { gold: 0, diamonds: 0 };
  let inventory = progress.inventory || { wishlistPages: 0 };
  for (const reward of rewards) {
    const currency = reward.currency;
    if (currency === 'gold' || currency === 'diamonds') currencies = { ...currencies, [currency]: (Number(currencies[currency]) || 0) + Math.max(0, Number(reward.quantity) || 0) };
    if (reward.rewardId === 'quest-wishlist-page' || reward.itemId === 'quest-wishlist-page' || reward.inventoryItemId === 'quest-wishlist-page') inventory = { ...inventory, wishlistPages: (Number(inventory.wishlistPages) || 0) + Math.max(0, Number(reward.quantity) || 0) };
  }
  return { currencies, inventory };
}

export function recordTrailActivityAttempt(progress, activity, response = {}, { date = new Date(), chapterActivities = [], completion = null } = {}) {
  const current = progress || {};
  const trail = {
    completedActivityIds: [],
    completedChapterIds: [],
    attempts: {},
    earnedRewardEventIds: [],
    activityVersions: {},
    ...(current.bookActivityTrail || {}),
  };
  const id = trailActivityProgressId(activity);
  const result = completion || validateTrailResponse(activity, response);
  const previous = trail.attempts[id] || { count: 0 };
  const firstCompletion = result.complete && !trail.completedActivityIds.includes(id);
  const eligibleRewards = firstCompletion ? rewardEvents(activity).filter((reward) => {
    if (!compactText(reward.rewardId || reward.id)) return false;
    return reward.kind !== 'persistence' || previous.count > 0;
  }) : [];
  const earnedRewardEventIds = unique([...trail.earnedRewardEventIds, ...eligibleRewards.map((reward) => trailRewardEventId(activity, reward))]);
  const completedActivityIds = firstCompletion ? unique([...trail.completedActivityIds, id]) : trail.completedActivityIds;
  const chapterProgress = chapterTrailProgress({ bookActivityTrail: { ...trail, completedActivityIds } }, chapterActivities);
  const chapterKey = `${activity.bookId}:${activity.chapterId}`;
  const completedChapterIds = chapterProgress.isComplete ? unique([...trail.completedChapterIds, chapterKey]) : trail.completedChapterIds;
  const awardedXp = eligibleRewards.reduce((total, reward) => total + rewardXp(reward), 0);
  const patch = rewardPatch(current, eligibleRewards);

  return {
    ...current,
    xp: (Number(current.xp) || 0) + awardedXp,
    currencies: patch.currencies,
    inventory: patch.inventory,
    bookActivityTrail: {
      ...trail,
      completedActivityIds,
      completedChapterIds,
      earnedRewardEventIds,
      activityVersions: { ...trail.activityVersions, [activity.id]: Math.max(1, Number(activity.version) || 1) },
      attempts: {
        ...trail.attempts,
        [id]: {
          version: Math.max(1, Number(activity.version) || 1),
          count: (Number(previous.count) || 0) + 1,
          lastCorrect: result.complete,
          lastChoiceId: compactText(response.choiceId),
          lastEvidenceSentenceIds: selectedEvidence(response),
          lastOrderIds: asArray(response.orderIds),
          responseProvided: Boolean(compactText(response.responseText)),
          lastPracticedAt: date.toISOString(),
        },
      },
    },
  };
}

export function activityAttemptId(activity, attemptNumber = 1) {
  const number = Math.max(1, Number(attemptNumber) || 1);
  return `litlab-${trailActivityProgressId(activity).replace(/[^a-zA-Z0-9:@.-]/g, '-')}:attempt-${number}`;
}
