// Draws the social card, and keeps the pieces that others read. The README's banner is not drawn here: it is the lockup of
// the brand, the eye and the word, and `node .github/the-brand/banner.mjs` draws it. The diagrams of the README and of the
// packages are drawn in `.github/the-brand/` too (`node .github/the-brand/diagrams.mjs`). Not every picture of the
// repository is drawn from the console's rows any more: this one is, and it is the social card.
//
// THE EXPORTS STAY BECAUSE OTHERS READ THEM: the site imports `CELL`, `inkFoot`, `PAGE` and `socialCard` from a checkout of
// this repository, the extension's icon builder imports `CELL`, `inkFoot` and `PAGE`, and a page of the record copies
// `PAGE`. This file imports statically nothing but `./accent.mjs`, so that import keeps working in a checkout that has no
// `node_modules`, and it imports nothing of `.github/the-brand/`, whose outlines need `opentype.js`.
//
// THE SOCIAL CARD IS THE CONSOLE'S WORDMARK. Its rows are read from `THE_BLOCKS`
// (`packages/code/src/presentation/banner.ts`, through the build, by the site) and each glyph is drawn as geometry in a cell
// of the terminal's proportions: a full block as a filled cell, a double-line box glyph as its two strokes. Geometry rather
// than text, because a link preview is an image. Beside it, a short chain of blocks, and under it the pitch of the README.
//
// `packages/code/tests/the-front-page-is-drawn-from-the-console.test.ts` holds what this file exports to the values it has
// today: `CELL`, `PAGE`, `inkFoot` and the bytes of `socialCard`.

import { ACCENT } from './accent.mjs';

/** The greys of each theme: GitHub's own text, muted text and border. */
const NEUTRAL = Object.freeze({
  dark: { text: '#f0f6fc', muted: '#9198a1', border: '#3d444d' },
  light: { text: '#1f2328', muted: '#59636e', border: '#d1d9e0' },
});

const SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans',Helvetica,Arial,sans-serif";

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
 * The social card of the site, one picture for every page: a link preview takes a still image. The console's
 * wordmark and four cubes, nothing that moves, on the dark page, and under them the pitch of the README, its line
 * and its paragraph, as the only words. Each line
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

/** @param {string} text */
const escaped = (text) =>
  text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

/**
 * The page of each theme: the ground the social card is drawn on, and the one the site and the extension's icon
 * read.
 */
export const PAGE = Object.freeze({ dark: '#0d1117', light: '#ffffff' });

/** The advance of one character of the monospace face, as a share of its size. */
const ADVANCE = 0.6;

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
 * The paint of the social card, the steps and how mnema fits. On a dark page it is the family's. On a
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
