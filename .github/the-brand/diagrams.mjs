// Draws the diagrams of the README and of the packages, in the brand: `docs/assets/{how-it-works,how-mnema-fits,the-family}-
// {dark,light}.svg` and `packages/{chain,core,context,stacks}/assets/<p>-{dark,light}.svg`, with the block that opens each
// README that shows one.
//
// A diagram is the field of lines (`./field.mjs`) with fixed points on it, and four signs for what a decision is: a ring
// is a proposed decision, a point one in force, a crossed point a refused write, a ticked point a verified record; a dim
// point and a dim ring are a decision no longer in force and one never accepted. The eye at the top is the brand's mark
// (`./eye.mjs`), and never an icon in a diagram.
//
// A DIAGRAM MOVES, AND STOPS WHEN ASKED TO. The eye blinks on the banner's 9 s cycle; every 7 s a soft pulse runs along
// the lines from left to right, and each sign sends out a ripple as the pulse passes it. Under `prefers-reduced-motion`
// the pulse and the ripples are not drawn and the eye shows its still copy. The motion adds no words.
//
// EVERY TEXT IS AN OUTLINE, AND ONE DOOR WRITES IT. GitHub shows an SVG as an image, and an image loads no web font, so
// `say` is the only function that turns a line into the outline of its glyphs (`./outline.mjs`), and it writes the line it
// outlined in `data-said`, which is what `the-front-page-is-drawn-from-the-console.test.ts` reads where it once read a
// `<text>`. A picture has no `<text>`. The words of the packages' and the family's diagrams are lines of the product
// (`./lines.mjs`); the two diagrams of the README say their own, fixed here.
//
// From the root of the repository:
//
//   node .github/the-brand/diagrams.mjs          writes the diagrams and the blocks of the READMEs
//   node .github/the-brand/diagrams.mjs --check  writes nothing; exits 1 if one differs
//
// Nothing here is imported by a package: the diagrams are drawn by this script and committed.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { blinkingEye, eye } from './eye.mjs';
import { f, line, relative, smooth } from './field.mjs';
import {
  CHAIN_LINES,
  CONTEXT_LINES,
  CORE_LINES,
  FAMILY_ALT,
  FAMILY_LINES,
  PACKAGE_ALT,
  STACKS_LINES,
  textOf,
} from './lines.mjs';
import { outlineOf } from './outline.mjs';
import { DIAGRAM, PALETTE } from './palette.mjs';

export { DIGEST, FAMILY_ALT, FAMILY_LINES, SEPARATORS, textOf } from './lines.mjs';

/** @typedef {import('./lines.mjs').Line} Line */
/** @typedef {import('./outline.mjs').Role} Role */
/** @typedef {import('./outline.mjs').Anchor} Anchor */
/** @typedef {import('./field.mjs').Stone} Stone */
/** @typedef {'ink' | 'dim' | 'acc'} Ink */
/**
 * One picture's pen: the theme's paint, the ids of this picture only, its width, and what its motion has used so far. The
 * counter is local to the one picture, so drawing twice in a process gives the same bytes. `quiet` is a pen whose signs
 * send out no ripple (the legend's).
 * @typedef {(typeof DIAGRAM)['dark' | 'light'] & {
 *   id: (kind: string) => string,
 *   width: number,
 *   delays: Map<string, number>,
 *   used: Set<string>,
 *   quiet?: boolean,
 * }} Pen
 */

/**
 * @param {string} file the picture's name, which every id in it starts with
 * @param {'dark' | 'light'} theme
 * @param {number} width
 * @returns {Pen}
 */
const pen = (file, theme, width) => {
  let n = 0;
  return {
    ...DIAGRAM[theme],
    id: (kind) => `${file}-${kind}-${++n}`,
    width,
    delays: new Map(),
    used: new Set(),
  };
};

// ---------------------------------------------------------------- the motion

/** The cycle of the pulse, in seconds, and the share of it in which the pulse crosses: then the field rests. */
const CYCLE = 7;
const RUN = 0.62;
/** The eye's own cycle, in seconds, which is the banner's. */
const BLINK_BEGIN = -1.5;

/**
 * The first and last x of a path of the diagrams' lines, to tell a line drawn right to left.
 * @param {string} d
 * @returns {[number, number]}
 */
const endsOf = (d) => {
  const numbers = (d.match(/-?\d*\.?\d+/g) ?? []).map(Number);
  const last = /H(-?[\d.]+)$/.exec(d);
  return [numbers[0] ?? 0, last === null ? (numbers[numbers.length - 2] ?? 0) : Number(last[1])];
};

/** The attributes a pulse shares: a dash of 9 in 100 of the line's length, and the resting offset that hides it. */
const DASH =
  'pathLength="100" fill="none" stroke-linecap="round" stroke-dasharray="9 200" stroke-dashoffset="-100"';

/**
 * A soft pulse along a line: a copy of it, a dash of the theme's ink that runs the line's length in the first share of
 * the cycle. Where the animation does not run, the resting offset leaves no dash on the line.
 * @param {Pen} t
 * @param {string} d the line's data, absolute
 * @param {boolean} [strong] a line of a sign's colour, which the pulse shows more on
 */
