import { useEffect, useMemo, useState } from 'react';
import { completeChapterActivity, loadChapterActivity } from './utils/libraryApi';
import {
  BOOK_TRAIL_ACTIVITY_TYPES,
  activityAttemptId,
  chapterTrailProgress,
  isTrailActivityComplete,
  recordTrailActivityAttempt,
  trailActivityMode,
  validateTrailResponse,
} from './utils/bookActivityTrail';

const asArray = (value) => Array.isArray(value) ? value : [];
const text = (value) => String(value || '').trim();

function exactSource(activity, book, chapter) {
  return activity.sourceLabel || activity.source?.sourceLabel || `${book.title} · ${activity.edition || book.edition || 'approved edition'} · ${chapter.title}`;
}

function feedbackCopy(result, activity, valid) {
  const supplied = valid
    ? result?.feedback?.correct || result?.feedback?.message || result?.feedback || activity.feedback?.correct || activity.feedback?.message || activity.feedback
    : result?.feedback?.tryAgain || result?.feedback?.incorrect || activity.feedback?.tryAgain || activity.feedback?.incorrect;
  if (typeof supplied === 'string' && supplied.trim()) return supplied;
  return valid ? 'Nice reasoning. Your response and evidence match the reviewed chapter activity.' : 'Return to the chapter and try a different response or evidence sentence.';
}

function responseFor(form, activity) {
  return {
    choiceId: form.choiceId,
    evidenceSentenceIds: form.evidenceSentenceIds,
    orderIds: form.orderIds,
    responseText: form.responseText,
    activityId: activity.id,
  };
}

function blankResponse() {
  return { choiceId: '', evidenceSentenceIds: [], orderIds: [], responseText: '' };
}

function rewardSummary(activity, awardedXp) {
  const reward = asArray(activity.rewardEvents || activity.rewards).length ? asArray(activity.rewardEvents || activity.rewards) : activity.reward ? [activity.reward] : [];
  const areas = [...new Set(reward.map((item) => text(item.kind)).filter(Boolean))];
  const pages = reward.filter((item) => item.rewardId === 'quest-wishlist-page' || item.itemId === 'quest-wishlist-page').reduce((total, item) => total + Math.max(0, Number(item.quantity) || 0), 0);
  if (pages > 0) return `+${pages} Wishlist Page${pages === 1 ? '' : 's'} for ${areas.join(', ') || 'careful reading'}.`;
  if (awardedXp > 0) return `+${awardedXp} XP for ${areas.join(', ') || 'careful reading'}.`;
  return areas.length ? `Reward focus: ${areas.join(', ')}.` : 'Practice saved with no speed bonus.';
}

function ChoiceTask({ activity, form, onChange }) {
  const choices = asArray(activity.task?.choices);
  return <fieldset className="trail-fieldset">
    <legend>{activity.task?.prompt || activity.task?.question || activity.prompt || 'Choose the strongest answer'}</legend>
    <div className="trail-choice-list">
      {choices.map((choice) => <label key={choice.id} className={`choice-card ${form.choiceId === choice.id ? 'selected' : ''}`}>
        <input type="radio" name={`trail-answer-${activity.id}`} value={choice.id} checked={form.choiceId === choice.id} onChange={() => onChange({ ...form, choiceId: choice.id })} />
        <span>{choice.text || choice.label}</span>
      </label>)}
    </div>
  </fieldset>;
}

