// Draws the front page's banner, `docs/assets/banner-{dark,light}.svg`, in the family's paint and motion, and the social
// card. The diagrams of the README and of the packages, which this file drew once, are drawn in `.github/the-brand/`
// (`node .github/the-brand/diagrams.mjs`), and their text is outlines there; none of that is here.
//
// THE EXPORTS STAY BECAUSE OTHERS READ THEM: the site imports `CELL`, `inkFoot`, `PAGE` and `socialCard` from a checkout of
// this repository, the extension's icon builder imports `CELL`, `inkFoot` and `PAGE`, and a page of the record copies
// `PAGE`. This file imports statically nothing but `node:fs`, `node:url` and `./accent.mjs`, so that import keeps working in a checkout
// that has no `node_modules`.
//
// THE BANNER IS THE CONSOLE'S WORDMARK. Its rows are read from `THE_BLOCKS`
// (`packages/code/src/presentation/banner.ts`, through the build) and each glyph is drawn as
// geometry in a cell of the terminal's proportions: a full block as a filled cell, a
// double-line box glyph as its two strokes. Geometry rather than text, because GitHub serves an
// SVG as an image and a block font cannot be counted on there. Beside it, a short chain of
// blocks. The only hue is the accent (`accent.mjs`); everything else is a grey. A faint light
// passes over the letters and the blocks and moves nothing; out of it, the banner is as drawn.
//
// From the root of a built checkout (`pnpm build`):
//
//   node .github/the-front-page/draw.mjs          writes the pictures
//   node .github/the-front-page/draw.mjs --check  writes nothing; exits 1 if one differs
//
// `packages/code/tests/the-front-page-is-drawn-from-the-console.test.ts` calls
// `drawTheFrontPage` over the rows the console draws today and holds each committed banner to
// what it returns.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { ACCENT } from './accent.mjs';

/** The greys of each theme: GitHub's own text, muted text and border. */
const NEUTRAL = Object.freeze({
  dark: { text: '#f0f6fc', muted: '#9198a1', border: '#3d444d' },
  light: { text: '#1f2328', muted: '#59636e', border: '#d1d9e0' },
});

const SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans',Helvetica,Arial,sans-serif";
const MONO = "ui-monospace,SFMono-Regular,'SF Mono',Menlo,Consolas,'Liberation Mono',monospace";

/**
 * A number as the picture writes it: at most two decimals, no trailing zeros.
 * @param {number} value
 */
const n = (value) => String(Math.round(value * 100) / 100);

// ---------------------------------------------------------------------------------------------
// The wordmark

/** One terminal cell, in the proportions of a monospace font: twice as tall as it is wide. */
export const CELL = { w: 12, h: 24 };
/** A double line's two strokes: half the gap between their centres, and their width. */
export const DOUBLE = { half: 2.75, width: 1.5 };

/**
 * The strokes of a double-line box glyph in a cell at (x, y), as path data, or undefined for a
 * glyph that is not one. Each stroke runs to the cell's edge, so neighbours join.
 * @param {string} glyph
 * @param {number} x
 * @param {number} y
 * @returns {string | undefined}
 */
export function doubleLine(glyph, x, y) {
  const { w, h } = CELL;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const a = DOUBLE.half;
  const L = x;
  const R = x + w;
  const T = y;
  const B = y + h;
  /** @param {...[number, number]} points */
  const p = (...points) => `M${points.map(([px, py]) => `${n(px)} ${n(py)}`).join('L')}`;
  switch (glyph) {
    case '═':
      return p([L, cy - a], [R, cy - a]) + p([L, cy + a], [R, cy + a]);
    case '║':
      return p([cx - a, T], [cx - a, B]) + p([cx + a, T], [cx + a, B]);
    case '╔':
      return (
        p([R, cy - a], [cx - a, cy - a], [cx - a, B]) +
        p([R, cy + a], [cx + a, cy + a], [cx + a, B])
      );
    case '╗':
      return (
        p([L, cy - a], [cx + a, cy - a], [cx + a, B]) +
        p([L, cy + a], [cx - a, cy + a], [cx - a, B])
      );
    case '╚':
      return (
        p([cx - a, T], [cx - a, cy + a], [R, cy + a]) +
        p([cx + a, T], [cx + a, cy - a], [R, cy - a])
      );
    case '╝':
      return (
        p([cx + a, T], [cx + a, cy + a], [L, cy + a]) +
        p([cx - a, T], [cx - a, cy - a], [L, cy - a])
      );
    default:
      return undefined;
  }
}

