// The text of a picture, as the outline of its glyphs. GitHub shows an SVG as an image, and an image loads no web font:
// text left as text would be drawn in whatever face each machine has. The glyphs are drawn from the fonts committed in
// `./fonts/` (see `./fonts/SOURCES.md`), read with `opentype.js`.
//
// `font.getPath` and `font.getAdvanceWidth` throw on Archivo's glyph substitutions (measured with opentype.js 2.0.0),
// so a line is drawn glyph by glyph: each glyph's path at its own place, a pair's kerning added before the glyph, no
// substitution. A glyph writes the advance of the instance it was last drawn at into its own object, so the advances are
// read right after each glyph is drawn in the instance of the role, never before. `toPathData` of the same version writes
// `NaN` for some coordinates (the lowercase a of IBM Plex Mono Regular at x = 161.42000000000002), so the data is written
// here from the path's commands, and `the-front-page-is-drawn-from-the-console.test.ts` refuses a `NaN` in a picture.

import { readFileSync } from 'node:fs';

/**
 * The part of `opentype.js` this file uses: the package ships no declarations.
 * @typedef {{ type: string, x?: number, y?: number, x1?: number, y1?: number, x2?: number, y2?: number }} PathCommand
 * @typedef {{ commands: PathCommand[] }} OutlinePath
 * @typedef {{
 *   index: number,
 *   advanceWidth?: number,
 *   getPath: (x: number, y: number, size: number, options: { variation?: Record<string, number> }, font: Face) => OutlinePath,
 * }} Glyph
 * @typedef {{
 *   unitsPerEm: number,
 *   charToGlyph: (ch: string) => Glyph,
 *   getKerningValue: (left: Glyph, right: Glyph) => number,
 * }} Face
 * @typedef {{ parse: (data: ArrayBuffer) => Face }} Opentype
 */
const spec = 'opentype.js';
const loaded = /** @type {{ default?: Opentype } & Opentype} */ (await import(spec));
const opentype = loaded.default ?? loaded;

/** @param {string} file */
const face = (file) => {
  const bytes = readFileSync(new URL(`./fonts/${file}`, import.meta.url));
  return opentype.parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
};

const archivo = face('Archivo[wdth,wght].ttf');
const plex = {
  400: face('IBMPlexMono-Regular.ttf'),
  500: face('IBMPlexMono-Medium.ttf'),
  600: face('IBMPlexMono-SemiBold.ttf'),
};

/**
 * Every role a text plays in a picture, as a face, its width and weight (Archivo's two axes; IBM Plex Mono has files
 * for each weight) and its final size in units. A text is drawn by its role and by nothing else: the `Role` type is the
 * key of this table, so a role that is not here does not pass `pnpm typecheck`.
 */
export const ROLES = Object.freeze({
  title: { face: archivo, variation: { wdth: 125, wght: 300 }, size: 20 },
  state: { face: archivo, variation: { wdth: 125, wght: 300 }, size: 24 },
  step: { face: archivo, variation: { wdth: 125, wght: 300 }, size: 28 },
  prose: { face: archivo, variation: { wdth: 100, wght: 400 }, size: 18.2 },
  name: { face: plex[600], variation: undefined, size: 18.2 },
  label: { face: plex[600], variation: undefined, size: 16.9 },
  chip: { face: plex[500], variation: undefined, size: 16.9 },
  note: { face: plex[400], variation: undefined, size: 15.6 },
  noteStrong: { face: plex[600], variation: undefined, size: 15.6 },
  small: { face: plex[400], variation: undefined, size: 14.95 },
  smallStrong: { face: plex[600], variation: undefined, size: 14.95 },
  tiny: { face: plex[400], variation: undefined, size: 14.3 },
});

/** One decimal, computed on the absolute coordinate so that no rounding drifts along a path. @param {number} n */
const tenth = (n) => Math.round(n * 10) / 10;

/**
 * The data of a path from its commands: a move in absolute terms, every other command relative to the point before it,
 * each number to one decimal. The decimal is taken from the absolute coordinate first and the step is the difference of
 * two rounded absolutes, so the error of a point never exceeds half a tenth of a unit. A coordinate that is not a
 * number is written as `NaN` so that the guard sees it.
 * @param {readonly PathCommand[]} commands
 */
const dataOf = (commands) => {
  let px = 0;
  let py = 0;
  let sx = 0;
  let sy = 0;
  return commands
    .map(({ type, x, y, x1, y1, x2, y2 }) => {
      if (type === 'Z') {
        px = sx;
        py = sy;
        return 'z';
      }
      const pairs = [
        [x1, y1],
        [x2, y2],
        [x, y],
      ].filter(([a]) => a !== undefined);
      const numbers = pairs.flatMap(([a, b]) => {
        const ax = tenth(/** @type {number} */ (a));
        const ay = tenth(/** @type {number} */ (b));
        return type === 'M' ? [ax, ay] : [tenth(ax - px), tenth(ay - py)];
      });
      const last = pairs[pairs.length - 1];
      px = tenth(/** @type {number} */ (last?.[0]));
      py = tenth(/** @type {number} */ (last?.[1]));
      if (type === 'M') {
        sx = px;
        sy = py;
      }
      const letter = type === 'M' ? 'M' : type.toLowerCase();
      return letter + numbers.map(String).join(' ').replaceAll(' -', '-');
    })
    .join('');
};

/** @typedef {keyof typeof ROLES} Role */
/** @typedef {'start' | 'middle' | 'end'} Anchor */

/**
 * The outline of one line of text as the data of a path, in the role's instance, on the baseline `y`, anchored at `x`.
 * A character the face has no glyph for is refused, never drawn as a box.
 * @param {string} text
 * @param {Role} role
 * @param {number} x
 * @param {number} y
 * @param {Anchor} anchor
 */
export function outlineOf(text, role, x, y, anchor) {
  const { face: font, variation, size } = ROLES[role];
  const options = variation === undefined ? {} : { variation };
  const scale = size / font.unitsPerEm;
  const glyphs = [...text].map((ch) => {
    const glyph = font.charToGlyph(ch);
    if (glyph.index === 0)
      throw new Error(`no glyph for ${JSON.stringify(ch)} in the face of the role ${role}`);
    return glyph;
  });
  // First pass: draw each glyph in the instance, then read the advance it left.
  const advances = glyphs.map((glyph) => {
    glyph.getPath(0, 0, size, options, font);
    return (glyph.advanceWidth ?? 0) * scale;
  });
  const kerns = glyphs.map((glyph, i) => {
    const before = glyphs[i - 1];
    return before === undefined ? 0 : font.getKerningValue(before, glyph) * scale;
  });
  const width = advances.reduce((sum, a, i) => sum + a + (kerns[i] ?? 0), 0);
  let at = anchor === 'middle' ? x - width / 2 : anchor === 'end' ? x - width : x;
  return glyphs
    .map((glyph, i) => {
      at += kerns[i] ?? 0;
      const d = dataOf(glyph.getPath(at, y, size, options, font).commands);
      at += advances[i] ?? 0;
      return d;
    })
    .join('');
}
