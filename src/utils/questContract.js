/*
 * ReadQuest seed-content boundary. The content owner supplies
 * backend/data/quest-1.json; Vite imports it at build time so the learner flow
 * remains local when the API is unavailable.
 */
const bundledModules = import.meta.glob('../../backend/data/quest-1.json', {
  eager: true,
  import: 'default',
});

function normalizeQuest(quest) {
  if (!quest) return null;
  const sourceSentences = Array.isArray(quest.passage)
    ? quest.passage
    : (quest.passage?.sentences ?? []);
  const workedEvidenceId = quest.workedExample?.evidenceSentenceId ?? quest.workedExample?.evidence;
  const workedEvidenceText = sourceSentences.find((sentence) => sentence.id === workedEvidenceId)?.text;
  return {
    ...quest,
    readingTimeMinutes: quest.readingTimeMinutes ?? quest.estimatedMinutes,
    passage: { ...(Array.isArray(quest.passage) ? {} : quest.passage), sentences: sourceSentences },
    source: quest.source ? {
      ...quest.source,
      sourceType: quest.source.sourceType ?? (quest.source.bookTitle ? 'public-domain-book-excerpt' : 'original'),
    } : quest.source,
    workedExample: quest.workedExample ? {
      ...quest.workedExample,
      title: quest.workedExample.title ?? 'Try the evidence routine',
      notice: quest.workedExample.notice ?? quest.workedExample.prompt,
      think: quest.workedExample.think ?? quest.workedExample.reasoning,
      prove: quest.workedExample.prove ?? quest.workedExample.evidence,
      evidence: workedEvidenceText ?? quest.workedExample.evidence,
    } : quest.workedExample,
    questions: quest.questions?.map((question) => ({
      ...question,
      skill: question.skill ?? question.targetSkill,
      evidenceSentenceIds: question.evidenceSentenceIds
        ?? question.evidenceOptions?.map((option) => (typeof option === 'string' ? option : option.sentenceId)),
    })),
  };
}

export const BUNDLED_QUEST = normalizeQuest(Object.values(bundledModules)[0] ?? null);

export const QUEST_CONTRACT = {
  quest: ['id', 'title', 'topic', 'difficulty', 'readingTimeMinutes', 'skillTags', 'passage.sentences[{id,text}]', 'workedExample', 'source', 'questions'],
  source: ['sourceType', 'rightsStatus', 'license', 'requiredAttribution'],
  bookExcerptSource: ['bookTitle', 'edition', 'chapter', 'sourceUrl', 'rightsStatus', 'license', 'requiredAttribution', 'territory'],
  question: ['id', 'prompt', 'choices[{id,text}]', 'correctChoiceId', 'evidenceSentenceIds', 'correctEvidenceSentenceId', 'explanation', 'followUpSuggestion', 'storyConsequence'],
};

export function sentencesFor(quest) { return Array.isArray(quest?.passage?.sentences) ? quest.passage.sentences : []; }
export function sentenceById(quest, sentenceId) { return sentencesFor(quest).find((sentence) => sentence.id === sentenceId); }
export function choiceById(question, choiceId) { return question?.choices?.find((choice) => choice.id === choiceId); }

export function rightsStatus(quest) {
  if (!quest) return { ready: false, message: 'Waiting for reviewed quest content.' };
  const source = quest.source;
  if (!source) return { ready: false, message: 'The quest needs source and rights metadata.' };

  const isBookExcerpt = source.sourceType === 'book-excerpt'
    || source.sourceType === 'public-domain-book-excerpt'
    || Boolean(source.bookTitle);
  if (isBookExcerpt) {
    const fields = ['bookTitle', 'edition', 'chapter', 'sourceUrl', 'publicDomainBasis', 'license', 'requiredAttribution', 'territory'];
    const missing = fields.filter((field) => !source[field]);
    if (source.rightsStatus !== 'verified' || missing.length > 0) {
      return { ready: false, message: 'This book excerpt will stay hidden until its exact edition and reuse rights are verified.' };
    }
  } else if (!['original', 'verified-public-domain', 'licensed'].includes(source.rightsStatus)) {
    return { ready: false, message: 'The passage rights status must be reviewed before it can be shown.' };
  }

  const sentences = sentencesFor(quest);
  if (!quest.id || !quest.title || sentences.length === 0 || !Array.isArray(quest.questions)) return { ready: false, message: 'The quest data is incomplete.' };
  if (quest.questions.length !== 3) return { ready: false, message: 'The demo needs exactly three reviewed questions.' };

  const sentenceIds = new Set(sentences.map((sentence) => sentence.id));
  const invalidQuestion = quest.questions.find((question) => (
    !question.id || !question.prompt || !Array.isArray(question.choices) || !question.correctChoiceId
    || !Array.isArray(question.evidenceSentenceIds) || !sentenceIds.has(question.correctEvidenceSentenceId)
    || question.evidenceSentenceIds.some((id) => !sentenceIds.has(id)) || !question.explanation
    || !question.followUpSuggestion || !question.storyConsequence
  ));
  return invalidQuestion
    ? { ready: false, message: 'At least one question is missing reviewed answer, evidence, or feedback data.' }
    : { ready: true, message: 'Reviewed local quest ready.' };
}