/**
 * The wordmark as two paths, one for the blocks and one for the lines. One path each, so cells
 * that touch are filled as one shape and no seam shows between them at any scale.
 * @param {readonly string[]} blocks
 * @param {string} accent
 * @param {number} x0
 * @param {number} y0
 */
function wordmark(blocks, accent, x0, y0) {
  /** @type {string[]} */
  const fills = [];
  /** @type {string[]} */
  const strokes = [];
  blocks.forEach((row, r) => {
    [...row].forEach((glyph, c) => {
      const x = x0 + c * CELL.w;
      const y = y0 + r * CELL.h;
      if (glyph === ' ') return;
      if (glyph === '█') {
        // A cell reaches half a unit into a block beside it or under it, so no hairline of the
        // page shows where four corners meet; the outer edges stay on the grid.
        const w = CELL.w + ([...row][c + 1] === '█' ? 0.5 : 0);
        const h = CELL.h + ([...(blocks[r + 1] ?? '')][c] === '█' ? 0.5 : 0);
        fills.push(`M${n(x)} ${n(y)}h${w}v${h}h-${w}z`);
        return;
      }
      const line = doubleLine(glyph, x, y);
      if (line === undefined)
        throw new Error(`the wordmark has a glyph this cannot draw: ${glyph}`);
      strokes.push(line);
    });
  });
  return [
    `<path data-of="blocks" fill="${accent}" d="${fills.join('')}"/>`,
    `<path data-of="lines" fill="none" stroke="${accent}" stroke-opacity="0.55" stroke-width="${DOUBLE.width}" stroke-linejoin="miter" d="${strokes.join('')}"/>`,
  ];
}

/**
 * The wordmark alone, with no chain of blocks beside it, for the head of the site: the letters of the banner,
 * the same two paths from the same rows, in the accent of the theme and on no page of their own (the head is the
 * page's). One picture per theme, because a picture the page shows as an image cannot take the colour of its text.
 * @param {readonly string[]} blocks
 * @param {'dark' | 'light'} theme
 */
export function headerWordmark(blocks, theme) {
  const columns = Math.max(...blocks.map((row) => [...row].length));
  const w = columns * CELL.w;
  const h = inkFoot(blocks);
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${n(w)}" height="${n(h)}" viewBox="0 0 ${n(w)} ${n(h)}">`,
    ...wordmark(blocks, ACCENT[theme], 0, 0),
    '</svg>',
    '',
  ].join('\n');
}

/**
 * How far down the wordmark's ink reaches: a last row of shadow only ends at the lower stroke of
 * a double line on the middle of its cell, not at the cell's foot.
 * @param {readonly string[]} blocks
 */
export function inkFoot(blocks) {
  const shadowOnly = [...(blocks.at(-1) ?? '')].every((g) => ' ╚═╝'.includes(g));
  const height = blocks.length * CELL.h;
  return shadowOnly ? height - CELL.h / 2 + DOUBLE.half + DOUBLE.width / 2 : height;
}

// ---------------------------------------------------------------------------------------------
// The chain of blocks

const COS30 = Math.cos(Math.PI / 6);

/**
 * An isometric cube of edge `a` whose middle vertex is (x, y), its three faces shaded and its
 * edges stroked in the accent. A solid one has faces in the accent itself and no stroke: each face
 * is drawn in from its edges by the half of an edge's width, so the page parts them, on a cube
 * grown by as much, so its outline reaches as far as a stroked one's.
 * @param {number} x
 * @param {number} y
 * @param {number} a
 * @param {string} accent
 * @param {readonly number[]} shade
 * @param {boolean} [solid]
 */
