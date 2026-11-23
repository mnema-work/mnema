/**
 * The page `mnema site` writes: one HTML file with everything in it.
 *
 * NOTHING IS LOADED FROM ELSEWHERE. The style, the script and the record's files are
 * inside the file, and a `Content-Security-Policy` in the page says so to the browser: the
 * one script allowed is the page's own, named by its hash, and no request may leave. A record
 * is text people wrote, and the page is where a stranger reads it, so the text is escaped
 * where it is written into the page ({@link escapeHtml}) and, behind that, a title that
 * somehow reached the page as markup would meet a policy that runs no script but ours. The
 * policy opens exactly two doors, both to `data:` (text inside the page, never an address): the
 * fonts the style carries and the icon of the tab.
 *
 * THE LISTS ARE WRITTEN HERE, AND THE BROWSER DERIVES THEM AGAIN. The decisions, their notes and
 * the timeline are rendered by `mnema site` from the public tree's events (`model.ts`), as the trees
 * `view.ts` makes (this file only writes them as markup); the verdict is computed in the reader's
 * browser from the files, which travel inside the page. This used to say that the page does not
 * derive the lists from those files again, and that premise is what the check falsified: once the
 * verdict is `verified`, the script runs the same `pageModel` and the same `listViews` over the
 * files it verified and names every difference from what the page shows (`browser/check.ts`,
 * held by `the-verdict-in-the-browser.test.ts`). It is the product's own TypeScript run twice, not a
 * second reader, and a page served by the party it checks carries the script that checks it.
 *
 * WITHOUT THE SCRIPT THE WHOLE LIST IS THERE. Every decision, note and entry of the timeline is
 * written visible, and no rule of the style hides one: a reader whose browser runs no script, or
 * whose script is switched off, reads everything the page lists. Only the controls that need the
 * script (the filters) are written with `hidden`, and the script shows them. With the script, the
 * filter opens on the decisions in force, and the page says how many of how many it shows. This
 * replaces a checkbox and a rule of style that hid the rest, which was a filter of one word and
 * hid decisions from a reader who had not asked.
 *
 * THE RAW LINES ARE NOT IN THE PAGE TWICE. The files the verifier reads are in the page, in
 * base64; the stored lines of each tail used to be written a second time as escaped text, 435 KB
 * of 1.3 MB for this repository's own record. They are now drawn from those files when a reader
 * opens a tail, so without the script they are not drawn (the files are still in the page).
 *
 * THE COLOURS ARE THE BRAND'S. {@link PALETTE} is the brand's palette (ADR-488): charcoal and
 * paper grounds, bone and charcoal ink, the warm greys of the diagrams for secondary text and rules,
 * and the sulphur yellow only where it means something (a record verified, a decision in force), on
 * the dark ground; on the light one that place is charcoal. Waiting is stone on dark and dark stone
 * on light, the colour of the diagrams' dim signs, so it never shares the colour of in force. Red
 * stays only for a failure: a broken or unverified record and lists that differ from the files; a
 * rejected decision and a retracted note are secondary text, since neither is a failure. This used
 * to say that the page takes the accent and the ground of the front page's banner (the old lilac on
 * GitHub's grounds); the brand's redesign falsified it, since the banner no longer draws that
 * accent. The values are copies, since nothing a package publishes reads the brand's source:
 * `the-editor-and-the-record-page-wear-the-new-brand.test.ts` (in `packages/code/tests/`) holds each one
 * equal to the brand's value for its role, and `page.test.ts` holds every pair of text and ground to
 * WCAG AA in both themes and the red to the failures alone.
 *
 * THE PAGE WEARS THE BRAND'S MARK AND TYPE (ADR-679). The eye is in its header and, in a dark square, is the
 * icon of the tab, both inline and still; the text is set in Archivo and the ids, hashes and code in "mnema mono", all
 * carried inside the file as `data:` WOFF2 (`the-mark.ts`, which a script of the repository writes and a test holds equal to
 * the brand's eye and fonts). Each is a Latin subset, so a record in another script falls to the system face the stack
 * names next: Archivo is two static instances, and "mnema mono" is IBM Plex Mono Regular as a Modified Version under
 * another name, since its authors reserve "Plex". The licences go in the style, as the OFL asks.
 */

import { createHash } from 'node:crypto';
import { mix, textAccent } from './colour.js';
import type { PageModel } from './model.js';
import {
  ARCHIVO_400,
  ARCHIVO_700,
  ARCHIVO_RANGE,
  FAVICON,
  FONT_LICENCES,
  HEADER_EYE,
  MNEMA_MONO_400,
} from './the-mark.js';
import { listViews, NO_DECISIONS, type SiteTail, textOf, type VKid } from './view.js';

