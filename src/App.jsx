import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BUNDLED_QUEST,
  choiceById,
  rightsStatus,
  sentenceById,
  sentencesFor,
} from './utils/questContract';
import {
  levelForXp,
  loadProgress,
  recordResponse,
  resetProgress,
  responseFor,
  saveProgress,
  xpIntoLevel,
} from './utils/progress';

const SCREENS = ['home', 'example', 'reading', 'question', 'feedback', 'consequence', 'complete', 'dashboard'];
const GUIDE_COPY = {
  home: 'I will help you look for the line that proves your idea.',
  example: 'First, watch the routine. Then you will try it yourself.',
  reading: 'Take your time. There is no speed bonus.',
  question: 'Choose an answer, then the sentence that best supports it.',
  feedback: 'Strong readers check their idea against the passage.',
  consequence: 'Your evidence choice changes what the guide notices next.',
  complete: 'You finished a full evidence quest!',
  dashboard: 'This summary is a practice signal, not a diagnosis.',
};

function Guide({ mood = 'calm', message }) {
  return (
    <aside className={`guide-card guide-${mood}`} aria-label="Quest guide">
      <svg className="guide-mark" viewBox="0 0 100 100" aria-hidden="true">
        <path d="M50 7 61 33l27 3-21 18 6 28-23-14-23 14 6-28L12 36l27-3z" />
        <circle cx="39" cy="47" r="4" />
        <circle cx="61" cy="47" r="4" />
        <path d="M38 61c7 6 17 6 24 0" fill="none" />
      </svg>
      <p>{message}</p>
    </aside>
  );
}

function ProgressDots({ current, total }) {
  return (
    <div className="question-progress" aria-label={`Question ${current} of ${total}`}>
      <span>Question {current} of {total}</span>
      <div className="dot-row" aria-hidden="true">
        {Array.from({ length: total }, (_, index) => <i key={index} className={index < current ? 'is-current' : ''} />)}
      </div>
    </div>
  );
}

function SourceNotice({ source }) {
  if (!source) return null;
  const sourceName = source.bookTitle
    ? `${source.bookTitle}, ${source.edition}, ${source.chapter}`
    : source.label || 'Original ReadQuest passage';

  return (
    <details className="source-notice">
      <summary>Source &amp; reuse rights</summary>
      <dl>
        <div><dt>Source</dt><dd>{sourceName}</dd></div>
        <div><dt>Rights</dt><dd>{source.rightsStatus}</dd></div>
        <div><dt>License</dt><dd>{source.license}</dd></div>
        <div><dt>Attribution</dt><dd>{source.requiredAttribution || 'No separate attribution required.'}</dd></div>
      </dl>
    </details>
  );
}

function EmptyQuest({ status }) {
  return (
    <section className="content-gate" aria-labelledby="content-gate-title">
      <span className="lock-mark" aria-hidden="true">✓</span>
      <p className="eyebrow">Content safety check</p>
      <h2 id="content-gate-title">A reviewed quest belongs here.</h2>
      <p>{status.message}</p>
      <p className="quiet">ReadQuest will only render a local passage after its source, rights, attribution, sentence IDs, and question evidence have been supplied together.</p>
      <div className="contract-list" aria-label="Expected bundled quest contract">
        <span>Original / verified rights</span><span>3 questions</span><span>Sentence-level evidence</span><span>Attribution recorded</span>
      </div>
    </section>
  );
}

function AppHeader({ progress, onDashboard, onHome }) {
  return (
    <header className="app-header">
      <button className="brand" type="button" onClick={onHome} aria-label="ReadQuest home">
        <span className="brand-spark" aria-hidden="true">✦</span><span>ReadQuest</span>
      </button>
      <div className="header-actions">
        <span className="xp-pill" aria-label={`${progress.xp} experience points`}>✦ {progress.xp} XP</span>
        <button className="text-button" type="button" onClick={onDashboard}>Tutor view</button>
      </div>
    </header>
  );
}