function cube(x, y, a, accent, shade, solid = false) {
  const half = 1.75 / 2;
  const e = solid ? a + (2 * half) / COS30 : a;
  const dx = e * COS30;
  const top = [
    [x, y - e],
    [x + dx, y - e / 2],
    [x, y],
    [x - dx, y - e / 2],
  ];
  const left = [
    [x - dx, y - e / 2],
    [x, y],
    [x, y + e],
    [x - dx, y + e / 2],
  ];
  const right = [
    [x, y],
    [x + dx, y - e / 2],
    [x + dx, y + e / 2],
    [x, y + e],
  ];
  // A face is a rhombus whose middle is dx / 2 from each of its sides.
  const k = solid ? 1 - half / (dx / 2) : 1;
  /**
   * @param {number[][]} points
   * @param {number | undefined} opacity
   */
  const face = (points, opacity) => {
    const [mx = 0, my = 0] = [0, 1].map((j) => points.reduce((sum, p) => sum + (p[j] ?? 0), 0) / 4);
    const drawn = points.map(([px = 0, py = 0]) => [mx + (px - mx) * k, my + (py - my) * k]);
    return `<path d="M${drawn.map(([px, py]) => `${n(px ?? 0)} ${n(py ?? 0)}`).join('L')}z" fill="${accent}" fill-opacity="${opacity}"/>`;
  };
  const faces = [face(top, shade[0]), face(left, shade[1]), face(right, shade[2])];
  if (solid) return faces;
  return [
    ...faces,
    `<path d="M${n(x)} ${n(y - a)}L${n(x + dx)} ${n(y - a / 2)}L${n(x + dx)} ${n(y + a / 2)}L${n(x)} ${n(y + a)}L${n(x - dx)} ${n(y + a / 2)}L${n(x - dx)} ${n(y - a / 2)}zM${n(x - dx)} ${n(y - a / 2)}L${n(x)} ${n(y)}L${n(x + dx)} ${n(y - a / 2)}M${n(x)} ${n(y)}V${n(y + a)}" fill="none" stroke="${accent}" stroke-width="1.75" stroke-linejoin="round"/>`,
  ];
}

/**
 * Four cubes in a row, each linked to the one before it; the newest is the most solid.
 * @param {string} accent
 * @param {string} muted
 * @param {number} x0
 * @param {number} cy
 * @param {{ chain: readonly number[], newest: readonly number[], solid: boolean }} paint
 */
function chain(accent, muted, x0, cy, paint) {
  const a = 30;
  const dx = a * COS30;
  const link = 18;
  const step = 2 * dx + link;
  const shades = [paint.chain, paint.chain, paint.chain, paint.newest];
  /** @type {string[]} */
  const parts = [];
  for (let i = 0; i < shades.length; i++) {
    const x = x0 + dx + i * step;
    if (i > 0) {
      const from = x - step + dx;
      const to = x - dx;
      parts.push(
        `<path d="M${n(from + 3)} ${n(cy)}H${n(to - 3)}" stroke="${muted}" stroke-width="1.75" stroke-linecap="round"/>`,
        `<circle cx="${n(from)}" cy="${n(cy)}" r="2.5" fill="${muted}"/>`,
        `<circle cx="${n(to)}" cy="${n(cy)}" r="2.5" fill="${muted}"/>`,
      );
    }
    parts.push(...cube(x, cy, a, accent, shades[i] ?? [], i === 3 && paint.solid));
  }
  return { parts, width: shades.length * 2 * dx + (shades.length - 1) * link };
}

/** The room between what the banner, the steps and how mnema fits draw and each side of their frame. */
const FRONT_MARGIN = 8;

/** The banner's loop, in seconds: long, for a light that is barely there. */
const BANNER_LOOP = 12;
/** How many columns of the wordmark one band of the light that passes over the letters covers. */
const BAND_COLUMNS = 4;