const pulse = (t, d, strong = false) => {
  const reversed = endsOf(d)[0] > endsOf(d)[1];
  t.used.add(reversed ? 'kr' : 'k');
  return `<path class="${reversed ? 'kr' : 'k'}" d="${relative(d)}" ${DASH} stroke="${t.ink}" stroke-opacity="${strong ? '.9' : '.5'}" stroke-width="${strong ? '2.2' : '1.8'}"/>`;
};

/**
 * A ripple from a sign as the pulse reaches it: an unfilled circle that grows and fades. Its delay is the sign's place
 * along the run, from the left margin to the right one. A sign under 7 in radius sends none.
 * @param {Pen} t
 * @param {number} x
 * @param {number} y
 * @param {number} r
 * @param {boolean} yellow a sign of the brand's yellow, whose ripple is the theme's accent
 */
const ripple = (t, x, y, r, yellow) => {
  if (r < 7 || t.quiet === true) return '';
  const share = Math.max(0, Math.min(1, (x - 40) / (t.width - 80)));
  const delay = f(share * RUN * CYCLE);
  if (!t.delays.has(delay)) t.delays.set(delay, t.delays.size);
  t.used.add('h');
  return `<circle class="h d${t.delays.get(delay)}" cx="${f(x)}" cy="${f(y)}" r="${r}" fill="none" stroke="${yellow ? t.acc : t.ink}" stroke-width="1.6" opacity="0"/>`;
};

/**
 * The stylesheet of one picture: the classes of what moves, their keyframes, and the one rule for a reader who asks for
 * less motion. Class selectors only, and only `@keyframes` and that one `@media`.
 * @param {Pen} t
 */
const sheet = (t) => {
  const used = t.used;
  const rules = [
    ...(used.has('k') ? [`.k{animation:k ${CYCLE}s linear infinite}`] : []),
    ...(used.has('kr') ? [`.kr{animation:kr ${CYCLE}s linear infinite}`] : []),
    ...(used.has('h')
      ? [
          `.h{transform-box:fill-box;transform-origin:center;animation:h ${CYCLE}s ease-out infinite}`,
          ...[...t.delays].map(([delay, i]) => `.d${i}{animation-delay:${delay}s}`),
        ]
      : []),
    ...(used.has('k')
      ? [
          `@keyframes k{0%{stroke-dashoffset:9}${RUN * 100}%{stroke-dashoffset:-100}100%{stroke-dashoffset:-100}}`,
        ]
      : []),
    ...(used.has('kr')
      ? [
          `@keyframes kr{0%{stroke-dashoffset:-100}${RUN * 100}%{stroke-dashoffset:9}100%{stroke-dashoffset:9}}`,
        ]
      : []),
    ...(used.has('h')
      ? [
          '@keyframes h{0%{opacity:.7;transform:scale(1)}12%{opacity:0;transform:scale(2.1)}100%{opacity:0;transform:scale(2.1)}}',
        ]
      : []),
    `@media (prefers-reduced-motion: reduce){${[...['k', 'kr', 'h'].filter((c) => used.has(c)).map((c) => `.${c}`), '.ea'].join(',')}{display:none}.es{display:inline}}`,
  ];
  return `<style>${rules.join('')}</style>`;
};

/** @param {string} text */
const xml = (text) =>
  text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

/**
 * The only door of text onto a picture: one `<path>` with the outline of the line, and the line it outlined in `data-said`.
 * @param {Pen} t
 * @param {Line} words
 * @param {number} x
 * @param {number} y the baseline
 * @param {Role} role
 * @param {Anchor} anchor
 * @param {Ink} ink
 */
export function say(t, words, x, y, role, anchor, ink) {
  const text = textOf(words);
  return `<path d="${outlineOf(text, role, x, y, anchor)}" fill="${t[ink]}" data-said="${xml(text)}"/>`;
}

/** @param {string} text @returns {Line} a text of the picture's own, which no file of the product says */
const own = (text) => [text];

// ---------------------------------------------------------------- the drawing system

/**
 * One band of the field: lines at `yc + (k - half) * pitch`, faded at both ends; `skip` leaves out the levels drawn as lanes.
 * @param {Pen} t
 * @param {number} x0
 * @param {number} x1
 * @param {number} yc
 * @param {number} n
 * @param {number} pitch
 * @param {readonly Stone[]} stones
 * @param {{ sw?: number, skip?: readonly number[] }} [o]
 */
