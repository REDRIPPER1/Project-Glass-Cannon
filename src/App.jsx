import { useEffect, useState } from 'react';

export default function App() {
  const [apiStatus, setApiStatus] = useState('Checking API...');

  useEffect(() => {
    fetch('/api/health')
      .then((response) => response.json())
      .then((data) => setApiStatus(data.status || 'ok'))
      .catch(() => setApiStatus('Backend unavailable'));
  }, []);

  return (
    <main className="app-shell">
      <section className="hero-card">
        <p className="eyebrow">ReadQuest</p>
        <h1>Turn reading into a short, rewarding quest.</h1>
        <p className="subtitle">
          Practice comprehension, earn XP, and build stronger reading habits one passage at a time.
        </p>

        <div className="actions">
          <button type="button">Start a quest</button>
          <button type="button" className="secondary">
            View dashboard
          </button>
        </div>

        <div className="status-panel">
          <span>API status:</span>
          <strong>{apiStatus}</strong>
        </div>
      </section>

      <section className="quest-grid">
        <article className="quest-card">
          <span className="tag">Mystery</span>
          <h2>Signal in the Fog</h2>
          <p>Find the clue that changes the reader’s understanding of the scene.</p>
        </article>
        <article className="quest-card">
          <span className="tag">Science</span>
          <h2>Weather Patterns</h2>
          <p>Explain how evidence in the passage supports the main idea.</p>
        </article>
        <article className="quest-card">
          <span className="tag">Technology</span>
          <h2>Small Tools, Big Ideas</h2>
          <p>Use context clues to interpret the author’s purpose and examples.</p>
        </article>
      </section>
    </main>
  );
}