export type { DecisionMove, PageDecision, PageModel, PageNote, TimelineEntry } from './model.js';
export type { SiteTail } from './view.js';

/** Everything the page is written from. */
export interface SiteModel extends PageModel {
  readonly tails: readonly SiteTail[];
  /** The record's files, path under the chain root to base64: what the verifier reads. */
  readonly files: Readonly<Record<string, string>>;
}

/** Text as it may appear between tags and inside a quoted attribute. */
export function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/** The floor for text: WCAG 2, level AA. */
export const TEXT_FLOOR = 4.5;

/** The floor for the border of a focused control: WCAG 2.2, 1.4.11. */
export const FOCUS_FLOOR = 3;

/**
 * The brand's colours this page paints with, by the brand's names: copies of the brand's palette,
 * which `the-editor-and-the-record-page-wear-the-new-brand.test.ts` holds equal to it. This replaces the
 * front page's banner colours the page took until the brand's redesign (the lilac accent and GitHub's
 * grounds), which the banner no longer draws.
 */
const BRAND = {
  charcoal: '#131312',
  bone: '#efebe1',
  paper: '#f6f3ec',
  stone: '#8c8a82',
  darkStone: '#6b6862',
  sulphur: '#e6da2e',
  lineDark: '#46453f',
  lineLight: '#cdc8bc',
  dimDark: '#a29e94',
  dimLight: '#5b574f',
} as const;

/** The ground of each theme, which the accent as text is taken toward from the other theme. */
const GROUND = { dark: BRAND.charcoal, light: BRAND.paper } as const;

/** One theme's colours. Every one that is text must read at {@link TEXT_FLOOR} on `bg` and on `surface`. */
export interface Colours {
  /** The ground of the page. */
  readonly bg: string;
  /** The ground of a card and of a control. */
  readonly surface: string;
  readonly text: string;
  readonly muted: string;
  /** A rule between things: not text, not held to a floor. */
  readonly border: string;
  /** The accent, for what is not text: bone on dark, charcoal on light. */
  readonly accent: string;
  /** The accent as small text: the accent, taken only as far toward the ink as the floor needs. */
  readonly accentText: string;
  /** A verified record, a decision accepted. */
  readonly ok: string;
  /** A failure, and only that: a record that is broken or unverified, lists that differ from the files. */
  readonly bad: string;
  /** A record still being checked, a decision proposed. */
  readonly wait: string;
  /** The ring round a control or a link that has the keyboard: held to {@link FOCUS_FLOOR}. */
  readonly focus: string;
}

function themeOf(theme: 'dark' | 'light', rest: Omit<Colours, 'accentText' | 'focus'>): Colours {
  const other = theme === 'dark' ? 'light' : 'dark';
  const { accent } = rest;
  const accentText = textAccent({
    ink: accent,
    toward: GROUND[other],
    grounds: [rest.bg, rest.surface],
    floor: TEXT_FLOOR,
  });
  return { ...rest, accentText, focus: accentText };
}

/**
 * The palette, light and dark: the light one is the dark one inverted. The surface is the ground
 * taken a little toward the other theme's. Measured on the ground and on the surface (WCAG): on
 * dark, bone 15.62 and 13.66, the secondary grey 6.95 and 6.08, sulphur 12.78 and 11.18, stone 5.38
 * and 4.70, the red 7.37 and 6.45; on light, charcoal 16.78 and 15.62, the secondary grey 6.49 and
 * 6.04, dark stone 5.01 and 4.66, the red 4.90 and 4.57. The light red is GitHub's `#cf222e` taken
 * 1% toward charcoal, which is what the page's own rule ({@link textAccent}) gives on the light
 * surface, where `#cf222e` reads 4.498:1.
 */
export const PALETTE: { readonly dark: Colours; readonly light: Colours } = {
  dark: themeOf('dark', {
    bg: BRAND.charcoal,
    surface: mix(BRAND.charcoal, BRAND.paper, 0.06),
    text: BRAND.bone,
    muted: BRAND.dimDark,
    border: BRAND.lineDark,
    accent: BRAND.bone,
    ok: BRAND.sulphur,
    bad: '#ff7b72',
    wait: BRAND.stone,
  }),
  light: themeOf('light', {
    bg: BRAND.paper,
    surface: mix(BRAND.paper, BRAND.charcoal, 0.035),
    text: BRAND.charcoal,
    muted: BRAND.dimLight,
    border: BRAND.lineLight,
    accent: BRAND.charcoal,
    ok: BRAND.charcoal,
    bad: '#cd222e',
    wait: BRAND.darkStone,
  }),
};

