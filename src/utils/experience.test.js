import assert from 'node:assert/strict';
import test from 'node:test';
import { createEmptyProgress, toggleBookmark } from './progress.js';
import { filterQuests, recommendQuest, storyArc } from './experience.js';

const quests = [
  { id: 'garden', title: 'Night Garden', topic: 'Mystery', difficulty: 'Growing', skillTags: ['inference'], questions: [{ id: 'g-1', skill: 'inference' }] },
  { id: 'signal', title: 'Signal Station', topic: 'Technology', difficulty: 'Challenge', skillTags: ['vocabulary'], questions: [{ id: 's-1', skill: 'vocabulary' }] },
];

test('filters quests by search, topic, skill, difficulty, and bookmark state', () => {
  let progress = createEmptyProgress();
  progress = toggleBookmark(progress, 'signal');
  assert.deepEqual(filterQuests(quests, { search: 'garden' }).map((quest) => quest.id), ['garden']);
  assert.deepEqual(filterQuests(quests, { topic: 'Technology', skill: 'vocabulary', difficulty: 'Challenge' }).map((quest) => quest.id), ['signal']);
  assert.deepEqual(filterQuests(quests, { bookmarked: progress.bookmarkedQuestIds }).map((quest) => quest.id), ['signal']);
});

test('recommends a resumable quest and maps locked story locations', () => {
  const progress = { ...createEmptyProgress(), activeSession: { questId: 'signal', screen: 'reading', questionIndex: 0 }, completedQuestIds: ['garden'] };
  assert.equal(recommendQuest(quests, progress).quest.id, 'signal');
  const arc = storyArc(quests, progress);
  assert.equal(arc[0].state, 'complete');
  assert.equal(arc[1].state, 'current');
});