/**
 * The banner, in the family's paint: its own page and the glow behind it, and a light that is
 * barely there. A band of light passes over the letters from left to right, then the four cubes
 * light one after the other, and all four go dark together; nothing moves. Every light is laid
 * over the drawing and is out in the last frame, so a reader who asked for less motion sees the
 * banner as it is drawn.
 * @param {readonly string[]} blocks
 * @param {'dark' | 'light'} theme
 */
function banner(blocks, theme) {
  const s = { ...scene(BANNER_LOOP, theme), paint: frontPalette(theme) };
  const accent = ACCENT[theme];
  const { muted, text } = NEUTRAL[theme];
  const columns = Math.max(...blocks.map((row) => [...row].length));
  const markWidth = columns * CELL.w;
  const gap = 56;
  // The drawing on the middle of the frame, the margin in from each side: the cubes' outer stroke
  // reaches past their row by half its width, and the last row of the wordmark is shadow only,
  // whose lowest stroke is the lower one of a double line on the middle of its cell.
  const x0 = FRONT_MARGIN;
  const y0 = FRONT_MARGIN;
  const foot = inkFoot(blocks);
  // The chain sits on the middle of the letters' faces.
  const middle = y0 + ((blocks.length - 1) * CELL.h) / 2;
  const { parts, width } = chain(accent, muted, x0 + markWidth + gap, middle, s.paint);
  // Written to a hundredth, up, so the margin on the right is never under the one on the left.
  const w = Math.ceil((x0 + markWidth + gap + width + 1.75 / 2 + FRONT_MARGIN) * 100) / 100;
  const h = y0 + foot + FRONT_MARGIN;
  const [blockPath, linePath] = wordmark(blocks, accent, x0, y0);
  const letters = /\bd="([^"]*)"/.exec(blockPath ?? '')?.[1] ?? '';
  /** @type {string[]} */
  const light = [];
  // The light over the letters: a band of columns at a time, each up and down once, the next a
  // little after, in the deepest grey of the theme over the accent, faint.
  const bands = Math.ceil(columns / BAND_COLUMNS);
  for (let k = 0; k < bands; k++) {
    const t = 0.8 + 0.15 * k;
    light.push(
      `<rect ${s.goes(
        [
          [0, '0'],
          [t, '0'],
          [t + 0.6, '1'],
          [t + 1.4, '0'],
          [s.loop, '0'],
        ],
        '0',
      )} x="${n(x0 + k * BAND_COLUMNS * CELL.w)}" y="${y0}" width="${BAND_COLUMNS * CELL.w}" height="${foot}" fill="${text}" fill-opacity="0.16" clip-path="url(#letters)"/>`,
    );
  }
  // The cubes light one after the other, faintly, and go dark together.
  const a = 30;
  const step = 2 * a * COS30 + 18;
  for (let i = 0; i < 4; i++) {
    const t = 4.2 + 0.5 * i;
    light.push(
      `<path ${s.goes(
        [
          [0, '0'],
          [t, '0'],
          [t + 0.8, '1'],
          [9.0, '1'],
          [9.8, '0'],
          [s.loop, '0'],
        ],
        '0',
      )} d="${hexagon(x0 + markWidth + gap + a * COS30 + i * step, middle, a)}" fill="${accent}" fill-opacity="${s.paint.glows}"/>`,
    );
  }
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${n(w)}" height="${n(h)}" viewBox="0 0 ${n(w)} ${n(h)}" role="img" aria-label="mnema">`,
    '<title>mnema</title>',
    '<style>',
    `.a{animation-duration:${BANNER_LOOP}s;animation-iteration-count:infinite;animation-timing-function:ease-in-out}`,
    ...s.css,
    '@media (prefers-reduced-motion: reduce){.a{animation:none!important}}',
    '</style>',
    `<defs><clipPath id="letters"><path d="${letters}"/></clipPath></defs>`,
    ...s.paint.defs,
    `<rect width="${n(w)}" height="${n(h)}" fill="${PAGE[theme]}"/>`,
    `<ellipse cx="${n(w / 2)}" cy="${n(h / 2)}" rx="${n(w / 2 - 8)}" ry="${n(h / 2)}" fill="url(#glow)"/>`,
    blockPath,
    linePath,
    ...parts,
    ...light,
    '</svg>',
    '',
  ].join('\n');
}