const band = (t, x0, x1, yc, n, pitch, stones, { sw = 1.6, skip = [] } = {}) => {
  const id = t.id('band');
  const half = (n - 1) / 2;
  const drawn = Array.from({ length: n }, (_, k) =>
    skip.includes(k)
      ? ''
      : smooth(line(yc + (k - half) * pitch, stones, x0, x1, Math.round((x1 - x0) / 10))),
  ).filter((d) => d !== '');
  const paths = drawn.map((d) => `<path d="${d}"/>`).join('');
  const pulses = drawn.map((d) => pulse(t, d)).join('');
  return `<defs><linearGradient id="${id}g"><stop offset="0" stop-color="${PALETTE.mask}" stop-opacity="0"/><stop offset=".06" stop-color="${PALETTE.mask}"/><stop offset=".94" stop-color="${PALETTE.mask}"/><stop offset="1" stop-color="${PALETTE.mask}" stop-opacity="0"/></linearGradient><mask id="${id}" maskUnits="userSpaceOnUse" x="${x0}" y="${yc - n * pitch}" width="${x1 - x0}" height="${2 * n * pitch}"><rect x="${x0}" y="${yc - n * pitch}" width="${x1 - x0}" height="${2 * n * pitch}" fill="url(#${id}g)"/></mask></defs><g mask="url(#${id})" fill="none" stroke="${t.line}" stroke-width="${sw}" stroke-linecap="round">${paths}</g><g mask="url(#${id})">${pulses}</g>`;
};

// THE SIGNS, the only icons a diagram uses. Each is `(pen, x, y, radius)`.

/** A proposed decision. @param {Pen} t @param {number} x @param {number} y @param {number} [r] */
const ring = (t, x, y, r = 12) =>
  `<circle cx="${x}" cy="${y}" r="${r}" fill="${t.bg}" stroke="${t.ring ? t.ink : PALETTE.sulphur}" stroke-width="2.6"/>${ripple(t, x, y, r, true)}`;
/** A decision in force. @param {Pen} t @param {number} x @param {number} y @param {number} [r] */
const pt = (t, x, y, r = 12) =>
  `<circle cx="${x}" cy="${y}" r="${r}" fill="${PALETTE.sulphur}"${t.ring ? ` stroke="${t.ink}" stroke-width="2"` : ''}/>${ripple(t, x, y, r, true)}`;
/** A write refused. @param {Pen} t @param {number} x @param {number} y @param {number} [r] */
const refused = (t, x, y, r = 12) =>
  `${pt(t, x, y, r)}<path d="M${x - r * 0.4},${y - r * 0.4}l${r * 0.8},${r * 0.8}m0,${-r * 0.8}l${-r * 0.8},${r * 0.8}" stroke="${t.mark}" stroke-width="${f(r * 0.2)}" stroke-linecap="round"/>`;
/** A record verified. @param {Pen} t @param {number} x @param {number} y @param {number} [r] */
const verified = (t, x, y, r = 12) =>
  `${pt(t, x, y, r)}<path d="M${f(x - r * 0.45)},${y}l${f(r * 0.32)},${f(r * 0.36)}l${f(r * 0.6)},${f(-r * 0.7)}" fill="none" stroke="${t.mark}" stroke-width="${f(r * 0.2)}" stroke-linecap="round" stroke-linejoin="round"/>`;
/** A decision no longer in force. @param {Pen} t @param {number} x @param {number} y @param {number} [r] */
const dimPt = (t, x, y, r = 12) =>
  `<circle cx="${x}" cy="${y}" r="${r}" fill="${t.muted}"/>${ripple(t, x, y, r, false)}`;
/** A decision never accepted. @param {Pen} t @param {number} x @param {number} y @param {number} [r] */
const dimRing = (t, x, y, r = 12) =>
  `<circle cx="${x}" cy="${y}" r="${r}" fill="${t.bg}" stroke="${t.muted}" stroke-width="2.6"/>${ripple(t, x, y, r, false)}`;

/**
 * A chip: a pill with a short text on its middle.
 * @param {Pen} t
 * @param {number} x
 * @param {number} y
 * @param {Line} words
 * @param {number} [w]
 */
const chip = (t, x, y, words, w = 200) =>
  `<rect x="${f(x - w / 2)}" y="${y - 16}" width="${w}" height="30" rx="15" fill="${t.chip}" stroke="${t.line}"/>${say(t, words, x, y + 4, 'chip', 'middle', 'acc')}`;

/**
 * The eye at the top of a picture: the brand's eye blinking on the banner's cycle, and, hidden, its copy at rest looking
 * down at the flow, which a reader who asks for less motion is shown.
 * @param {Pen} t
 * @param {number} w
 */
const watcher = (t, w) => {
  const still = eye({
    id: t.id('eye'),
    ink: t.ink,
    iris: PALETTE.sulphur,
    ringInk: PALETTE.charcoal,
    ring: t.ring,
    look: 5,
  });
  const blinking = blinkingEye({
    id: t.id('eye'),
    ink: t.ink,
    iris: PALETTE.sulphur,
    ringInk: PALETTE.charcoal,
    ring: t.ring,
    begin: BLINK_BEGIN,
  });
  return `<g transform="translate(${w / 2},44) scale(.6)"><g class="ea">${blinking}</g><g class="es" display="none">${still}</g></g>`;
};

/**
 * A picture says what it is (`role`, `aria-label`, `<title>`) and how big it is.
 * @param {Pen} t
 * @param {number} w
 * @param {number} h
 * @param {string} body
 * @param {{ label: string, title: string }} says
 */
const frame = (t, w, h, body, { label, title }) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${xml(label)}"><title>${xml(title)}</title>${sheet(t)}<rect width="${w}" height="${h}" fill="${t.bg}"/>${body}${watcher(t, w)}</svg>`;

