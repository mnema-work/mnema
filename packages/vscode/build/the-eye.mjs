/**
 * The eye of the brand as the extension draws it: the one door through which the extension's icons reach the eye's
 * geometry, which lives in the brand's own source (`EYE_AT_REST`, `.github/the-brand/eye.mjs`) and nowhere else. The eye
 * is the one at rest, looking ahead, with no glint, no pupil and no motion: the almond it is clipped to, the iris, and the
 * six lines of the field drawn over the iris with round ends.
 *
 * Three things are drawn from it, all when the extension is packed and none kept in the tree: the store icon and the
 * plugin's (`icon.mjs`, from `paintAt`), the side bar's monochrome SVG (`drawActivityIcon`) and the status bar's glyph
 * (`icon-font.mjs`, from `almondEdges`, `EYE.iris` and `lineEdges`). Every length is in the units of the brand's frame,
 * the view box `-48 -48 96 96`, with y growing downward as in the pictures.
 */

import { EYE_AT_REST } from '../../../.github/the-brand/eye.mjs';

/**
 * The commands of an absolute path (`M`, `Q`, `C`, `Z`) as curves: each one its points, the start included.
 * @param {string} d
 * @returns {number[][][]}
 */
function curvesOf(d) {
  const tokens = d.match(/[MQCZ]|-?\d*\.?\d+(?:e-?\d+)?/g) ?? [];
  const curves = [];
  let at = [0, 0];
  let start = at;
  let command = '';
  let i = 0;
  const next = () => [Number(tokens[i++]), Number(tokens[i++])];
  while (i < tokens.length) {
    if (/[A-Z]/.test(tokens[i])) command = tokens[i++];
    if (command === 'M') {
      at = next();
      start = at;
    } else if (command === 'Q') {
      const curve = [at, next(), next()];
      curves.push(curve);
      at = curve[2];
    } else if (command === 'C') {
      const curve = [at, next(), next(), next()];
      curves.push(curve);
      at = curve[3];
    } else if (command === 'Z') {
      at = start;
    } else throw new Error(`a path command the eye does not hold: ${command}`);
  }
  return curves;
}

/** A point of a Bézier curve of any degree at `t`, by de Casteljau. */
function pointOf(curve, t) {
  let points = curve;
  while (points.length > 1) {
    const reduced = [];
    for (let k = 0; k < points.length - 1; k++) {
      const [ax, ay] = points[k];
      const [bx, by] = points[k + 1];
      reduced.push([ax + (bx - ax) * t, ay + (by - ay) * t]);
    }
    points = reduced;
  }
  return points[0];
}

/** The shapes of the eye at rest, read from the brand: the almond's two quadratics, the iris and the six lines. */
export const EYE = Object.freeze({
  almond: Object.freeze(curvesOf(EYE_AT_REST.almond)),
  iris: Object.freeze({ ...EYE_AT_REST.iris }),
  lines: Object.freeze(
    EYE_AT_REST.lines.map(({ d, width }) => Object.freeze({ d, width, curves: curvesOf(d) })),
  ),
});

/**
 * The almond as two edges over x: `top(x)` and `bottom(x)`, from `left` to `right`. Each of its two quadratics runs from
 * one tip to the other, so it is solved for the t at which it reaches x.
 */
export const almondEdges = (() => {
  const [first, second] = EYE.almond;
  const yAt = (curve, x) => {
    const [[x0], [x1], [x2]] = curve;
    // x(t) = (x0 - 2 x1 + x2) t^2 + 2 (x1 - x0) t + x0
    const a = x0 - 2 * x1 + x2;
    const b = 2 * (x1 - x0);
    const c = x0 - x;
    let t;
    if (Math.abs(a) < 1e-12) t = -c / b;
    else {
      const root = Math.sqrt(Math.max(0, b * b - 4 * a * c));
      t = (-b + root) / (2 * a);
      if (t < -1e-9 || t > 1 + 1e-9) t = (-b - root) / (2 * a);
    }
    return pointOf(curve, Math.min(1, Math.max(0, t)))[1];
  };
  const xs = [...first, ...second].map(([x]) => x);
  const left = Math.min(...xs);
  const right = Math.max(...xs);
  const [upper, lower] =
    pointOf(first, 0.5)[1] < pointOf(second, 0.5)[1] ? [first, second] : [second, first];
  return Object.freeze({
    left,
    right,
    /** @param {number} x */
    top: (x) => (x < left || x > right ? Number.NaN : yAt(upper, x)),
    /** @param {number} x */
    bottom: (x) => (x < left || x > right ? Number.NaN : yAt(lower, x)),
  });
})();