function OrderTask({ activity, form, onChange }) {
  const items = asArray(activity.task?.items);
  const unused = items.filter((item) => !form.orderIds.includes(item.id));
  const ordered = form.orderIds.map((id) => items.find((item) => item.id === id)).filter(Boolean);
  const move = (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= form.orderIds.length) return;
    const next = [...form.orderIds];
    [next[index], next[target]] = [next[target], next[index]];
    onChange({ ...form, orderIds: next });
  };
  return <fieldset className="trail-fieldset">
    <legend>{activity.task?.prompt || activity.prompt || 'Rebuild the chapter events in order'}</legend>
    <p className="quiet">Add each reviewed event, then use the move controls to put your reconstruction in order.</p>
    <div className="trail-event-bank" aria-label="Events to add to the reconstruction">
      {unused.map((item) => <button key={item.id} type="button" className="secondary-button" onClick={() => onChange({ ...form, orderIds: [...form.orderIds, item.id] })}>Add: {item.label || item.text}</button>)}
    </div>
    <ol className="trail-order-list" aria-label="Your event order">
      {ordered.map((item, index) => <li key={item.id}><span><strong>{index + 1}.</strong> {item.label || item.text}</span><div className="trail-order-controls"><button type="button" className="icon-button" aria-label={`Move event ${index + 1} up`} disabled={index === 0} onClick={() => move(index, -1)}>↑</button><button type="button" className="icon-button" aria-label={`Move event ${index + 1} down`} disabled={index === ordered.length - 1} onClick={() => move(index, 1)}>↓</button><button type="button" className="text-button" onClick={() => onChange({ ...form, orderIds: form.orderIds.filter((id) => id !== item.id) })}>Remove</button></div></li>)}
    </ol>
  </fieldset>;
}

function CreativeTask({ activity, form, onChange }) {
  const minimum = Math.max(1, Number(activity.task?.minCharacters) || 1);
  return <label className="trail-creative-label">{activity.task?.responsePrompt || activity.task?.prompt || activity.prompt || 'Write an evidence-based alternate ending'}
    <textarea value={form.responseText} onChange={(event) => onChange({ ...form, responseText: event.target.value.slice(0, 750) })} maxLength="750" placeholder="Use a chapter detail to ground your idea." />
    <small>{form.responseText.length}/750 · write at least {minimum} character{minimum === 1 ? '' : 's'} · saved only after you submit</small>
  </label>;
}

function EvidenceTask({ activity, sentences, form, onChange }) {
  const options = asArray(activity.task?.evidenceOptions);
  const toggleEvidence = (sentenceId) => {
    const selected = new Set(form.evidenceSentenceIds);
    selected.has(sentenceId) ? selected.delete(sentenceId) : selected.add(sentenceId);
    onChange({ ...form, evidenceSentenceIds: [...selected] });
  };
  return <fieldset className="trail-evidence-fieldset">
    <legend>Find the exact text evidence</legend>
    <p>Choose every sentence that proves your response. You can return to the chapter text at any time.</p>
    <div className="evidence-pick-list">
      {options.map((option) => {
        const id = typeof option === 'string' ? option : option.sentenceId || option.id;
        const sentence = sentences.find((item) => item.id === id);
        const selected = form.evidenceSentenceIds.includes(id);
        return <button key={id} type="button" aria-pressed={selected} onClick={() => toggleEvidence(id)}><strong>{id}</strong> {typeof option === 'string' ? sentence?.text || `Sentence ${id}` : option.text || sentence?.text || `Sentence ${id}`}</button>;
      })}
    </div>
  </fieldset>;
}