/** The size of the social card, the one every link preview takes: 1200 by 630. */
export const CARD = Object.freeze({ w: 1200, h: 630 });

/**
 * A text broken into lines no wider than `limit`, each character counted at the monospace advance
 * (`ADVANCE`), which a sans face never exceeds, so a line drawn in `SANS` always fits.
 * @param {string} text
 * @param {number} size
 * @param {number} limit
 * @returns {string[]}
 */
function wrapped(text, size, limit) {
  /** @type {string[]} */
  const lines = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    const next = line === '' ? word : `${line} ${word}`;
    if (line !== '' && [...next].length * size * ADVANCE > limit) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line !== '') lines.push(line);
  return lines;
}

/**
 * The social card of the site, one picture for every page: a link preview takes a still image. The banner's
 * wordmark and four cubes, drawn by the pieces the banner draws with and nothing that moves, on the dark
 * page, and under them the pitch of the README, its line and its paragraph, as the only words. Each line
 * is a `<text>` in the front page's sans face; the card is rasterized with those letters drawn.
 * @param {{ blocks: readonly string[], pitch: { title: string, body: string } }} options
 */
export function socialCard({ blocks, pitch }) {
  const theme = 'dark';
  const paint = frontPalette(theme);
  const accent = ACCENT[theme];
  const { muted, text } = NEUTRAL[theme];
  const columns = Math.max(...blocks.map((row) => [...row].length));
  const markWidth = columns * CELL.w;
  const middle = ((blocks.length - 1) * CELL.h) / 2;
  const gap = 56;
  const [blockPath, linePath] = wordmark(blocks, accent, 0, 0);
  const { parts } = chain(accent, muted, markWidth + gap, middle, paint);
  const scale = 1.1;
  const left = 80;
  const top = 84;
  const limit = CARD.w - 2 * left;
  /**
   * @param {string[]} lines
   * @param {number} size
   * @param {string} weight
   * @param {string} fill
   * @param {number} y
   * @param {number} step
   */
  const setLines = (lines, size, weight, fill, y, step) =>
    lines.map(
      (line, i) =>
        `<text x="${left}" y="${n(y + i * step)}" font-family="${SANS}" font-size="${size}"${weight === '' ? '' : ` font-weight="${weight}"`} fill="${fill}">${escaped(line)}</text>`,
    );
  const title = wrapped(pitch.title, 52, limit);
  const titleY = top + inkFoot(blocks) * scale + 96;
  const body = wrapped(pitch.body, 28, limit);
  const bodyY = titleY + (title.length - 1) * 64 + 64;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD.w}" height="${CARD.h}" viewBox="0 0 ${CARD.w} ${CARD.h}">`,
    ...paint.defs,
    `<rect width="${CARD.w}" height="${CARD.h}" fill="${PAGE[theme]}"/>`,
    `<ellipse cx="${CARD.w / 2}" cy="${CARD.h / 2}" rx="${CARD.w / 2 - 8}" ry="${CARD.h / 2}" fill="url(#glow)"/>`,
    `<g transform="translate(${left} ${top}) scale(${scale})">`,
    blockPath,
    linePath,
    ...parts,
    '</g>',
    ...setLines(title, 52, '600', text, titleY, 64),
    ...setLines(body, 28, '', muted, bodyY, 40),
    '</svg>',
    '',
  ].join('\n');
}