/**
 * The heading of a picture.
 * @param {Pen} t
 * @param {number} x
 * @param {number} y
 * @param {Line} words
 * @param {Anchor} [anchor]
 */
const heading = (t, x, y, words, anchor = 'start') => say(t, words, x, y, 'title', anchor, 'ink');

/**
 * The four signs and what each means, along the foot of a picture. They are a key and send out no ripple.
 * @param {Pen} t
 * @param {number} x
 * @param {number} y
 */
const legend = (t, x, y) => {
  const quiet = { ...t, quiet: true };
  return /** @type {const} */ ([
    [ring, 'proposed'],
    [pt, 'in force'],
    [refused, 'write refused'],
    [verified, 'verified'],
  ])
    .map(
      ([sign, label], i) =>
        `${sign(quiet, x + i * 200, y, 7)}${say(t, own(label), x + i * 200 + 14, y + 4, 'small', 'start', 'dim')}`,
    )
    .join('');
};

// ---------------------------------------------------------------- the seven diagrams

/**
 * The four steps of "how mnema works": four equal columns of number, title, two lines, the sign on the field and a chip.
 * Each chip is 250 wide: the widest chip text, `mnema decision record`, is 213 units of IBM Plex Mono at the chip's size.
 * @param {Pen} t
 */
function works(t) {
  const W = 1200;
  const cx = [0, 1, 2, 3].map((i) => 60 + 270 * i + 135);
  const yc = 276;
  /** @type {readonly [string, string, string, string, Sign][]} */
  const steps = [
    [
      'Record',
      'A decision, why it was made,',
      'and the options turned down.',
      'mnema decision record',
      ring,
    ],
    ['Rule', 'Accepted, then linked', 'to the paths it governs.', 'mnema link', pt],
    [
      'Hand over',
      'Every session opens with it,',
      'and each edit meets its rules.',
      'the plugin',
      pt,
    ],
    [
      'Verify',
      'Every fact is signed and',
      'hash-chained; anyone can check.',
      'mnema verify',
      verified,
    ],
  ];
  return frame(
    t,
    W,
    420,
    heading(t, 60, 56, own('How mnema works')) +
      band(
        t,
        40,
        1160,
        yc,
        6,
        13,
        cx.map((x) => [x, yc, 30]),
      ) +
      steps
        .map(([h, a, b, c, sign], i) => {
          const x = cx[i] ?? 0;
          return (
            sign(t, x, yc, 14) +
            say(t, own(String(i + 1).padStart(2, '0')), x, 112, 'note', 'middle', 'dim') +
            say(t, own(h), x, 148, 'step', 'middle', 'ink') +
            say(t, own(a), x, 184, 'prose', 'middle', 'dim') +
            say(t, own(b), x, 204, 'prose', 'middle', 'dim') +
            chip(t, x, 362, own(c), 250)
          );
        })
        .join(''),
    {
      label: 'How mnema works: record, rule, hand over, verify',
      title: 'How mnema works',
    },
  );
}

/**
 * "How mnema fits": an agent session and the repository, with three writes as lanes of the field, one of them refused by
 * the rule in force.
 * @param {Pen} t
 */
function fits(t) {
  const W = 1200;
  const L = 330;
  const R = 870;
  const yc = 265;
  const pitch = 19;
  const n = 13;
  /** @param {number} k */
  const lv = (k) => yc + (k - 6) * pitch;
  /** @type {Stone} */
  const a2 = [560, lv(1), 26];
  /** @type {readonly Stone[]} */
  const st = [a2];
  /**
   * @param {number} k
   * @param {number} x1
   */
  const lane = (k, x1) => {
    const d = smooth(line(lv(k) + 0.01, k === 1 ? [] : st, L - 30, x1, 50));
    return `<path d="${d}" fill="none" stroke="${t.acc}" stroke-width="3" stroke-linecap="round"/>${pulse(t, d, true)}`;
  };
  const left = /** @type {const} */ ([
    [1, '2 · write refused', 'src/billing/total.ts'],
    [6, '3 · write lands', 'src/cart/price.ts'],
    [11, '4 · decision recorded', 'by the agent'],
  ])
    .map(
      ([k, a, b]) =>
        say(t, own(a), L - 46, lv(k) - 3, 'label', 'end', 'ink') +
        say(t, own(b), L - 46, lv(k) + 15, 'note', 'end', 'dim'),
    )
    .join('');
  const right = /** @type {const} */ ([
    [1, 'refused', 'by ADR-2 · refuses-a-write'],
    [6, 'lands', 'no rule governs this path'],
    [11, 'signed · proposed', 'in .mnema/ as ADR-3'],
  ])
    .map(
      ([k, a, b]) =>
        say(t, own(a), R + 46, lv(k) - 3, 'label', 'start', 'acc') +
        say(t, own(b), R + 46, lv(k) + 15, 'note', 'start', 'dim'),
    )
    .join('');
  // Each lane ends in what happened to it: the refused write stops at the rule, crossed; the decision ends a ring.
  const ends = refused(t, a2[0] - a2[2] - 18, lv(1), 9) + ring(t, R + 22, lv(11), 9);
  return frame(
    t,
    W,
    520,
    heading(t, 60, 56, own('agent session')) +
      say(t, own('1 · opens with ADR-2 in force'), 60, 80, 'note', 'start', 'dim') +
      heading(t, 1140, 56, own('repository'), 'end') +
      say(t, own('5 · record verified'), 1140, 80, 'note', 'end', 'dim') +
      verified(t, 1140 - 19 * 0.66 * 12 * 1.3 - 18, 76, 8) +
      band(t, L - 30, R, yc, n, pitch, st, { skip: [1, 6, 11] }) +
      lane(1, a2[0] - a2[2] - 27) +
      lane(6, R + 22) +
      lane(11, R + 13) +
      pt(t, a2[0], a2[1], 15) +
      ends +
      say(t, own('ADR-2 · in force'), a2[0], a2[1] - 66, 'label', 'middle', 'acc') +
      say(t, own('Keep money as integer cents'), a2[0], a2[1] - 48, 'note', 'middle', 'dim') +
      left +
      right +
      `<path d="M60,468H1140" stroke="${t.line}"/>` +
      legend(t, 60, 494),
    {
      label:
        'How mnema fits: a session opens with the decisions in force, a write under a refusing rule is denied, a write elsewhere lands, a recorded decision is signed into the chain, and mnema verify checks it',
      title: 'How mnema fits between an agent session and the repository',
    },
  );
}

