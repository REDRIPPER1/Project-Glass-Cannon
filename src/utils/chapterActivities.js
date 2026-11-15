const ACTIVITY_DEFINITIONS = [
  { id: 'story', label: 'Story quest', types: ['story-quest'] },
  { id: 'evidence', label: 'Evidence', types: ['evidence-collection'] },
  { id: 'characters', label: 'Character map', types: ['character-map'] },
  { id: 'pause', label: 'Chapter pause', types: ['chapter-choice'] },
  { id: 'vocabulary', label: 'Vocabulary', types: ['vocabulary-in-context'] },
  { id: 'scene', label: 'Scene build', types: ['scene-reconstruction'] },
  { id: 'creative', label: 'Create', types: ['creative-response'] },
  { id: 'world', label: 'World map', types: ['book-world-map'] },
];

function reviewedTypes(payload) {
  if (!payload || (payload.reviewStatus && payload.reviewStatus !== 'reviewed')) return [];
  const nested = Array.isArray(payload.activities) ? payload.activities : [];
  const listed = Array.isArray(payload.activityTypes) ? payload.activityTypes : [];
  return [
    payload.activityType,
    ...listed,
    ...nested.map((activity) => typeof activity === 'string' ? activity : activity?.activityType),
  ].filter((type) => typeof type === 'string' && type.trim());
}

export function supportedChapterActivities({ activityPayload, quiz, quest }) {
  const approvedTypes = new Set([
    ...reviewedTypes(activityPayload),
    ...reviewedTypes(quiz),
  ]);

  // An exact mapped quest already supplies reviewed answer and evidence keys.
  if (quest?.id) {
    approvedTypes.add('story-quest');
    approvedTypes.add('evidence-collection');
  }

  return ACTIVITY_DEFINITIONS.filter((definition) => definition.types.some((type) => approvedTypes.has(type)));
}

export function chapterActivitySource(book, chapter, activityPayload, quiz) {
  return activityPayload?.sourceLabel
    || quiz?.sourceLabel
    || `${book.title} · ${book.edition || 'approved edition'} · ${chapter.title}`;
}