// ---------------------------------------------------------------------------------------------
// What the banner is drawn with: a scene of keyframes, and the paint of a theme
//
// `scene` also carries helpers that write text and that give an element its keyframes (`say`, `sayIn`, `stays`, `passes`,
// `leaves`); the banner calls none of them. They are what the diagrams were once drawn with, and stay only because `scene`
// is one function that the banner calls whole. The diagrams are drawn in `.github/the-brand/`.

/** @param {string} text */
const escaped = (text) =>
  text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

const LOOP = 14;

/**
 * Keyframes for one property over the loop, from [seconds, value] stops. The first stop must
 * be at 0 and the last at LOOP, with the same value, so the loop closes on itself.
 * @param {string} name
 * @param {string} property
 * @param {[number, string][]} stops
 * @param {number} [loop]
 */
function keyframes(name, property, stops, loop = LOOP) {
  const at = stops.map(([t, v]) => `${n((t / loop) * 100)}%{${property}:${v}}`).join('');
  return `@keyframes ${name}{${at}}`;
}

/**
 * An opacity that is 0 outside [from, to], fading over `fade` seconds at each end.
 * @param {number} from
 * @param {number} to
 * @param {number} [fade]
 * @param {number} [loop]
 * @returns {[number, string][]}
 */
function shown(from, to, fade = 0.3, loop = LOOP) {
  return [
    [0, '0'],
    [from, '0'],
    [from + fade, '1'],
    [to - fade, '1'],
    [to, '0'],
    [loop, '0'],
  ];
}

/** @typedef {{ said: string, where: string }} Said */
/** @typedef {readonly (Said | string)[]} Line */

/**
 * What a line puts on the picture.
 * @param {Line} line
 */
const textOf = (line) => line.map((p) => (typeof p === 'string' ? p : p.said)).join('');

/**
 * The page of each theme: the ground the banner and the social card are drawn on, and the one the
 * site and the extension's icon read.
 */
export const PAGE = Object.freeze({ dark: '#0d1117', light: '#ffffff' });

/**
 * One size for each role a text plays in `scene`'s `say`: the name of a thing, the name on a box, a
 * grey caption beside a thing, a literal of code or of output, and a row of a list or of a table.
 * `centre` is how far below the middle of a box the baseline of a line of that size goes for its
 * ink to sit on the middle. Nothing draws with these now that the banner is the only picture
 * `scene` serves.
 */
const TYPE = Object.freeze({
  heading: { size: 15, weight: '600', centre: 4.7 },
  label: { size: 13, weight: '600', centre: 4 },
  caption: { size: 12, weight: '', centre: 3.7 },
  code: { size: 12, weight: '', centre: 3.7 },
  value: { size: 12, weight: '', centre: 3.7 },
});

/** @typedef {keyof typeof TYPE} Role */

/** Half the distance between two rows of text inside a box. */
const HALF_ROW = 10;
/** The advance of one character of the monospace face, as a share of its size. */
const ADVANCE = 0.6;

/**
 * The baseline of a line of a role inside a box, `row` half rows off its middle.
 * @param {{ y: number, h: number }} frame
 * @param {Role} role
 * @param {number} [row]
 */
const inside = (frame, role, row = 0) => frame.y + frame.h / 2 + TYPE[role].centre + row * HALF_ROW;

/**
 * The paint of one theme, and the helpers that give an element its keyframes over a package's
 * own loop. An element that `stays` is there in the last frame and carries no opacity of its
 * own; one that `passes` is not, and carries `opacity="0"`. Everything there in the last frame
 * leaves at once, at `ends` (`leaves`), so nothing is left alone on the page at the end of a loop.
 * @param {number} loop
 * @param {'dark' | 'light'} theme
 */