/**
 * The family: every door sits on the field, in seven equal columns; the record is the one in the middle.
 * @param {Pen} t
 */
function family(t) {
  const W = 1200;
  const yc = 170;
  const cx = Array.from({ length: 7 }, (_, i) => 60 + 154 * i + 77);
  const L = FAMILY_LINES;
  /** @type {readonly ({ name: Line, rows: readonly [Line, Line] } | null)[]} */
  const doors = [
    { name: L.sdk, rows: [L.sdkA, L.sdkB] },
    { name: L.vscode, rows: [L.vscodeA, L.vscodeB] },
    { name: L.ci, rows: [L.ciA, L.ciB] },
    null,
    { name: L.action, rows: [L.actionA, L.actionB] },
    { name: L.site, rows: [L.siteA, L.siteB] },
    { name: L.stacks, rows: [L.stacksA, L.stacksB] },
  ];
  /** @type {readonly Stone[]} */
  const st = cx.map((x, i) => [x, yc, i === 3 ? 40 : 18]);
  return frame(
    t,
    W,
    340,
    heading(t, 60, 56, L.title) +
      band(t, 40, 1160, yc, 8, 12, st) +
      cx
        .map((x, i) => {
          const door = doors[i];
          if (door === null || door === undefined)
            return (
              pt(t, x, yc, 22) +
              say(t, L.code, x, yc + 82, 'name', 'middle', 'acc') +
              say(t, L.codeA, x, yc + 102, 'small', 'middle', 'dim') +
              say(t, L.codeB, x, yc + 120, 'small', 'middle', 'dim')
            );
          return (
            pt(t, x, yc, 8) +
            say(t, door.name, x, yc + 82, 'name', 'middle', 'ink') +
            door.rows
              .map((row, j) => say(t, row, x, yc + 102 + j * 18, 'small', 'middle', 'dim'))
              .join('')
          );
        })
        .join(''),
    { label: FAMILY_ALT, title: FAMILY_ALT },
  );
}

/**
 * The chain: one line of six entries; the field parts only where something happens (the altered entry, the checkpoint).
 * One story only: an entry was altered, so verify fails, and nothing after the break is shown as verified.
 * @param {Pen} t
 */
function chain(t) {
  const W = 720;
  const y = 166;
  const xs = [0, 1, 2, 3, 4, 5].map((i) => 110 + 100 * i);
  const L = CHAIN_LINES;
  /**
   * @param {number} x
   * @param {number} r
   */
  const after = (x, r) =>
    `<circle cx="${x}" cy="${y}" r="${r}" fill="${t.bg}" stroke="${t.dim}" stroke-width="2" stroke-dasharray="3 3"/>`;
  const nodes = xs
    .map((x, i) =>
      i === 3 ? refused(t, x, y, 11) : i > 3 ? after(x, i === 5 ? 12 : 8) : pt(t, x, y, 8),
    )
    .join('');
  /**
   * @param {number} i
   * @param {Line} above
   * @param {Line | null} below
   * @param {Ink} ink
   */
  const label = (i, above, below, ink) =>
    say(t, above, xs[i] ?? 0, y - 58, 'smallStrong', 'middle', ink) +
    (below === null ? '' : say(t, below, xs[i] ?? 0, y + 56, 'tiny', 'middle', 'dim'));
  /** @type {readonly Stone[]} */
  const st = xs.map((x, i) => [x, y, i === 5 ? 24 : i === 3 ? 21 : 17]);
  return frame(
    t,
    W,
    320,
    heading(t, 40, 50, L.name) +
      band(t, 20, 700, y, 4, 15, st, { sw: 1.3 }) +
      `<path d="M70,${y}H${(xs[3] ?? 0) - 13}" stroke="${t.acc}" stroke-width="2"/>${pulse(t, `M70,${y}H${(xs[3] ?? 0) - 13}`, true)}<path d="M${(xs[3] ?? 0) + 13},${y}H650" stroke="${t.dim}" stroke-width="2" stroke-dasharray="4 5"/>` +
      nodes +
      label(0, L.event, L.link, 'acc') +
      label(3, L.mismatch, L.altered, 'acc') +
      label(5, L.checkpoint, null, 'dim') +
      `<path d="M40,256H680" stroke="${t.line}"/>` +
      say(t, L.verify, 40, 288, 'note', 'start', 'ink') +
      say(t, L.failed, 680, 288, 'noteStrong', 'end', 'ink'),
    { label: PACKAGE_ALT.chain, title: textOf(L.name) },
  );
}