function variables(theme: Colours): string {
  return [
    `--bg: ${theme.bg};`,
    `--surface: ${theme.surface};`,
    `--text: ${theme.text};`,
    `--muted: ${theme.muted};`,
    `--border: ${theme.border};`,
    `--accent: ${theme.accent};`,
    `--accent-text: ${theme.accentText};`,
    `--ok: ${theme.ok};`,
    `--bad: ${theme.bad};`,
    `--wait: ${theme.wait};`,
    `--focus: ${theme.focus};`,
  ].join(' ');
}

/** The face of the page's text and its stack: Archivo, then what the machine has for a script Archivo does not hold. */
const TEXT_FACE = "'Archivo', system-ui, sans-serif";
/** The face of ids, hashes and code, and its stack. */
const CODE_FACE = "'mnema mono', ui-monospace, monospace";

/** One `@font-face` of a face carried inside the page as `data:` WOFF2: nothing is requested. */
function fontFace(
  family: string,
  weight: number,
  mime: string,
  data: string,
  range?: string,
): string {
  return `@font-face { font-family: '${family}'; font-style: normal; font-weight: ${weight}; font-display: swap; src: url(data:${mime};base64,${data}) format('woff2');${range === undefined ? '' : ` unicode-range: ${range};`} }`;
}

/** The page's style. A class or an attribute selects; nothing in the page carries a `style=`. */
export const STYLE = `
${fontFace('Archivo', 400, 'font/woff2', ARCHIVO_400, ARCHIVO_RANGE)}
${fontFace('Archivo', 700, 'font/woff2', ARCHIVO_700, ARCHIVO_RANGE)}
${fontFace('mnema mono', 400, 'font/woff2', MNEMA_MONO_400)}
:root { color-scheme: light dark; ${variables(PALETTE.light)} font-family: ${TEXT_FACE}; line-height: 1.55; }
@media (prefers-color-scheme: dark) { :root { ${variables(PALETTE.dark)} } }
* { box-sizing: border-box; }
[hidden] { display: none !important; }
body { max-width: 52rem; margin: 0 auto; padding: 1rem; background: var(--bg); color: var(--text); overflow-wrap: anywhere; }
h1, h2, h3, h4 { line-height: 1.25; }
h1 { margin: 0.5rem 0; }
.head { display: flex; align-items: center; gap: 0.75rem; }
.head h1 { margin: 0.5rem 0; }
.mark { flex: none; width: 2.5rem; height: 2.5rem; color: var(--text); }
h2 { margin-top: 2rem; }
a { color: var(--accent-text); }
code, pre { font-family: ${CODE_FACE}; font-size: 0.85em; }
pre { white-space: pre-wrap; overflow-wrap: anywhere; margin: 0.5rem 0; }
code { overflow-wrap: anywhere; }
:focus-visible { outline: 3px solid var(--focus); outline-offset: 2px; }
.skip { position: absolute; left: -999px; top: 0; padding: 0.5rem 1rem; background: var(--surface); }
.skip:focus { left: 0.5rem; top: 0.5rem; z-index: 1; }
.meta, .muted { color: var(--muted); }
.meta { font-size: 0.9em; margin: 0.25rem 0; }
.card, #verdict, #lists-check, .filters { background: var(--surface); border: 1px solid var(--border); border-radius: 0.5rem; padding: 0.75rem 1rem; }
#verdict, #lists-check { border-width: 2px; }
#lists-check { margin-top: 0.75rem; }
#verdict-status, #lists-status { font-weight: 700; }
#verdict-status[data-state="verified"], #lists-status[data-state="match"] { color: var(--ok); }
#verdict-status[data-state="broken"], #verdict-status[data-state="unverified"], #lists-status[data-state="differ"] { color: var(--bad); }
#verdict-status[data-state="pending"], #lists-status[data-state="unchecked"] { color: var(--wait); }
.decision { margin: 1rem 0; border-left: 4px solid var(--accent); }
.decision h3 { margin: 0 0 0.25rem; }
.permalink { margin-left: 0.5rem; font-size: 0.85em; color: var(--muted); text-decoration: underline; }
.state { display: inline-block; font-size: 0.8em; font-weight: 600; border: 1px solid; border-radius: 0.25rem; padding: 0 0.4rem; color: var(--muted); }
.state[data-state="accepted"] { color: var(--ok); }
.state[data-state="rejected"] { color: var(--muted); }
.state[data-state="proposed"] { color: var(--wait); }
.badge { font-size: 0.8em; border: 1px solid var(--border); border-radius: 0.25rem; padding: 0 0.35rem; color: var(--muted); }
.notes, .addresses { margin: 0.75rem 0 0; padding: 0; list-style: none; }
.note { border-top: 1px solid var(--border); padding: 0.5rem 0; }
.note.retracted pre { text-decoration: line-through; }
.retraction { color: var(--muted); margin: 0.25rem 0; }
.rel { color: var(--muted); margin-right: 0.35rem; }
.timeline { padding-left: 1.5rem; }
.timeline li { margin: 0.35rem 0; }
.filters { display: flex; flex-wrap: wrap; gap: 0.75rem; margin: 1rem 0 0.5rem; }
.filters label { display: flex; flex-direction: column; flex: 1 1 10rem; min-width: 0; font-size: 0.85em; color: var(--muted); }
.filters select, .filters input, .filters button { font: inherit; color: var(--text); background: var(--bg); border: 1px solid var(--muted); border-radius: 0.25rem; padding: 0.25rem 0.5rem; width: 100%; max-width: 100%; }
.filters button { width: auto; align-self: flex-end; cursor: pointer; }
details { margin: 0.5rem 0; }
summary { cursor: pointer; }
/* The faces above are carried as data, with their licences:

${FONT_LICENCES.replaceAll('*/', '* /')}*/
`;