export default function App() {
  const [progress, setProgress] = useState(loadProgress);
  const [apiStatus, setApiStatus] = useState('Checking API');
  const [screen, setScreen] = useState(() => loadProgress().activeSession?.screen || 'home');
  const [questionIndex, setQuestionIndex] = useState(() => loadProgress().activeSession?.questionIndex || 0);
  const [draft, setDraft] = useState({ answerId: '', evidenceId: '' });
  const [revealed, setRevealed] = useState(false);
  const mainRef = useRef(null);

  const quest = BUNDLED_QUEST;
  const content = useMemo(() => rightsStatus(quest), [quest]);
  const questions = quest?.questions ?? [];
  const activeQuestion = questions[questionIndex];
  const activeResponse = activeQuestion ? responseFor(progress, quest?.id, activeQuestion.id) : null;

  useEffect(() => {
    fetch('/api/health')
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((data) => setApiStatus(data.status || 'Available'))
      .catch(() => setApiStatus('Offline demo mode'));
  }, []);
  useEffect(() => { saveProgress(progress); }, [progress]);
  useEffect(() => {
    if (!SCREENS.includes(screen)) setScreen('home');
    mainRef.current?.focus();
  }, [screen]);

  function updateProgress(updater) { setProgress((previous) => updater(previous)); }
  function moveTo(nextScreen, nextQuestionIndex = questionIndex) {
    setScreen(nextScreen);
    setQuestionIndex(nextQuestionIndex);
    setRevealed(false);
    if (quest) {
      updateProgress((previous) => ({
        ...previous,
        activeSession: nextScreen === 'complete' || nextScreen === 'dashboard'
          ? null : { questId: quest.id, screen: nextScreen, questionIndex: nextQuestionIndex },
      }));
    }
  }
  function startQuest() {
    if (!content.ready) return;
    updateProgress((previous) => ({
      ...previous,
      signals: { ...previous.signals, nextQuestSelections: previous.signals.nextQuestSelections + 1 },
    }));
    moveTo('example', 0);
  }
  function beginQuestion(index) {
    const existing = responseFor(progress, quest.id, questions[index].id);
    setDraft({ answerId: existing?.answerId || '', evidenceId: existing?.evidenceId || '' });
    moveTo('question', index);
  }
  function submitResponse() {
    if (!draft.answerId || !draft.evidenceId || !activeQuestion) return;
    const submitted = {
      questId: quest.id,
      questionId: activeQuestion.id,
      answerId: draft.answerId,
      evidenceId: draft.evidenceId,
      answerCorrect: draft.answerId === activeQuestion.correctChoiceId,
      evidenceCorrect: draft.evidenceId === activeQuestion.correctEvidenceSentenceId,
      submittedAt: new Date().toISOString(),
    };
    updateProgress((previous) => recordResponse(previous, submitted));
    moveTo('feedback', questionIndex);
  }
  function revealEvidence() {
    setRevealed(true);
    updateProgress((previous) => ({
      ...previous,
      signals: { ...previous.signals, evidenceReveals: previous.signals.evidenceReveals + 1 },
    }));
  }
  function finishQuest() {
    const alreadyCompleted = progress.completedQuestIds.includes(quest.id);
    const allResponses = questions.map((question) => responseFor(progress, quest.id, question.id)).filter(Boolean);
    const earnedXp = alreadyCompleted ? 0 : 80 + allResponses.filter((item) => item.evidenceCorrect).length * 10;
    updateProgress((previous) => ({
      ...previous,
      xp: previous.xp + earnedXp,
      lastCompletionXp: earnedXp,
      completedQuestIds: alreadyCompleted ? previous.completedQuestIds : [...previous.completedQuestIds, quest.id],
      badgeIds: previous.badgeIds.includes('first-evidence-quest') ? previous.badgeIds : [...previous.badgeIds, 'first-evidence-quest'],
      activeSession: null,
      signals: { ...previous.signals, completedQuestCount: alreadyCompleted ? previous.signals.completedQuestCount : previous.signals.completedQuestCount + 1 },
    }));
    moveTo('complete');
  }
  function startOver() { setDraft({ answerId: '', evidenceId: '' }); moveTo('home', 0); }
  function handleReset() {
    if (window.confirm('Reset this browser’s anonymous ReadQuest demo progress?')) {
      setProgress(resetProgress());
      setDraft({ answerId: '', evidenceId: '' });
      setScreen('home');
      setQuestionIndex(0);
      setRevealed(false);
    }
  }

  const completedQuestions = quest ? questions.filter((question) => responseFor(progress, quest.id, question.id)).length : 0;
  const correctAnswers = quest ? questions.filter((question) => responseFor(progress, quest.id, question.id)?.answerCorrect).length : 0;
  const correctEvidence = quest ? questions.filter((question) => responseFor(progress, quest.id, question.id)?.evidenceCorrect).length : 0;

  return (
    <div className="app-shell">
      <AppHeader progress={progress} onHome={() => moveTo('home', 0)} onDashboard={() => moveTo('dashboard', questionIndex)} />
      <main className="main-stage" ref={mainRef} tabIndex="-1">
        {screen === 'home' && (
          <section className="home-view" aria-labelledby="home-title">
            <div className="home-copy">
              <p className="eyebrow">One short quest. One useful clue.</p>
              <h1 id="home-title">Turn “I think” into “Here’s the proof.”</h1>
              <p className="lede">ReadQuest gives grades 4–8 learners a small story quest where choosing evidence—not speed—moves the moment forward.</p>
              <div className="how-it-works" aria-label="How ReadQuest works"><span>1. Read</span><span>2. Reason</span><span>3. Choose evidence</span><span>4. See what changes</span></div>
              <div className="button-row"><button className="primary-button" type="button" onClick={startQuest} disabled={!content.ready}>Start recommended quest <span aria-hidden="true">→</span></button><button className="secondary-button" type="button" onClick={() => moveTo('dashboard')}>View practice summary</button></div>
              <p className="api-note"><span className="status-dot" /> {apiStatus}. The completed demo uses bundled local quest data.</p>
            </div>
            <div className="quest-preview">
              <div className="quest-world" aria-hidden="true"><span>✦</span><span>⌁</span><span>✧</span></div>
              {content.ready ? <><p className="card-label">Recommended quest</p><h2>{quest.title}</h2><p>{quest.topic} · {quest.difficulty}</p><div className="tag-row">{quest.skillTags.map((tag) => <span key={tag}>{tag}</span>)}</div><p className="time-label">◷ About {quest.readingTimeMinutes} minutes · 3 evidence choices</p><SourceNotice source={quest.source} /></> : <EmptyQuest status={content} />}
            </div>
            <Guide message={GUIDE_COPY.home} />
          </section>
        )}

        {screen === 'example' && content.ready && (
          <section className="lesson-view narrow-view" aria-labelledby="example-title">
            <p className="eyebrow">A quick worked example</p><h1 id="example-title">{quest.workedExample.title || 'Try the evidence routine'}</h1>
            <div className="routine-grid"><article><span>1</span><h2>Notice</h2><p>{quest.workedExample.notice}</p></article><article><span>2</span><h2>Think</h2><p>{quest.workedExample.think}</p></article><article><span>3</span><h2>Prove</h2><p>{quest.workedExample.prove}</p></article></div>
            <div className="example-callout"><strong>Example answer:</strong> {quest.workedExample.answer}<br /><strong>Evidence:</strong> {quest.workedExample.evidence}</div>
            <div className="button-row"><button className="primary-button" type="button" onClick={() => moveTo('reading')}>Read the passage <span aria-hidden="true">→</span></button><button className="text-button" type="button" onClick={() => moveTo('reading')}>Skip example</button></div><Guide message={GUIDE_COPY.example} />
          </section>
        )}

        {screen === 'reading' && content.ready && (
          <section className="reading-view" aria-labelledby="reading-title">
            <div className="reading-heading"><div><p className="eyebrow">Chapter 1 · {quest.skillTags.join(' + ')}</p><h1 id="reading-title">{quest.title}</h1><p>{quest.topic} · about {quest.readingTimeMinutes} minutes</p></div><div className="reading-meter" aria-label="Reading step complete"><span>Reading</span><strong>1 / 2</strong><i><b /></i></div></div>
            <article className="passage-card" aria-label={`${quest.title} passage`}>{sentencesFor(quest).map((sentence) => <p key={sentence.id} id={`sentence-${sentence.id}`}>{sentence.text}</p>)}</article>
            <div className="reading-footer"><p>When you are ready, you will answer one question at a time and choose the sentence that supports your idea.</p><button className="primary-button" type="button" onClick={() => beginQuestion(0)}>Start questions <span aria-hidden="true">→</span></button></div><Guide message={GUIDE_COPY.reading} />
          </section>
        )}

        {screen === 'question' && content.ready && activeQuestion && (
          <section className="question-view narrow-view" aria-labelledby="question-title">
            <ProgressDots current={questionIndex + 1} total={questions.length} /><p className="eyebrow">Skill: {activeQuestion.skill || quest.skillTags[0]}</p><h1 id="question-title">{activeQuestion.prompt}</h1>
            <fieldset className="choice-fieldset"><legend>1. Choose your answer</legend>{activeQuestion.choices.map((choice) => <label className={`choice-card ${draft.answerId === choice.id ? 'selected' : ''}`} key={choice.id}><input type="radio" name="answer" value={choice.id} checked={draft.answerId === choice.id} onChange={() => setDraft((current) => ({ ...current, answerId: choice.id }))} /><span>{choice.text}</span></label>)}</fieldset>
            <fieldset className="choice-fieldset evidence-fieldset"><legend>2. Choose the sentence that best supports your answer</legend><p className="field-help">This is your practice choice. Feedback appears only after you submit.</p>{activeQuestion.evidenceSentenceIds.map((sentenceId) => { const sentence = sentenceById(quest, sentenceId); return sentence ? <label className={`choice-card evidence-choice ${draft.evidenceId === sentenceId ? 'selected' : ''}`} key={sentenceId}><input type="radio" name="evidence" value={sentenceId} checked={draft.evidenceId === sentenceId} onChange={() => setDraft((current) => ({ ...current, evidenceId: sentenceId }))} /><span>{sentence.text}</span></label> : null; })}</fieldset>
            <button className="primary-button" type="button" onClick={submitResponse} disabled={!draft.answerId || !draft.evidenceId}>Submit answer &amp; evidence <span aria-hidden="true">→</span></button><Guide message={GUIDE_COPY.question} />
          </section>
        )}

        {screen === 'feedback' && content.ready && activeQuestion && activeResponse && (
          <section className="feedback-view narrow-view" aria-labelledby="feedback-title">
            <p className="eyebrow">Your feedback</p><h1 id="feedback-title">{activeResponse.answerCorrect && activeResponse.evidenceCorrect ? 'That idea is well supported.' : 'Let’s check the proof together.'}</h1>
            <div className="feedback-grid"><article><span className={activeResponse.answerCorrect ? 'result-good' : 'result-note'}>{activeResponse.answerCorrect ? '✓' : '↗'}</span><h2>Your answer</h2><p>{choiceById(activeQuestion, activeResponse.answerId)?.text}</p></article><article><span className={activeResponse.evidenceCorrect ? 'result-good' : 'result-note'}>{activeResponse.evidenceCorrect ? '✓' : '↗'}</span><h2>Your evidence</h2><p>{sentenceById(quest, activeResponse.evidenceId)?.text}</p></article></div>
            <div className="explanation"><strong>Why:</strong> {activeQuestion.explanation}</div>
            {!revealed ? <button className="secondary-button" type="button" onClick={revealEvidence}>Show passage evidence</button> : <div className="evidence-reveal" aria-live="polite"><p className="eyebrow">Passage evidence</p><p>The highlighted sentence is the strongest support for the answer.</p><article className="evidence-passage" aria-label="Passage with supporting evidence highlighted">{sentencesFor(quest).map((sentence) => <p key={sentence.id} id={`sentence-${sentence.id}`} className={sentence.id === activeQuestion.correctEvidenceSentenceId ? 'is-evidence' : ''}>{sentence.id === activeQuestion.correctEvidenceSentenceId ? <mark>{sentence.text}</mark> : sentence.text}</p>)}</article></div>}
            <div className="button-row"><button className="primary-button" type="button" onClick={() => moveTo('consequence')}>See what your clue changes <span aria-hidden="true">→</span></button></div><Guide mood={activeResponse.evidenceCorrect ? 'happy' : 'thoughtful'} message={GUIDE_COPY.feedback} />
          </section>
        )}

        {screen === 'consequence' && content.ready && activeQuestion && activeResponse && (
          <section className="consequence-view narrow-view" aria-labelledby="consequence-title">
            <div className={`consequence-scene ${activeResponse.evidenceCorrect ? 'scene-unlocked' : 'scene-mapped'}`} aria-hidden="true"><span>✦</span><span>⌁</span><span>◒</span></div><p className="eyebrow">Story consequence</p><h1 id="consequence-title">{activeResponse.evidenceCorrect ? activeQuestion.storyConsequence.strongTitle : activeQuestion.storyConsequence.practiceTitle}</h1><p className="consequence-copy">{activeResponse.evidenceCorrect ? activeQuestion.storyConsequence.strongMessage : activeQuestion.storyConsequence.practiceMessage}</p><p className="consequence-note">{activeResponse.evidenceCorrect ? 'The strong clue unlocks the clearest route.' : 'The guide adds the correct clue to your map for next time.'}</p>
            {questionIndex < questions.length - 1 ? <button className="primary-button" type="button" onClick={() => beginQuestion(questionIndex + 1)}>Next question <span aria-hidden="true">→</span></button> : <button className="primary-button" type="button" onClick={finishQuest}>Finish quest <span aria-hidden="true">→</span></button>}<Guide mood={activeResponse.evidenceCorrect ? 'happy' : 'thoughtful'} message={GUIDE_COPY.consequence} />
          </section>
        )}

        {screen === 'complete' && content.ready && (
          <section className="complete-view narrow-view" aria-labelledby="complete-title">
            <div className="completion-star" aria-hidden="true">✦</div><p className="eyebrow">Quest complete</p><h1 id="complete-title">You followed the evidence trail.</h1><p className="completion-score">{correctAnswers} of {questions.length} answers matched the passage · {correctEvidence} of {questions.length} evidence choices were on target.</p><div className="reward-card"><span>+ {progress.lastCompletionXp} XP</span><strong>Evidence Explorer badge earned</strong></div><div className="button-row"><button className="primary-button" type="button" onClick={() => moveTo('dashboard')}>View your practice summary <span aria-hidden="true">→</span></button><button className="secondary-button" type="button" onClick={startOver}>Return home</button></div><Guide mood="happy" message={GUIDE_COPY.complete} />
          </section>
        )}

        {screen === 'dashboard' && (
          <section className="dashboard-view" aria-labelledby="dashboard-title">
            <div className="dashboard-heading"><div><p className="eyebrow">Anonymous learner · local demo</p><h1 id="dashboard-title">Practice summary</h1><p>This view records one session’s choices to help guide a next practice—never a diagnosis or measure of mastery.</p></div><button className="secondary-button" type="button" onClick={handleReset}>Reset demo progress</button></div>
            <div className="stat-grid"><article><span>XP</span><strong>{progress.xp}</strong><small>Level {levelForXp(progress.xp)} · {xpIntoLevel(progress.xp)}/100 to next</small></article><article><span>Quests completed</span><strong>{progress.completedQuestIds.length}</strong><small>One focused practice session at a time</small></article><article><span>Evidence choices</span><strong>{correctEvidence}/{questions.length || 3}</strong><small>In this local quest</small></article><article><span>Badge</span><strong>{progress.badgeIds.includes('first-evidence-quest') ? '✦' : '—'}</strong><small>{progress.badgeIds.includes('first-evidence-quest') ? 'Evidence Explorer' : 'Finish a quest to earn it'}</small></article></div>
            {content.ready && completedQuestions > 0 ? <section className="tutor-summary" aria-labelledby="tutor-summary-title"><div><p className="eyebrow">Tutor session summary</p><h2 id="tutor-summary-title">What was practiced</h2><p>{quest.skillTags.join(' · ')} · {quest.title}</p></div><div className="summary-rows">{questions.map((question, index) => { const response = responseFor(progress, quest.id, question.id); return <article key={question.id}><strong>Question {index + 1}</strong><p><span>Learner answer</span>{response ? choiceById(question, response.answerId)?.text : 'Not answered yet'}</p><p><span>Chosen evidence</span>{response ? sentenceById(quest, response.evidenceId)?.text : 'Not chosen yet'}</p><p><span>Suggested next practice</span>{question.followUpSuggestion}</p></article>; })}</div></section> : <section className="empty-summary"><h2>No practice recorded yet</h2><p>Complete the reviewed quest to show anonymous answers, evidence choices, and a focused next practice.</p></section>}
            <section className="next-step"><div><p className="eyebrow">Next recommendation</p><h2>{content.ready ? 'Repeat the evidence routine with this quest.' : 'Add the reviewed local quest data.'}</h2><p>{content.ready ? 'Try again and use the passage evidence before committing to your answer.' : content.message}</p></div><button className="primary-button" type="button" disabled={!content.ready} onClick={startQuest}>{content.ready ? 'Start quest' : 'Quest pending review'} <span aria-hidden="true">→</span></button></section><Guide message={GUIDE_COPY.dashboard} />
          </section>
        )}
      </main>
      <footer className="app-footer">No accounts. No child identifiers. Progress stays in this browser.</footer>
    </div>
  );
}
