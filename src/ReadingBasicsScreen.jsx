import { useMemo, useState } from 'react';
import { activityProgressId, isBasicsActivityComplete, READING_BASICS_LESSONS, recordBasicsAttempt } from './utils/readingBasics.js';

const TYPE_LABELS = {
  'clue-hunt': 'Clue Hunt', 'timeline-repair': 'Timeline Repair', 'character-connections': 'Character Connections',
  'context-clues': 'Context Word Forge', 'prediction-path': 'Prediction Path', 'scene-reconstruction': 'Scene Builder',
  'story-quest': 'Story Quest', 'creative-response': 'Creative Response',
};

export default function ReadingBasicsScreen({ progress, onUpdate, onNavigate }) {
  const [selectedId, setSelectedId] = useState(READING_BASICS_LESSONS[0].id);
  const [selectedActivityId, setSelectedActivityId] = useState(READING_BASICS_LESSONS[0].activities[0].id);
  const [answerId, setAnswerId] = useState('');
  const [evidenceId, setEvidenceId] = useState('');
  const [timelineOrder, setTimelineOrder] = useState([]);
  const [result, setResult] = useState(null);
  const basics = progress.readingBasics || { completedActivityIds: [], completedLessonIds: [], attempts: {}, earnedActivityXp: [], earnedBadgeIds: [] };
  const lesson = useMemo(() => READING_BASICS_LESSONS.find((item) => item.id === selectedId) || READING_BASICS_LESSONS[0], [selectedId]);
  const activity = lesson.activities.find((item) => item.id === selectedActivityId) || lesson.activities[0];
  const task = activity.task;
  const sourceLines = activity.source.passage || [];
  const done = isBasicsActivityComplete(basics, activity);
  const completedLessons = READING_BASICS_LESSONS.filter((item) => item.activities.every((a) => isBasicsActivityComplete(basics, a))).length;
  const evidenceOptions = task.evidenceOptions || [];

  function resetAttempt() { setAnswerId(''); setEvidenceId(''); setResult(null); }
  function seedTimeline(next) { setTimelineOrder(next.type === 'timeline-repair' ? [...(next.source.passage || [])].map((line) => line.id).reverse() : []); }
  function selectLesson(next) { setSelectedId(next.id); setSelectedActivityId(next.activities[0].id); resetAttempt(); seedTimeline(next.activities[0]); }
  function selectActivity(next) { setSelectedActivityId(next.id); resetAttempt(); seedTimeline(next); }
  function submit() {
    const evidenceCorrect = activity.completionRule?.kind !== 'correct-answer-and-evidence'
      || (activity.task.correctEvidenceSentenceIds || []).includes(evidenceId);
    const timelineCorrect = activity.type !== 'timeline-repair' || timelineOrder.every((id, index) => id === sourceLines[index]?.id);
    const answerCorrect = activity.type === 'timeline-repair' ? timelineCorrect : answerId === task.correctChoiceId;
    const correct = answerCorrect && evidenceCorrect;
    const firstReward = correct && !done;
    onUpdate((current) => recordBasicsAttempt(current, lesson, activity, { correct, answerId: activity.type === 'timeline-repair' ? (timelineCorrect ? task.correctChoiceId : 'timeline-order-miss') : answerId, evidenceId }));
    setResult({ correct, firstReward });
  }
  function moveTimeline(index, direction) {
    const target = index + direction;
    if (target < 0 || target >= timelineOrder.length) return;
    setTimelineOrder((current) => { const next = [...current]; [next[index], next[target]] = [next[target], next[index]]; return next; });
  }

  return <section className="basics-page" aria-labelledby="basics-title">
    <header className="basics-hero"><div><p className="eyebrow">Your reading adventure toolkit</p><h1 id="basics-title">Reading Basics</h1><p>Learn a skill, try it in a tiny story challenge, then come back whenever you want a refresher.</p></div><div className="basics-progress" aria-label={`${completedLessons} of ${READING_BASICS_LESSONS.length} lessons complete`}><strong>{completedLessons}/{READING_BASICS_LESSONS.length}</strong><span>skills learned</span><i><b style={{ width: `${completedLessons / READING_BASICS_LESSONS.length * 100}%` }} /></i></div></header>
    <p className="basics-loop">Read <span>→</span> Notice <span>→</span> Find proof <span>→</span> Explain <span>→</span> Grow</p>
    <div className="basics-layout">
      <nav className="basics-skill-map" aria-label="Reading Basics lessons"><h2>Skill trail</h2>{READING_BASICS_LESSONS.map((item, index) => { const complete = item.activities.every((a) => isBasicsActivityComplete(basics, a)); return <button key={item.id} type="button" className={item.id === lesson.id ? 'is-selected' : ''} aria-current={item.id === lesson.id ? 'step' : undefined} onClick={() => selectLesson(item)}><span className="basics-node">{complete ? '✓' : String(index + 1).padStart(2, '0')}</span><span><strong>{item.title}</strong><small>{item.skill.replaceAll('-', ' ')}</small></span></button>; })}</nav>
      <article className="basics-lesson" aria-labelledby="lesson-title">
        <div className="basics-lesson-top"><div><p className="eyebrow">{lesson.skill.replaceAll('-', ' ')} · lesson {lesson.version}</p><h2 id="lesson-title">{lesson.title}</h2></div><span className={`basics-status ${done ? 'is-done' : ''}`}>{done ? 'Activity cleared' : 'Ready to learn'}</span></div>
        <section className="basics-teach"><h3>Learn the move</h3><p>{lesson.explanation}</p><div><strong>Worked example: {lesson.workedExample.title}</strong><p><b>Notice:</b> {lesson.workedExample.notice}</p><p><b>Think:</b> {lesson.workedExample.think}</p><p><b>Prove:</b> {lesson.workedExample.prove}</p><p><b>Example:</b> {lesson.workedExample.answer}</p></div></section>
        <section className="basics-game" aria-labelledby="basics-game-title"><div className="basics-game-title"><span aria-hidden="true">✦</span><div><p className="eyebrow">Mini game · {TYPE_LABELS[activity.type] || activity.type}</p><h3 id="basics-game-title">{activity.correctFeedback.title}</h3></div></div>
          <p className="activity-source">{activity.source.attribution}</p>
          <div className="basics-passage" aria-label="Original practice passage">{sourceLines.map((line, index) => { const highlighted = result && !result.hint && activity.task.correctEvidenceSentenceIds.includes(line.id); return <p key={line.id} className={highlighted ? 'is-highlighted' : ''}><span>{index + 1}</span>{line.text}</p>; })}</div>
          <h4>{activity.prompt} {task.question}</h4>
          {activity.type === 'timeline-repair' ? <ol className="timeline-repair basics-timeline">{timelineOrder.map((sentenceId, index) => <li key={sentenceId}><span>{sourceLines.find((line) => line.id === sentenceId)?.text}</span><div><button type="button" aria-label={`Move event ${index + 1} up`} disabled={index === 0 || Boolean(result)} onClick={() => moveTimeline(index, -1)}>↑</button><button type="button" aria-label={`Move event ${index + 1} down`} disabled={index === timelineOrder.length - 1 || Boolean(result)} onClick={() => moveTimeline(index, 1)}>↓</button></div></li>)}</ol> : <fieldset className="basics-options"><legend>Choose your answer</legend>{task.choices.map((option) => <label key={option.id} className={answerId === option.id ? 'is-picked' : ''}><input type="radio" name={`answer-${activity.id}`} checked={answerId === option.id} disabled={Boolean(result)} onChange={() => setAnswerId(option.id)} /><span>{option.text}</span></label>)}</fieldset>}
          {evidenceOptions.length > 0 && <fieldset className="basics-options"><legend>Choose the sentence that best supports your answer</legend>{evidenceOptions.map((option) => <label key={option.sentenceId} className={evidenceId === option.sentenceId ? 'is-picked' : ''}><input type="radio" name={`evidence-${activity.id}`} checked={evidenceId === option.sentenceId} disabled={Boolean(result)} onChange={() => setEvidenceId(option.sentenceId)} /><span>{option.text}</span></label>)}</fieldset>}
          {!result ? <div className="basics-actions"><button className="primary-button" type="button" disabled={(activity.type === 'timeline-repair' ? timelineOrder.length === 0 : !answerId) || (activity.completionRule?.kind === 'correct-answer-and-evidence' && !evidenceId)} onClick={submit}>{activity.type === 'timeline-repair' ? 'Check the timeline' : 'Check my idea'}</button><button className="text-button" type="button" onClick={() => setResult({ hint: true })}>Give me a hint</button></div> : result.hint ? <div className="basics-hint" role="status"><strong>Hint:</strong> {activity.hint}<button type="button" className="text-button" onClick={() => setResult(null)}>Back to challenge</button></div> : <div className={`basics-feedback ${result.correct ? 'is-correct' : 'is-retry'}`} role="status" aria-live="polite"><strong>{result.correct ? activity.correctFeedback.title : 'Not quite—try another clue.'}</strong><p>{result.correct ? activity.correctFeedback.message : activity.hint}</p><p><b>Why:</b> {task.explanation}</p><p><b>Your evidence:</b> {sourceLines.find((line) => line.id === evidenceId)?.text || 'No evidence sentence selected.'}</p><p><b>Strongest clue:</b> {activity.task.correctEvidenceSentenceIds.map((id) => sourceLines.find((line) => line.id === id)?.text).filter(Boolean).map((text) => `“${text}”`).join(' ')}</p>{result.correct && <div className="basics-route-consequence"><span aria-hidden="true">✦</span><strong>{activity.type === 'story-quest' ? 'Story route opened' : activity.type === 'scene-reconstruction' ? 'Scene restored' : activity.type === 'timeline-repair' ? 'Timeline repaired' : 'Clue trail advanced'}</strong></div>}{result.firstReward && <p className="basics-xp">+15 XP · first clear for this activity</p>}{!result.correct && <p>No XP this try; retries and hints are always free. Your practice was saved.</p>}{result.correct ? <button className="secondary-button" type="button" onClick={resetAttempt}>Practice again</button> : <button className="primary-button" type="button" onClick={resetAttempt}>Try another route</button>}</div>}
        </section>
        <nav className="basics-activity-nav" aria-label={`${lesson.title} activities`}>{lesson.activities.map((item, index) => <button key={item.id} type="button" aria-current={item.id === activity.id ? 'step' : undefined} className={item.id === activity.id ? 'is-selected' : ''} onClick={() => selectActivity(item)}><span>{isBasicsActivityComplete(basics, item) ? '✓' : index + 1}</span>{TYPE_LABELS[item.type] || item.type}</button>)}</nav>
        <footer className="basics-lesson-footer"><span>Trail badge: <strong>{lesson.title}</strong> · {basics.earnedBadgeIds?.includes(`basics-badge:${lesson.id}`) ? 'collected' : 'earn by clearing every activity'}</span>{done && <span>Completed before · replay anytime</span>}</footer>
      </article>
    </div>
    <div className="basics-bottom"><p>These are practice signals, not a grade or diagnosis. Mistakes are clues for what to try next.</p><button className="secondary-button" type="button" onClick={() => onNavigate('home')}>Back to the quest map</button></div>
  </section>;
}