/** @typedef {(t: Pen, x: number, y: number, r?: number) => string} Sign */

/**
 * Inputs on the left, one point in the middle they meet at, outputs on the right.
 * @param {Pen} t
 * @param {{ title: Line, ins: readonly { sign: Sign, name: Line, note: Line | null }[], centre: { sign: Sign, name: Line, note: Line }, outs: readonly { name: Line, rows: readonly Line[] }[], foot: readonly [Line, Line], alt: string }} d
 */
function converge(t, { title, ins, centre, outs, foot, alt }) {
  const W = 1200;
  const H = 420;
  const cx = 600;
  const cy = 220;
  const xl = 340;
  const xr = 860;
  const yIn = ins.map((_, i) => cy + (i - (ins.length - 1) / 2) * 52);
  const yOut = outs.map((_, i) => cy + (i - (outs.length - 1) / 2) * 62);
  const inL = ins
    .map(({ sign, name, note }, i) => {
      const y = yIn[i] ?? 0;
      const d = `M${xl + 22},${y}C${xl + 140},${y} ${cx - 140},${cy} ${cx - 34},${cy}`;
      return (
        `<path d="${d}" fill="none" stroke="${t.line}" stroke-width="1.6"/>` +
        pulse(t, d) +
        sign(t, xl, y, 9) +
        say(t, name, xl - 24, y - 2, 'label', 'end', 'ink') +
        (note === null ? '' : say(t, note, xl - 24, y + 15, 'small', 'end', 'dim'))
      );
    })
    .join('');
  const outL = outs
    .map(({ name, rows }, i) => {
      const y = yOut[i] ?? 0;
      const d = `M${cx + 34},${cy}C${cx + 140},${cy} ${xr - 140},${y} ${xr - 14},${y}`;
      return (
        `<path d="${d}" fill="none" stroke="${t.acc}" stroke-width="1.8"/>` +
        pulse(t, d, true) +
        pt(t, xr, y, 6) +
        say(t, name, xr + 22, y - 2, 'label', 'start', 'acc') +
        rows
          .map((row, j) => say(t, row, xr + 22, y + 15 + j * 18, 'small', 'start', 'dim'))
          .join('')
      );
    })
    .join('');
  return frame(
    t,
    W,
    H,
    heading(t, 60, 56, title) +
      inL +
      outL +
      `<circle cx="${cx}" cy="${cy}" r="34" fill="${t.bg}" stroke="${t.line}" stroke-width="1.4"/>` +
      centre.sign(t, cx, cy, 18) +
      say(t, centre.name, cx, cy + 58, 'name', 'middle', 'acc') +
      say(t, centre.note, cx, cy + 78, 'small', 'middle', 'dim') +
      `<path d="M60,362H1140" stroke="${t.line}"/>` +
      say(t, foot[0], 60, 392, 'note', 'start', 'ink') +
      say(t, foot[1], 1140, 392, 'note', 'end', 'dim'),
    { label: alt, title: textOf(title) },
  );
}

/**
 * The life of a decision in four columns: its state, what it means, and the move that leads there.
 * @param {Pen} t
 */
function core(t) {
  const W = 1200;
  const cx = [195, 465, 735, 1005];
  const yc = 230;
  const L = CORE_LINES;
  /** @type {readonly { state: Line, rows: readonly Line[], chip: Line, sign: Sign }[]} */
  const states = [
    { state: L.proposed, rows: [L.awaiting], chip: L.record, sign: ring },
    { state: L.accepted, rows: [L.governs, L.governsMore], chip: L.accept, sign: pt },
    { state: L.superseded, rows: [L.newer, L.replaces], chip: L.supersede, sign: dimPt },
    { state: L.rejected, rows: [L.terminal], chip: L.reject, sign: dimRing },
  ];
  return frame(
    t,
    W,
    420,
    heading(t, 60, 56, L.name) +
      say(t, L.life, 60, 80, 'note', 'start', 'dim') +
      band(
        t,
        40,
        1160,
        yc,
        6,
        13,
        cx.map((x) => [x, yc, 30]),
      ) +
      states
        .map(({ state, rows, chip: move, sign }, i) => {
          const x = cx[i] ?? 0;
          return (
            sign(t, x, yc, 14) +
            say(t, state, x, 128, 'state', 'middle', 'ink') +
            rows.map((row, j) => say(t, row, x, 152 + j * 16, 'note', 'middle', 'dim')).join('') +
            chip(t, x, 312, move, 170)
          );
        })
        .join('') +
      `<path d="M60,352H1140" stroke="${t.line}"/>` +
      say(t, L.fold, 60, 384, 'note', 'start', 'ink') +
      say(t, L.refused, 1140, 384, 'note', 'end', 'dim'),
    { label: PACKAGE_ALT.core, title: textOf(L.name) },
  );
}

