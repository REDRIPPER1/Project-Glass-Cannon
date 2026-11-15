import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { buildSubmittedResponse, evidenceRevealTarget, responseFeedback } from './questFlow.js';

const quest = { id: 'quest-a', passage: [{ id: 's1', text: 'The lantern was still glowing.' }, { id: 's2', text: 'Mira stepped carefully.' }] };
const question = { id: 'q1', choices: [{ id: 'a1' }, { id: 'a2' }], correctChoiceId: 'a1', evidenceSentenceIds: ['s1', 's2'], correctEvidenceSentenceId: 's1' };

test('submission requires an answer and a valid evidence choice', () => {
  assert.equal(buildSubmittedResponse({ quest, question, answerId: 'a1', evidenceId: '' }), null);
  assert.equal(buildSubmittedResponse({ quest, question, answerId: '', evidenceId: 's1' }), null);
  assert.equal(buildSubmittedResponse({ quest, question, answerId: 'unknown', evidenceId: 's1' }), null);
  assert.equal(buildSubmittedResponse({ quest, question, answerId: 'a1', evidenceId: 'unknown' }), null);
});

test('correct and incorrect submissions retain separate answer and evidence feedback', () => {
  const correct = buildSubmittedResponse({ quest, question, answerId: 'a1', evidenceId: 's1', submittedAt: 'fixed' });
  assert.deepEqual(responseFeedback(correct), { answerCorrect: true, evidenceCorrect: true, fullySupported: true });
  const incorrect = buildSubmittedResponse({ quest, question, answerId: 'a2', evidenceId: 's2', submittedAt: 'fixed' });
  assert.deepEqual(responseFeedback(incorrect), { answerCorrect: false, evidenceCorrect: false, fullySupported: false });
  const correctIdeaWeakProof = buildSubmittedResponse({ quest, question, answerId: 'a1', evidenceId: 's2', submittedAt: 'fixed' });
  assert.deepEqual(responseFeedback(correctIdeaWeakProof), { answerCorrect: true, evidenceCorrect: false, fullySupported: false });
  const weakIdeaStrongProof = buildSubmittedResponse({ quest, question, answerId: 'a2', evidenceId: 's1', submittedAt: 'fixed' });
  assert.deepEqual(responseFeedback(weakIdeaStrongProof), { answerCorrect: false, evidenceCorrect: true, fullySupported: false });
  assert.equal(incorrect.submittedAt, 'fixed');
});

test('evidence reveal points to the exact reviewed passage sentence', () => {
  assert.deepEqual(evidenceRevealTarget(quest, question), { sentenceId: 's1', text: 'The lantern was still glowing.' });
  assert.deepEqual(evidenceRevealTarget({ ...quest, passage: { sentences: quest.passage } }, question), { sentenceId: 's1', text: 'The lantern was still glowing.' });
  assert.equal(evidenceRevealTarget(quest, { ...question, correctEvidenceSentenceId: 'missing' }), null);
});

test('every bundled demo question resolves its exact evidence sentence', () => {
  const dataDirectory = new URL('../../backend/data/', import.meta.url);
  const quests = readdirSync(dataDirectory).filter((file) => /^quest.*\.json$/.test(file)).map((file) => JSON.parse(readFileSync(new URL(file, dataDirectory), 'utf8')));
  const questions = quests.flatMap((bundledQuest) => bundledQuest.questions.map((item) => ({ bundledQuest, item })));
  assert.ok(questions.length > 0);
  for (const { bundledQuest, item } of questions) {
    const target = evidenceRevealTarget(bundledQuest, item);
    assert.ok(target, `${bundledQuest.id}/${item.id} should resolve reviewed evidence`);
    assert.equal(target.sentenceId, item.correctEvidenceSentenceId);
    assert.ok(target.text, `${bundledQuest.id}/${item.id} should have sentence text`);
  }
});
