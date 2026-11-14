import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('./App.jsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('./styles.css', import.meta.url), 'utf8');

test('keeps keyboard and screen-reader critical controls in the frontend shell', () => {
  assert.match(appSource, /<main className="main-stage"/);
  assert.match(appSource, /aria-label="App navigation"/);
  assert.match(appSource, /role="tablist"/);
  assert.match(appSource, /Show passage evidence/);
  assert.match(appSource, /Sound cues/);
  assert.match(appSource, /Answer and evidence feedback/);
  assert.match(appSource, /Quest completion/);
  assert.match(appSource, /Play a sample/);
  assert.match(appSource, /type="button"/);
  assert.match(styles, /:focus-visible/);
  assert.match(styles, /reduce-motion/);
});