/**
 * What a session opens with: three decisions in, `bootstrap` in the middle, what the session is handed out.
 * @param {Pen} t
 */
function context(t) {
  const L = CONTEXT_LINES;
  return converge(t, {
    title: L.name,
    ins: [
      { sign: dimPt, name: L.one, note: L.oneState },
      { sign: pt, name: L.two, note: L.twoState },
      { sign: ring, name: L.three, note: L.threeState },
    ],
    centre: { sign: pt, name: L.bootstrap, note: L.only },
    outs: [
      { name: L.decisions, rows: [L.inForce] },
      { name: L.awaitingJudgement, rows: [L.waits] },
      { name: L.resume, rows: [L.stopped] },
    ],
    foot: [L.opensWith, L.never],
    alt: PACKAGE_ALT.context,
  });
}

/**
 * A stack: its files in, `validateStack` in the middle, the digest and the refusal of an MCP server out. The `.mcp.json`
 * is drawn refused, because a stack never carries one.
 * @param {Pen} t
 */
function stacks(t) {
  const L = STACKS_LINES;
  return converge(t, {
    title: L.name,
    ins: [
      { sign: pt, name: L.manifest, note: null },
      { sign: pt, name: L.skill, note: null },
      { sign: pt, name: L.agent, note: null },
      { sign: pt, name: L.licence, note: null },
      { sign: refused, name: L.mcp, note: null },
    ],
    centre: { sign: verified, name: L.validate, note: L.line },
    outs: [
      { name: L.digest, rows: [L.digestStart, L.digestEnd] },
      { name: L.refused, rows: [L.never] },
    ],
    foot: [L.identity, L.add],
    alt: PACKAGE_ALT.stacks,
  });
}

// ---------------------------------------------------------------- the pictures, and the READMEs that show them

/** The four published packages drawn here, besides `@mnema/code`, whose page shows the family. */
export const PACKAGE_PICTURES = Object.freeze([
  { dir: 'chain', lines: CHAIN_LINES, draw: chain, w: 720, h: 320 },
  { dir: 'core', lines: CORE_LINES, draw: core, w: 1200, h: 420 },
  { dir: 'context', lines: CONTEXT_LINES, draw: context, w: 1200, h: 420 },
  { dir: 'stacks', lines: STACKS_LINES, draw: stacks, w: 1200, h: 420 },
]);

/** The package whose page shows the family, which it stands in the middle of, for its picture. */
export const FAMILY_PAGE = 'code';

/** The family's picture, and the README pictures that are written by hand. */
const FAMILY_WIDTH = 1200;

/** Every package whose README opens with a picture the script points at. */
export const PICTURED_PAGES = Object.freeze([...PACKAGE_PICTURES.map((p) => p.dir), FAMILY_PAGE]);

/** The heading the front page's family picture sits under. */
export const FAMILY_HEADING = '## The mnema family';

/**
 * Every diagram, by its path from the repository's root, dark and light.
 * @returns {Record<string, string>}
 */
export function drawTheDiagrams() {
  /** @type {readonly { path: (theme: string) => string, name: string, draw: (t: Pen) => string, w: number }[]} */
  const all = [
    {
      name: 'how-it-works',
      path: (theme) => `docs/assets/how-it-works-${theme}.svg`,
      draw: works,
      w: 1200,
    },
    {
      name: 'how-mnema-fits',
      path: (theme) => `docs/assets/how-mnema-fits-${theme}.svg`,
      draw: fits,
      w: 1200,
    },
    {
      name: 'the-family',
      path: (theme) => `docs/assets/the-family-${theme}.svg`,
      draw: family,
      w: FAMILY_WIDTH,
    },
    ...PACKAGE_PICTURES.map(({ dir, draw, w }) => ({
      w,
      name: dir,
      path: (/** @type {string} */ theme) => `packages/${dir}/assets/${dir}-${theme}.svg`,
      draw,
    })),
  ];
  /** @type {Record<string, string>} */
  const out = {};
  for (const { name, path, draw, w } of all) {
    for (const theme of /** @type {const} */ (['dark', 'light'])) {
      out[path(theme)] = `${draw(pen(`${name}-${theme}`, theme, w))}\n`;
    }
  }
  return out;
}

/**
 * What a package's manifest says that its README block uses.
 * @param {string} dir
 * @returns {{ name: string, repository?: { url?: string } }}
 */
function manifestOf(dir) {
  return JSON.parse(
    readFileSync(new URL(`../../packages/${dir}/package.json`, import.meta.url), 'utf8'),
  );
}