/**
 * A tree as markup. Every text and every attribute value goes through {@link escapeHtml}, and the
 * tags and attribute names are the ones `view.ts` writes, never the record's. A `<pre>` that begins
 * with a line break is written with one more, because a browser's parser drops the first and the
 * text the tree holds would otherwise not be the text the reader gets.
 */
function html(kid: VKid): string {
  if (typeof kid === 'string') return escapeHtml(kid);
  const attrs = Object.entries(kid.attrs)
    .map(([name, value]) => ` ${name}="${escapeHtml(value)}"`)
    .join('');
  const lead = kid.tag === 'pre' && textOf(kid).startsWith('\n') ? '\n' : '';
  return `<${kid.tag}${attrs}>${lead}${kid.kids.map(html).join('')}</${kid.tag}>`;
}

/** The base64 digest a `Content-Security-Policy` names a script or a style by. */
function cspHash(text: string): string {
  return `'sha256-${createHash('sha256').update(text).digest('base64')}'`;
}

/** JSON that may sit inside a `<script>`: no `<`, so nothing in it can close the element. */
function inertJson(value: unknown): string {
  return JSON.stringify(value).replaceAll('<', '\\u003c');
}

/**
 * The controls the script shows. They are written `hidden`: a reader without the script is not
 * offered a control that does nothing. The options of the selects are filled by the script from
 * what the cards carry, never from a list of its own.
 */
const FILTERS = `<div id="filters" class="filters" hidden>
<label>State<select id="f-state"></select></label>
<label>Identity<select id="f-who"></select></label>
<label>Agent or person<select id="f-by"></select></label>
<label>Recorded from<input type="date" id="f-from"></label>
<label>Recorded until<input type="date" id="f-to"></label>
<label>Text<input type="search" id="f-text"></label>
<label>Path<input type="search" id="f-path" placeholder="packages/code"></label>
<button type="button" id="f-clear">Clear the filters</button>
</div>
<p id="showing" class="muted" aria-live="polite" hidden></p>`;

/** What the check of the lists says until the script has run it: without the script it never does. */
const LISTS_UNCHECKED =
  'The lists below were written by mnema site. Checking them against the verified events needs JavaScript, so they have not been checked.';

/**
 * What a page that is published says of itself to whoever indexes it: the title, the description, the canonical
 * address and, optionally, structured data (a JSON value). Without it the page's title is "The record", the same for
 * every record, and it has no description and no canonical.
 */
export interface SiteHead {
  readonly title: string;
  readonly description: string;
  readonly canonical: string;
  readonly structuredData?: unknown;
}

/** The head's lines for `head`: the title, the description, the canonical and the data (a `<` in it escaped). */
function headLines(head: SiteHead | undefined): string {
  if (head === undefined) return '<title>The record</title>';
  const lines = [
    `<title>${escapeHtml(head.title)}</title>`,
    `<meta name="description" content="${escapeHtml(head.description)}">`,
    `<link rel="canonical" href="${escapeHtml(head.canonical)}">`,
  ];
  if (head.structuredData !== undefined) {
    lines.push(`<script type="application/ld+json">${inertJson(head.structuredData)}</script>`);
  }
  return lines.join('\n');
}