function scene(loop, theme) {
  const accent = ACCENT[theme];
  const { text, muted, border } = NEUTRAL[theme];
  /** @type {string[]} */
  const css = [];
  let count = 0;
  /**
   * @param {string} property
   * @param {[number, string][]} stops
   */
  const animate = (property, stops) => {
    const name = `k${count++}`;
    css.push(keyframes(name, property, stops, loop));
    return name;
  };
  const ends = loop - 0.7;
  /**
   * The stops of an element there in the last frame, closed the way every such element closes.
   * @param {[number, string][]} stops
   * @returns {[number, string][]}
   */
  const leaves = (stops) => [...stops, [ends - 0.3, '1'], [ends, '0'], [loop, '0']];
  /**
   * @param {[number, string][]} stops
   * @param {string} last the opacity of the last frame
   */
  const goes = (stops, last) =>
    `class="a" style="animation-name:${animate('opacity', stops)}"${last === '1' ? '' : ` opacity="${last}"`}`;
  /**
   * A line as a text element, in the size of its role.
   * @param {Line} line
   * @param {number} x
   * @param {number} y
   * @param {Role} role
   * @param {{ fill?: string, anchor?: string, attrs?: string }} [o]
   */
  const say = (line, x, y, role, o = {}) =>
    `<text${o.attrs ? ` ${o.attrs}` : ''} x="${n(x)}" y="${n(y)}" font-family="${MONO}" font-size="${TYPE[role].size}"${TYPE[role].weight ? ` font-weight="${TYPE[role].weight}"` : ''} fill="${o.fill ?? (role === 'caption' ? muted : text)}"${o.anchor ? ` text-anchor="${o.anchor}"` : ''}>${escaped(textOf(line))}</text>`;
  return {
    theme,
    accent,
    text,
    muted,
    border,
    paint: palette(theme),
    css,
    loop,
    ends,
    animate,
    goes,
    leaves,
    /** @param {number} from */
    stays: (from) =>
      goes(
        leaves([
          [0, '0'],
          [from, '0'],
          [from + 0.3, '1'],
        ]),
        '1',
      ),
    /** @param {number} from @param {number} to */
    passes: (from, to) => goes(shown(from, to, 0.3, loop), '0'),
    say,
    /**
     * A line inside a box, the only way a text is put in one: on the box's middle, or `row` half
     * rows above (negative) or below it.
     * @param {Line} line
     * @param {number} x
     * @param {{ y: number, h: number }} frame
     * @param {Role} role
     * @param {{ fill?: string, anchor?: string, attrs?: string }} [o]
     * @param {number} [row]
     */
    sayIn: (line, x, frame, role, o = {}, row = 0) =>
      say(line, x, inside(frame, role, row), role, o),
  };
}

/** @typedef {ReturnType<typeof scene>} Scene */

/**
 * The outline of a cube, as path data, for a glow laid over it.
 * @param {number} x
 * @param {number} cy
 * @param {number} a
 */
function hexagon(x, cy, a) {
  const dx = a * COS30;
  return `M${n(x)} ${n(cy - a)}L${n(x + dx)} ${n(cy - a / 2)}L${n(x + dx)} ${n(cy + a / 2)}L${n(x)} ${n(cy + a)}L${n(x - dx)} ${n(cy + a / 2)}L${n(x - dx)} ${n(cy - a / 2)}z`;
}

/** How strongly the three faces of a cube on a package's picture are filled: top, left, right. */
const SHADE = Object.freeze([0.3, 0.16, 0.06]);

/**
 * The paint of a theme beyond the accent and the greys: the glow behind the drawing and the tint
 * of a card, both in the accent alone, and how strongly a landing cube and a tab are filled. On a
 * light page they stay faint enough that the accent's own lines over them keep three to one.
 * @param {'dark' | 'light'} theme
 */