/**
 * Where a package's picture is served from: the file on the repository's `main` branch, by the address of the repository
 * its manifest says. No version is in it, because the picture must load before any version is published and after the next.
 * @param {string} dir
 * @param {string} path the file's path from the repository's root
 */
export function pictureUrl(dir, path) {
  const url = manifestOf(dir).repository?.url ?? '';
  const at = /github\.com[/:]([^/]+\/[^/]+?)(?:\.git)?$/.exec(url);
  if (at === null) throw new Error(`packages/${dir}/package.json: no GitHub repository in ${url}`);
  return `https://raw.githubusercontent.com/${at[1]}/main/${path}`;
}

/**
 * A package's title, centred. npm keeps `align` on a heading, a paragraph and an image, and strips it from a `div`, so the
 * centre is set on these and never on a wrapper.
 * @param {string} dir
 */
export function titleLine(dir) {
  return `<h1 align="center">${manifestOf(dir).name}</h1>`;
}

/**
 * The block a package's README opens with, under its title: its own picture, described by what the picture says, at the
 * picture's own width, or, for `FAMILY_PAGE`, the family's.
 * @param {string} dir
 */
export function pictureBlock(dir) {
  const pictured = PACKAGE_PICTURES.find((p) => p.dir === dir);
  const [file, alt, width] =
    pictured === undefined
      ? [
          (/** @type {string} */ theme) => `docs/assets/the-family-${theme}.svg`,
          FAMILY_ALT,
          FAMILY_WIDTH,
        ]
      : [
          (/** @type {string} */ theme) => `packages/${dir}/assets/${dir}-${theme}.svg`,
          PACKAGE_ALT[/** @type {keyof typeof PACKAGE_ALT} */ (dir)],
          pictured.w,
        ];
  return [
    '<p align="center">',
    '<picture>',
    `  <source media="(prefers-color-scheme: dark)" srcset="${pictureUrl(dir, file('dark'))}">`,
    `  <img src="${pictureUrl(dir, file('light'))}" alt="${xml(alt)}" width="${width}">`,
    '</picture>',
    '</p>',
  ].join('\n');
}

/**
 * What the front page's README holds under the heading of the family, in place of its own picture: the family's, centred
 * like the pictures above it, at the family's width, by the address of the repository `@mnema/code`'s manifest names, with
 * no version in it.
 */
export function familyBlock() {
  const file = (/** @type {string} */ theme) => `docs/assets/the-family-${theme}.svg`;
  return [
    '<div align="center">',
    '',
    '<picture>',
    `  <source media="(prefers-color-scheme: dark)" srcset="${pictureUrl(FAMILY_PAGE, file('dark'))}">`,
    `  <img src="${pictureUrl(FAMILY_PAGE, file('light'))}" alt="${xml(FAMILY_ALT)}" width="${FAMILY_WIDTH}">`,
    '</picture>',
    '',
    '</div>',
  ].join('\n');
}

/**
 * The front page's README with the family's block in place: the one under the family's heading is replaced, and a README
 * with no such block is returned as it is, for the test to refuse.
 * @param {string} readme
 * @param {string} block
 */
export function withFamilyBlock(readme, block) {
  const at = new RegExp(`(${FAMILY_HEADING}\\n\\n)<div align="center">\\n[\\s\\S]*?\\n</div>`);
  return readme.replace(at, (_all, head) => `${head}${block}`);
}

/**
 * A package's README with its title and picture block in place: the first line is the title (a `# name` or the centred
 * one), and the block replaces the one there is, or is set under it.
 * @param {string} readme
 * @param {string} block
 * @param {string} title
 */
export function withPicture(readme, block, title) {
  const at = /(?:<p align="center">\n)?<picture>[\s\S]*?<\/picture>(?:\n<\/p>)?/;
  const first = readme.indexOf('\n');
  const body = `${title}${readme.slice(first)}`;
  if (at.test(body)) return body.replace(at, block);
  return `${title}\n\n${block}\n${readme.slice(first + 1)}`;
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const check = process.argv.includes('--check');
  /** @param {string} path */
  const committedAt = (path) => {
    try {
      return readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
    } catch {
      return '';
    }
  };
  const drawn = drawTheDiagrams();
  for (const dir of PICTURED_PAGES) {
    const readme = `packages/${dir}/README.md`;
    drawn[readme] = withPicture(committedAt(readme), pictureBlock(dir), titleLine(dir));
  }
  drawn['README.md'] = withFamilyBlock(committedAt('README.md'), familyBlock());
  let differs = 0;
  for (const [path, content] of Object.entries(drawn)) {
    const at = new URL(`../../${path}`, import.meta.url);
    if (check) {
      if (committedAt(path) !== content) {
        differs++;
        console.error(`${path} is not what the script draws today`);
      }
    } else if (committedAt(path) !== content) {
      mkdirSync(new URL('.', at), { recursive: true });
      writeFileSync(at, content);
      console.log(`wrote ${path}`);
    }
  }
  if (differs > 0) process.exit(1);
}
