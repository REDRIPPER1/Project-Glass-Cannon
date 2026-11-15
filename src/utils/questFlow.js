export function buildSubmittedResponse({ quest, question, answerId, evidenceId, submittedAt = new Date().toISOString() }) {
  if (!quest || !question || !answerId || !evidenceId) return null;
  if (!question.choices?.some((choice) => choice.id === answerId)) return null;
  if (!question.evidenceSentenceIds?.includes(evidenceId)) return null;
  return {
    questId: quest.id,
    questionId: question.id,
    answerId,
    evidenceId,
    answerCorrect: answerId === question.correctChoiceId,
    evidenceCorrect: evidenceId === question.correctEvidenceSentenceId,
    submittedAt,
  };
}

export function responseFeedback(response) {
  if (!response) return null;
  return {
    answerCorrect: Boolean(response.answerCorrect),
    evidenceCorrect: Boolean(response.evidenceCorrect),
    fullySupported: Boolean(response.answerCorrect && response.evidenceCorrect),
  };
}

export function evidenceRevealTarget(quest, question) {
  const sentenceId = question?.correctEvidenceSentenceId;
  const passage = Array.isArray(quest?.passage) ? quest.passage : quest?.passage?.sentences;
  if (!sentenceId || !Array.isArray(passage)) return null;
  const sentence = passage.find((item) => item.id === sentenceId);
  return sentence ? { sentenceId, text: sentence.text } : null;
}