function palette(theme) {
  const accent = ACCENT[theme];
  const glow = theme === 'light' ? [0.08, 0.03] : [0.16, 0.06];
  const tint = theme === 'light' ? [0.07, 0.02] : [0.12, 0.04];
  return {
    defs: [
      '<defs>',
      `<radialGradient id="glow" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="${accent}" stop-opacity="${glow[0]}"/><stop offset="0.6" stop-color="${accent}" stop-opacity="${glow[1]}"/><stop offset="1" stop-color="${accent}" stop-opacity="0"/></radialGradient>`,
      `<linearGradient id="tint" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${accent}" stop-opacity="${tint[0]}"/><stop offset="1" stop-color="${accent}" stop-opacity="${tint[1]}"/></linearGradient>`,
      '</defs>',
    ],
    // On a light page a cube lights in the accent itself: anything fainter is under three to one
    // against the glow behind it.
    lit: theme === 'light' ? '1' : '0.85',
    // A tab's edge keeps three to one against its own inside: on a light page, a fainter inside.
    tab: theme === 'light' ? '0.05' : '0.12',
    // The halo around a dot that runs a line.
    halo: '0.22',
  };
}

/**
 * The paint of the banner, the steps and how mnema fits. On a dark page it is the family's. On a
 * light page the accent itself is under three and a half to one on the page, so every surface a
 * line, a dot or an edge in the accent lies on is fainter than the family's: the glow, a card's
 * tint, the inside of a number, a tab, a halo and the faces of a cube, laid one over the other,
 * stay at about a tenth of the accent or under, where the accent keeps three to one. What is
 * solid is the accent itself, its faces parted by the page.
 * @param {'dark' | 'light'} theme
 */
function frontPalette(theme) {
  const family = palette(theme);
  if (theme === 'dark')
    return {
      ...family,
      badge: '0.22',
      highlight: '0.16',
      shade: SHADE,
      chain: [0.16, 0.08, 0.03],
      newest: [0.85, 0.55, 0.3],
      solid: false,
      chip: '',
      glows: '0.3',
    };
  const accent = ACCENT.light;
  return {
    ...family,
    defs: [
      '<defs>',
      `<radialGradient id="glow" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="${accent}" stop-opacity="0.02"/><stop offset="0.6" stop-color="${accent}" stop-opacity="0.01"/><stop offset="1" stop-color="${accent}" stop-opacity="0"/></radialGradient>`,
      `<linearGradient id="tint" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${accent}" stop-opacity="0.04"/><stop offset="1" stop-color="${accent}" stop-opacity="0.01"/></linearGradient>`,
      '</defs>',
    ],
    tab: '0.03',
    // A chip's edge, a hair heavier: one unit round its small corners is under three to one.
    chip: '1.5',
    halo: '0.06',
    badge: '0.04',
    highlight: '0.04',
    shade: [0.05, 0.025, 0],
    chain: [0.04, 0.02, 0],
    // The newest cube is the accent itself, its faces parted by the page.
    newest: [1, 1, 1],
    solid: true,
    glows: '0.04',
  };
}

/** @typedef {{ x: number, y: number, w: number, h: number }} Frame */

/**
 * The banner of each theme, by its file name under `docs/assets/`, drawn from the console's rows.
 * @param {readonly string[]} blocks
 * @returns {Record<string, string>}
 */
export function drawTheFrontPage(blocks) {
  return {
    'banner-dark.svg': banner(blocks, 'dark'),
    'banner-light.svg': banner(blocks, 'light'),
  };
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const built = new URL('../../packages/code/dist/presentation/banner.js', import.meta.url);
  const { THE_BLOCKS } = await import(built.href);
  const check = process.argv.includes('--check');
  /** @param {string} path */
  const committedAt = (path) => {
    try {
      return readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
    } catch {
      return '';
    }
  };
  /** @type {Record<string, string>} */
  const drawn = {};
  for (const [file, svg] of Object.entries(drawTheFrontPage(THE_BLOCKS)))
    drawn[`docs/assets/${file}`] = svg;
  let differs = 0;
  for (const [path, content] of Object.entries(drawn)) {
    const at = new URL(`../../${path}`, import.meta.url);
    if (check) {
      if (committedAt(path) !== content) {
        differs++;
        console.error(`${path} is not what the console draws today`);
      }
    } else if (committedAt(path) !== content) {
      mkdirSync(new URL('.', at), { recursive: true });
      writeFileSync(at, content);
      console.log(`wrote ${path}`);
    }
  }
  if (differs > 0) process.exit(1);
}
