import { responseFor } from './progress.js';

export const SKILL_ORDER = ['inference', 'main idea', 'vocabulary', 'evidence'];

export const DISCOVERY_PREVIEWS = [
  { id: 'gutenberg-forest', title: 'The Lantern in the Forest', author: 'LitLearn sample catalog', language: 'English', topic: 'Mystery', rights: 'Metadata preview', source: 'Project Gutenberg connection pending' },
  { id: 'gutenberg-tide', title: 'A Tide Pool Mystery', author: 'LitLearn sample catalog', language: 'English', topic: 'Science', rights: 'Metadata preview', source: 'Project Gutenberg connection pending' },
  { id: 'gutenberg-signal', title: 'The Signal Station', author: 'LitLearn sample catalog', language: 'English', topic: 'Technology', rights: 'Metadata preview', source: 'Project Gutenberg connection pending' },
];

export function humanSkill(skill) {
  return String(skill || 'reading evidence').replaceAll('-', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function questionSkill(question, quest) {
  return question?.skill || question?.targetSkill || quest?.skillTags?.[0] || 'reading evidence';
}

export function isQuestComplete(progress, questId) {
  return progress.completedQuestIds.includes(questId);
}

export function questCompletion(quest, progress) {
  const answered = quest.questions.filter((question) => responseFor(progress, quest.id, question.id)).length;
  return { answered, total: quest.questions.length, percent: quest.questions.length ? Math.round((answered / quest.questions.length) * 100) : 0 };
}

export function skillSummary(quests, progress) {
  const summary = new Map(SKILL_ORDER.map((key) => [key, { key, attempts: 0, correct: 0, evidenceCorrect: 0 }]));
  quests.forEach((quest) => {
    quest.questions.forEach((question) => {
      const key = questionSkill(question, quest);
      if (!summary.has(key)) summary.set(key, { key, attempts: 0, correct: 0, evidenceCorrect: 0 });
      const response = responseFor(progress, quest.id, question.id);
      if (response) {
        const item = summary.get(key);
        item.attempts += 1;
        item.correct += Number(Boolean(response.answerCorrect));
        item.evidenceCorrect += Number(Boolean(response.evidenceCorrect));
      }
    });
  });
  return [...summary.values()];
}

export function recommendQuest(quests, progress, skills = skillSummary(quests, progress)) {
  const active = progress.activeSession && quests.find((quest) => quest.id === progress.activeSession.questId);
  if (active) return { quest: active, reason: `Continue ${active.title} where you left off.`, kind: 'resume' };
  const unfinished = quests.find((quest) => !isQuestComplete(progress, quest.id));
  if (unfinished) return { quest: unfinished, reason: 'A new clue trail is ready for you.', kind: 'new' };
  const leastPracticed = [...skills].filter((skill) => skill.attempts > 0).sort((left, right) => left.attempts - right.attempts)[0];
  const match = leastPracticed && quests.find((quest) => quest.questions.some((question) => questionSkill(question, quest) === leastPracticed.key));
  return { quest: match || quests[0], reason: leastPracticed ? `Practice ${humanSkill(leastPracticed.key)} with a new route.` : 'Choose a quest to begin.', kind: 'practice' };
}

export function filterQuests(quests, filters = {}) {
  const search = String(filters.search || '').trim().toLowerCase();
  return quests.filter((quest) => {
    const searchable = [quest.title, quest.topic, quest.difficulty, ...(quest.skillTags || [])].join(' ').toLowerCase();
    const topicMatch = !filters.topic || quest.topic === filters.topic;
    const skillMatch = !filters.skill || quest.skillTags?.includes(filters.skill) || quest.questions.some((question) => questionSkill(question, quest) === filters.skill);
    const difficultyMatch = !filters.difficulty || quest.difficulty === filters.difficulty;
    const bookmarkedMatch = !filters.bookmarked || filters.bookmarked.includes(quest.id);
    return (!search || searchable.includes(search)) && topicMatch && skillMatch && difficultyMatch && bookmarkedMatch;
  });
}

export function dailyGoalStatus(progress) {
  const goal = progress.dailyGoal;
  return { ...goal, percent: Math.min(100, Math.round((goal.completed / goal.target) * 100)), complete: goal.completed >= goal.target };
}

export function storyArc(quests, progress) {
  return quests.map((quest, index) => ({
    quest,
    state: isQuestComplete(progress, quest.id) ? 'complete' : progress.activeSession?.questId === quest.id ? 'current' : index === 0 || isQuestComplete(progress, quests[index - 1]?.id) ? 'available' : 'locked',
  }));
}

export function coachFallback(question, response) {
  if (!question) return 'Choose a completed question first. The coach can then explain the evidence routine using the local quest feedback.';
  if (!response) return 'Start by making your best answer and choosing one supporting sentence. The coach becomes available after submission.';
  return response.answerCorrect && response.evidenceCorrect
    ? `You connected your answer to a strong clue. ${question.explanation}`
    : `Try the routine again: state the idea, then find the sentence that proves it. ${question.explanation}`;
}

export function discoveryMatches(query) {
  const search = String(query || '').trim().toLowerCase();
  return DISCOVERY_PREVIEWS.filter((item) => !search || Object.values(item).join(' ').toLowerCase().includes(search));
}