/** The step, in units of the frame, of the tables that hold the edges of each line. */
const STEP = 1 / 64;
/** How many points of each cubic the edges are taken over. */
const PER_CURVE = 96;

/**
 * The edges of one line drawn with its width and round ends, as two tables over x: at each x, the highest and the lowest
 * y the stroke covers (every point within half the width of the line). The line runs left to right and bends gently, so
 * each column of the stroke is one interval.
 */
function edgesOf({ curves, width }) {
  const half = width / 2;
  const points = curves.flatMap((curve, k) =>
    Array.from({ length: k === curves.length - 1 ? PER_CURVE + 1 : PER_CURVE }, (_, j) =>
      pointOf(curve, j / PER_CURVE),
    ),
  );
  points.sort((p, q) => p[0] - q[0]);
  const from = points[0][0] - half;
  const to = points[points.length - 1][0] + half;
  const count = Math.ceil((to - from) / STEP) + 1;
  const top = new Float64Array(count).fill(Number.POSITIVE_INFINITY);
  const bottom = new Float64Array(count).fill(Number.NEGATIVE_INFINITY);
  for (const [px, py] of points) {
    const first = Math.max(0, Math.ceil((px - half - from) / STEP));
    const last = Math.min(count - 1, Math.floor((px + half - from) / STEP));
    for (let n = first; n <= last; n++) {
      const dx = from + n * STEP - px;
      const rise = Math.sqrt(Math.max(0, half * half - dx * dx));
      if (py - rise < top[n]) top[n] = py - rise;
      if (py + rise > bottom[n]) bottom[n] = py + rise;
    }
  }
  /** @param {Float64Array} table */
  const read = (table) => (x) => {
    const at = (x - from) / STEP;
    const n = Math.floor(at);
    if (n < 0 || n >= count - 1) return Number.NaN;
    const a = table[n];
    const b = table[n + 1];
    if (!Number.isFinite(a) || !Number.isFinite(b)) return Number.NaN;
    return a + (b - a) * (at - n);
  };
  return Object.freeze({ from, to, top: read(top), bottom: read(bottom) });
}

/**
 * The edges of each of the six lines, in the order of `EYE.lines`: `top(x)` and `bottom(x)`, the stroke's column at x,
 * from `from` to `to`; outside a stroke both are NaN.
 * @type {readonly Readonly<{ from: number, to: number, top: (x: number) => number, bottom: (x: number) => number }>[]}
 */
export const lineEdges = Object.freeze(EYE.lines.map(edgesOf));

/**
 * What paints a point of the frame: `'line'` where a line covers it, `'iris'` where only the iris does, and nothing
 * outside the almond or between the lines. The lines are drawn over the iris.
 * @param {number} x
 * @param {number} y
 * @returns {'line' | 'iris' | undefined}
 */
export function paintAt(x, y) {
  if (!(y >= almondEdges.top(x) && y <= almondEdges.bottom(x))) return undefined;
  for (const edges of lineEdges) {
    if (y >= edges.top(x) && y <= edges.bottom(x)) return 'line';
  }
  const { cx, cy, r } = EYE.iris;
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r ? 'iris' : undefined;
}

/** The side of the side bar's icon, and the margin on each side of the eye's frame in it. */
const GRID = 24;
const MARGIN = 2;

/**
 * The eye as the side bar's icon: an SVG of 24 by 24 pixels with the eye's frame of 96 units drawn in its inner 20, two
 * pixels of margin on every side, the iris and the lines in `currentColor` so the editor paints it as it paints every
 * icon of the bar. No other colour, no text, no reference to anything outside the file.
 * @returns {string}
 */
export function drawActivityIcon() {
  const { cx, cy, r } = EYE.iris;
  const lines = EYE.lines.map(({ d, width }) => `<path d="${d}" stroke-width="${width}"/>`).join('');
  const inner = GRID - 2 * MARGIN;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${GRID}" height="${GRID}" viewBox="0 0 ${GRID} ${GRID}"><svg x="${MARGIN}" y="${MARGIN}" width="${inner}" height="${inner}" viewBox="-48 -48 96 96"><clipPath id="mnema-eye"><path d="${EYE_AT_REST.almond}"/></clipPath><g clip-path="url(#mnema-eye)"><ellipse cx="${cx}" cy="${cy}" rx="${r}" ry="${r}" fill="currentColor"/><g fill="none" stroke="currentColor" stroke-linecap="round">${lines}</g></g></svg></svg>\n`;
}
