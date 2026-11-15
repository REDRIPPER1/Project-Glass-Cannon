import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('./App.jsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('./styles.css', import.meta.url), 'utf8');
const basicsSource = readFileSync(new URL('./ReadingBasicsScreen.jsx', import.meta.url), 'utf8');
const trailSource = readFileSync(new URL('./BookActivityTrail.jsx', import.meta.url), 'utf8');

function cssVariables(declarations) {
  return Object.fromEntries([...declarations.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map(([, name, value]) => [name, value.trim()]));
}

function contrastRatio(foreground, background) {
  const luminance = (color) => {
    const channels = color.match(/[\da-f]{2}/gi).map((channel) => parseInt(channel, 16) / 255).map((channel) => (
      channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
    ));
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  };
  const first = luminance(foreground);
  const second = luminance(background);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

test('keeps keyboard and screen-reader critical controls in the frontend shell', () => {
  assert.match(appSource, /<main className="main-stage"/);
  assert.match(appSource, /aria-label="Game navigation"/);
  assert.match(appSource, /aria-label="App destinations"/);
  assert.doesNotMatch(appSource, /header-profile-link/);
  assert.match(appSource, /\['basics', 'Reading Basics', 'basics'\]/);
  assert.match(appSource, /aria-label="LitLab home"/);
  assert.match(appSource, /className="brand-mark"/);
  assert.match(appSource, /role="tablist"/);
  assert.match(appSource, /Show passage evidence/);
  assert.match(appSource, /Sound cues/);
  assert.match(appSource, /Answer and evidence feedback/);
  assert.match(appSource, /Quest completion/);
  assert.match(appSource, /Play a sample/);
  assert.match(appSource, /System default/);
  assert.match(appSource, /prefers-color-scheme: dark/);
  assert.match(appSource, /An open storybook lighting a path toward a reading quest/);
  assert.match(appSource, /companion placeholder/);
  assert.match(appSource, /Name \$\{pet\.name\}/);
  assert.match(appSource, /\['profile', 'Profile', 'profile'\]/);
  assert.match(appSource, /\['pets', 'Pets', 'pets'\]/);
  assert.match(appSource, /\['shop', 'Shop', 'shop'\]/);
  assert.match(appSource, /Moonlit Trail/);
  assert.match(appSource, /View purchase in Shop/);
  assert.match(appSource, /LitLearn library/);
  assert.match(appSource, /aria-label=\{`\$\{selectedBook\.title\} reading levels, left to right`\}/);
  assert.match(appSource, /Read chapter in LitLearn/);
  assert.match(appSource, /approved catalog titles, grouped by category/);
  assert.match(appSource, /readableChapterSentences\(result\.content\)/);
  assert.match(appSource, /hasInAppChapterContent\(chapter\)/);
  assert.match(appSource, /Start comprehension quest/);
  assert.match(appSource, /No reviewed book offers yet/);
  assert.match(appSource, /role="tablist" aria-label="Books view"/);
  assert.match(appSource, /onClick=\{\(\) => onNavigate\('shop'\)\}/);
  assert.match(appSource, /Recommended book/);
  assert.match(appSource, /Interactive level road through level 100/);
  assert.match(appSource, /Wishlist Page draw/);
  assert.match(appSource, /Spend 5 Wishlist Pages for one random eligible book/);
  assert.match(appSource, /redeemWishlistPagesRemote/);
  assert.match(appSource, /loadChapterReference/);
  assert.match(appSource, /contentAvailability === 'bundled-passage'/);
  assert.match(appSource, /Project Gutenberg attribution/);
  assert.match(appSource, /Comprehension quiz source/);
  assert.match(appSource, /Chapter activity deck/);
  assert.match(appSource, /No reviewed activity for this section yet/);
  assert.match(appSource, /Reviewed activities for \$\{source\}/);
  assert.match(appSource, /starterClaim\)\.slice\(0, 6\)/);
  assert.match(appSource, /Evidence collection/);
  assert.match(appSource, /Character map/);
  assert.match(appSource, /Vocabulary in context/);
  assert.match(appSource, /Scene reconstruction/);
  assert.match(appSource, /Creative response/);
  assert.match(appSource, /Every reader, activity, and quiz displays its exact book and chapter/);
  assert.match(appSource, /activityPayload\?\.sourceLabel/);
  assert.match(appSource, /Premium required/);
  assert.match(appSource, /Buy permanently for/);
  assert.match(appSource, /Changing the local demo plan immediately rechecks book and chapter access/);
  assert.match(appSource, /Your reading progress was preserved/);
  assert.match(appSource, /bookWishlistIds/);
  assert.match(appSource, /Book wishlist/);
  assert.match(appSource, /Pet clothing & accessories/);
  assert.match(appSource, /Continue active quest/);
  assert.match(appSource, /scrollIntoView/);
  assert.match(appSource, /updateQuestionDraft\('answerId'/);
  assert.match(appSource, /updateQuestionDraft\('evidenceId'/);
  assert.match(appSource, /disabled=\{!draft\.answerId \|\| !draft\.evidenceId\}/);
  assert.match(appSource, /activeEvidenceTarget\.sentenceId/);
  assert.match(appSource, /Saved progress could not be read/);
  assert.match(appSource, /This quest is incomplete/);
  assert.match(appSource, /Offline demo mode/);
  assert.match(appSource, /judge-demo-title/);
  assert.match(appSource, /Load judge-ready demo/);
  assert.match(appSource, /View tutor summary/);
  assert.match(appSource, /Local preview/);
  assert.match(appSource, /aria-label=\{`\$\{PASS_PRODUCT_NAME\} reward path`\}/);
  assert.match(appSource, /type="button"/);
  assert.match(styles, /:focus-visible/);
  assert.match(styles, /reduce-motion/);
  assert.match(styles, /\.judge-demo-card/);
  assert.match(styles, /\.pet-sprite/);
  assert.match(styles, /scroll-snap-type: x mandatory/);
  assert.match(basicsSource, /aria-label="Reading Basics lessons"/);
  assert.match(basicsSource, /aria-label={`\$\{lesson\.title\} activities`}/);
  assert.match(basicsSource, /Move event \$\{index \+ 1\} up/);
  assert.match(basicsSource, /Choose the sentence that best supports your answer/);
  assert.match(trailSource, /role="tablist" aria-label=\{`\$\{chapter\.title\} reviewed learning activities`\}/);
  assert.match(trailSource, /Move event \$\{index \+ 1\} up/);
  assert.match(trailSource, /Find the exact text evidence/);
  assert.match(trailSource, /aria-pressed=\{selected\}/);
  assert.match(trailSource, /The reviewed activity could not be loaded/);
  assert.match(trailSource, /Rewards are granted only once/);
  assert.match(styles, /\.book-activity-trail/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\) \{ \.trail-activity-nav/);
});

test('keeps core text and controls above WCAG contrast thresholds across palettes', () => {
  const blocks = [...styles.matchAll(/(:root(?:\[[^\]]+\])*)\s*\{([^}]+)\}/g)].map(([, selector, declarations]) => ({ selector, declarations }));
  const base = cssVariables(blocks.find((block) => block.declarations.includes('--rq-page: #fff8f3'))?.declarations || '');
  const garden = cssVariables(blocks.find((block) => block.selector.includes("data-theme='garden'"))?.declarations || '');
  const sky = cssVariables(blocks.find((block) => block.selector.includes("data-theme='sky'"))?.declarations || '');
  const dark = cssVariables(blocks.find((block) => block.selector.includes("data-resolved-mode='dark'"))?.declarations || '');
  const focus = cssVariables(blocks.find((block) => block.declarations.includes('--rq-focus: #153f4a'))?.declarations || '');
  const palettes = [base, garden, sky].map((theme) => ({ ...base, ...theme, ...focus }));
  palettes.push({ ...base, ...dark, '--rq-focus': '#ffe19a' });
  for (const palette of palettes) {
    assert.ok(contrastRatio(palette['--rq-muted'], palette['--rq-page']) >= 4.5, 'body text should meet 4.5:1');
    assert.ok(contrastRatio(palette['--rq-accent-ink'], palette['--rq-accent-deep']) >= 4.5, 'primary button text should meet 4.5:1');
    assert.ok(contrastRatio(palette['--rq-focus'], palette['--rq-page']) >= 3, 'focus indicator should meet 3:1');
  }
  assert.match(styles, /\.primary-button\s*\{\s*background: var\(--rq-accent-deep\); color: var\(--rq-accent-ink\);/);
});