export default function BookActivityTrail({ book, chapter, activities, sentences = [], progress, profileId, onUpdate, onStatus, onChapterRead }) {
  const [selectedId, setSelectedId] = useState(() => activities[0]?.id || '');
  const [loaded, setLoaded] = useState({});
  const [loadState, setLoadState] = useState({ kind: 'idle', message: '' });
  const [form, setForm] = useState(blankResponse);
  const [feedback, setFeedback] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const selectedSummary = activities.find((activity) => activity.id === selectedId) || activities[0] || null;
  const selected = selectedSummary ? (loaded[selectedSummary.id] || selectedSummary) : null;
  const source = selected ? exactSource(selected, book, chapter) : '';
  const chapterProgress = useMemo(() => chapterTrailProgress(progress, activities), [progress, activities]);
  const activityMode = selected ? trailActivityMode(selected) : 'choice';
  const hasTask = selected && selected.task && (selected.task.prompt || selected.task.question || selected.task.responsePrompt || selected.task.choices || selected.task.items);

  useEffect(() => {
    setSelectedId(activities[0]?.id || '');
    setLoaded({});
    setForm(blankResponse());
    setFeedback(null);
    setLoadState({ kind: 'idle', message: '' });
  }, [book.id, chapter.id]);

  const selectActivity = async (summary) => {
    setSelectedId(summary.id);
    setForm(blankResponse());
    setFeedback(null);
    if (loaded[summary.id] || summary.task?.prompt || summary.task?.choices || summary.task?.items || summary.task?.responsePrompt) return;
    if (!profileId) {
      setLoadState({ kind: 'offline', message: 'This reviewed activity needs LitLab’s catalog connection. The chapter text remains available in the reader.' });
      return;
    }
    setLoadState({ kind: 'loading', message: '' });
    try {
      const result = await loadChapterActivity(profileId, book.id, chapter.id, summary.id);
      const detail = result?.activity || result;
      if (!detail?.task || detail.reviewStatus !== 'reviewed') throw new Error('unavailable_activity');
      setLoaded((current) => ({ ...current, [summary.id]: { ...summary, ...detail, task: { ...summary.task, ...detail.task } } }));
      setLoadState({ kind: 'ready', message: '' });
    } catch {
      setLoadState({ kind: 'error', message: 'The reviewed activity could not be loaded. Your chapter progress is still safe.' });
    }
  };

  const submit = async () => {
    if (!selected || !hasTask) return;
    const response = responseFor(form, selected);
    const hasAnswer = activityMode === 'creative' ? text(response.responseText).length >= Math.max(1, Number(selected.task?.minCharacters) || 1) : activityMode === 'order' ? response.orderIds.length > 0 : Boolean(text(response.choiceId));
    const hasEvidence = response.evidenceSentenceIds.length > 0;
    if (!hasAnswer || !hasEvidence) {
      const message = !hasAnswer && !hasEvidence ? 'Choose a response and at least one exact evidence sentence first.' : !hasAnswer ? 'Finish your response before checking feedback.' : 'Choose at least one exact evidence sentence before checking feedback.';
      setFeedback({ kind: 'needs-work', message });
      return;
    }
    setIsSubmitting(true);
    let serverResult = null;
    let completion = null;
    if (profileId) {
      try {
        const priorAttempts = Number(progress.bookActivityTrail?.attempts?.[`${selected.bookId}:${selected.chapterId}:${selected.id}@${selected.version}`]?.count) || 0;
        serverResult = await completeChapterActivity(profileId, selected.id, {
          attemptId: activityAttemptId(selected, priorAttempts + 1),
          choiceId: response.choiceId || undefined,
          evidenceSentenceIds: response.evidenceSentenceIds,
          orderIds: response.orderIds,
          responseText: response.responseText || undefined,
        });
        completion = { ...validateTrailResponse(selected, response), complete: ['completed', 'already-completed', 'complete'].includes(serverResult?.completionStatus), needsAnswer: false, needsEvidence: false };
      } catch {
        setIsSubmitting(false);
        setFeedback({ kind: 'error', message: 'LitLab could not save this activity right now. Keep your answer selected and try again when the catalog connection returns.' });
        return;
      }
    }
    const localResult = validateTrailResponse(selected, response);
    const resolvedCompletion = completion || localResult;
    const alreadyComplete = isTrailActivityComplete(progress, selected);
    onUpdate((current) => {
      const next = recordTrailActivityAttempt(current, selected, response, { chapterActivities: activities, completion: resolvedCompletion });
      return {
        ...next,
        currencies: { ...next.currencies, ...(serverResult?.wallet || {}) },
        inventory: { ...next.inventory, ...(serverResult?.inventory || {}) },
      };
    });
    if (resolvedCompletion.complete) onChapterRead?.();
    const rewards = asArray(selected.rewardEvents || selected.rewards).length ? asArray(selected.rewardEvents || selected.rewards) : selected.reward ? [selected.reward] : [];
    const awardedXp = alreadyComplete ? 0 : rewards.reduce((total, reward) => total + (reward.currency || reward.itemId || reward.rewardId === 'quest-wishlist-page' ? 0 : Math.max(0, Number(reward.xp ?? reward.quantity) || 0)), 0);
    setFeedback({ kind: resolvedCompletion.complete ? 'success' : 'needs-work', message: feedbackCopy(serverResult, selected, resolvedCompletion.complete), reward: resolvedCompletion.complete ? rewardSummary(selected, awardedXp) : '', replay: alreadyComplete });
    onStatus?.(resolvedCompletion.complete ? alreadyComplete ? 'Activity replay saved. Rewards are granted only once.' : 'Chapter activity complete. Your evidence-based reward was saved.' : 'Not complete yet. Use the chapter evidence and try again.');
    setIsSubmitting(false);
  };

  if (!activities.length) return <section className="chapter-activities trail-empty" aria-labelledby="chapter-activities-title"><p className="eyebrow">Chapter trail</p><h2 id="chapter-activities-title">No reviewed activities for this chapter yet</h2><p>LitLab keeps this chapter readable and waits for a reviewed, exact-chapter activity mapping.</p></section>;

  return <section className="chapter-activities book-activity-trail" aria-labelledby="chapter-activities-title">
    <div className="trail-heading"><div><p className="eyebrow">Chapter trail</p><h2 id="chapter-activities-title">Choose a way to learn</h2><p className="activity-source"><strong>Source:</strong> {source}</p></div><p className="trail-progress" aria-live="polite"><strong>{chapterProgress.complete}/{chapterProgress.total}</strong> activities complete</p></div>
    <div className="trail-activity-nav" role="tablist" aria-label={`${chapter.title} reviewed learning activities`}>
      {activities.map((activity) => { const meta = BOOK_TRAIL_ACTIVITY_TYPES[activity.activityType]; const complete = isTrailActivityComplete(progress, activity); return <button key={activity.id} id={`trail-tab-${activity.id}`} type="button" role="tab" aria-selected={selected?.id === activity.id} aria-controls={`trail-panel-${activity.id}`} onClick={() => selectActivity(activity)}><span aria-hidden="true">{meta?.icon || '✦'}</span><strong>{activity.title || meta?.label || 'Chapter activity'}</strong><small>{complete ? 'Complete · replay' : meta?.rewardFocus || 'Practice'}</small></button>; })}
    </div>
    {loadState.kind === 'loading' && <div className="trail-state" role="status">Loading the reviewed activity…</div>}
    {loadState.kind === 'offline' || loadState.kind === 'error' ? <div className="trail-state is-error" role="status"><p>{loadState.message}</p><button type="button" className="secondary-button" onClick={() => selectActivity(selectedSummary)}>Try again</button></div> : null}
    {selected && hasTask && <section className="trail-panel" id={`trail-panel-${selected.id}`} role="tabpanel" aria-labelledby={`trail-tab-${selected.id}`}>
      <div className="trail-task-heading"><span aria-hidden="true">{BOOK_TRAIL_ACTIVITY_TYPES[selected.activityType]?.icon || '✦'}</span><div><h3>{selected.title || BOOK_TRAIL_ACTIVITY_TYPES[selected.activityType]?.label}</h3><p>{selected.task?.instructions || selected.description || 'Use the chapter text to make and prove your response.'}</p></div></div>
      {activityMode === 'order' ? <OrderTask activity={selected} form={form} onChange={setForm} /> : activityMode === 'creative' ? <CreativeTask activity={selected} form={form} onChange={setForm} /> : <ChoiceTask activity={selected} form={form} onChange={setForm} />}
      <EvidenceTask activity={selected} sentences={sentences} form={form} onChange={setForm} />
      <div className="trail-actions"><button type="button" className="primary-button" onClick={submit} disabled={isSubmitting}>{isSubmitting ? 'Saving activity…' : isTrailActivityComplete(progress, selected) ? 'Replay and check feedback' : 'Check my reasoning'}</button><button type="button" className="text-button" onClick={() => { setForm(blankResponse()); setFeedback(null); }}>Start this activity again</button></div>
      {feedback && <div className={`trail-feedback is-${feedback.kind}`} role="status"><strong>{feedback.kind === 'success' ? feedback.replay ? 'Replay complete' : 'Trail reward earned' : feedback.kind === 'error' ? 'Not saved yet' : 'Almost there'}</strong><p>{feedback.message}</p>{feedback.reward && <small>{feedback.reward}</small>}</div>}
    </section>}
    {selected && !hasTask && loadState.kind === 'idle' && <div className="trail-state" role="status"><p>This activity summary is ready. Select it to load the reviewed prompt and exact evidence options.</p><button type="button" className="secondary-button" onClick={() => selectActivity(selected)}>Load activity</button></div>}
  </section>;
}