/**
 * The page, as the text of `index.html`. `script` is the file `dist/site-verifier.js` holds: the
 * verifier, the filters and the drawing of the raw lines. With a `backLink` the page opens with
 * one link to it; without, the page opens with the link that skips to the decisions. With a
 * `head` the page says what it is to a search engine ({@link SiteHead}); nothing else of it changes.
 */
export function renderPage(
  model: SiteModel,
  script: string,
  backLink?: string,
  head?: SiteHead,
): string {
  const fileCount = Object.keys(model.files).length;
  const policy = [
    "default-src 'none'",
    // `data:` is the narrowest source a CSP can name for the tab's icon (a source expression carries no MIME type, and a hash
    // does not apply to an image); the page has no other image, and the eye in its header is inline markup.
    'font-src data:',
    'img-src data:',
    `script-src ${cspHash(script)}`,
    `style-src ${cspHash(STYLE)}`,
  ].join('; ');
  const views = listViews(model);
  const decisions =
    views.decisions.length === 0
      ? `<p>${NO_DECISIONS}</p>`
      : views.decisions.map((item) => html(item.node)).join('\n');
  const otherNotes =
    views.otherNotes.length === 0
      ? ''
      : `<section id="other-notes">\n<h2>Other notes</h2>\n<p>Notes that belong to no decision on this page.</p>\n<ul class="notes">${views.otherNotes
          .map((item) => html(item.node))
          .join('')}</ul>\n</section>\n`;
  const timeline =
    views.timeline.length === 0
      ? '<p>No decision or note is recorded in the public tree.</p>'
      : `<ol class="timeline">\n${views.timeline.map(html).join('\n')}\n</ol>`;
  const tails = views.tails.map((item) => html(item.node)).join('\n');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${escapeHtml(policy)}">
<meta name="viewport" content="width=device-width, initial-scale=1">
${headLines(head)}
<link rel="icon" type="image/svg+xml" href="${FAVICON}">
<style>${STYLE}</style>
</head>
<body>
${backLink === undefined ? '' : `<p><a href="${escapeHtml(backLink)}">Back</a></p>\n`}<a class="skip" href="#decisions">Skip to the decisions</a>
<header class="head">
${HEADER_EYE}
<h1>The record</h1>
</header>
<main>
<section id="verdict" role="status" aria-live="polite">
<p><span id="verdict-status" data-state="pending">verifying…</span></p>
<p id="verdict-summary">This page is checking the record it carries.</p>
<ul id="verdict-issues"></ul>
<noscript><p>This page verifies the record with JavaScript. Without it, nothing here has been verified, and the stored lines under Events are not drawn: the files they come from are in this page, in base64.</p></noscript>
</section>
<section id="lists-check" role="status" aria-live="polite">
<p><span id="lists-status" data-state="unchecked">not checked</span></p>
<p id="lists-summary">${LISTS_UNCHECKED}</p>
<ul id="lists-issues"></ul>
</section>
<p id="about">The verdict above is the sentence <code>mnema verify</code> gives a fresh clone of the repository,
computed in this browser by the same verifier (<code>@mnema/chain</code>) over the ${fileCount} file(s)
this page carries, with no network request and no key of yours. It checks the hash chain and every
checkpoint signature against the public keys carried with the files. It does not say that a key
belongs to the person a list names. The lists below were written from those files by
<code>mnema site</code>; once the record verifies, this browser derives them again from the files it
verified, with the same TypeScript code the product runs, and names each difference between what it
derived and what the page shows (the text of each decision, note and timeline entry, the attributes
the filters read, the ids and the counts). It reads the lists and the parts of this page, not the text around them, nor a style, nor what is wrapped around a field. That is not a second, independent reader: the Python reader
verifies the chain and does not derive decisions. A page handed over by the party it checks carries its
own script, so the check counts for more when the page is made again from a clone. Only the committed
public tree is in this page (no private tree and no machine-global tree), and all of its text is.</p>
${html(views.counts)}
<h2 id="decisions">Decisions</h2>
${FILTERS}
<div id="decision-list">
${decisions}
</div>
${otherNotes}<section id="timeline">
<h2>Timeline</h2>
<p>Each act the record holds about a decision or a note, in the order the record holds them.</p>
${timeline}
</section>
<section id="events">
<h2>Events</h2>
<p>The stored lines of each tail, exactly as the verdict read them. Opening a tail draws them from the files this page carries.</p>
${tails}
</section>
</main>
<script type="application/json" id="record-files">${inertJson(model.files)}</script>
<script>${script}</script>
</body>
</html>
`;
}
