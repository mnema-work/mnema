// The wordmark of the brand, in its regular weight: the word "mnema" drawn as strokes, with no font. The arches of the m
// and of the n are upper lids, the bowls of the e and of the a are almonds, like the eye (`./eye.mjs`). It has no colour
// of its own: it is drawn in the ink it is given, and `./banner.mjs` sets it beside the eye.

import { f } from './field.mjs';

/** The x-height, the top of an arch; where an arch leaves its stem (the shoulder); and the line through the middle of a bowl. */
const X = 41.5;
const SH = -26;
const MID = -23;
/** How far the almonds overshoot the x-height and the baseline. */
const OVERSHOOT = 1.3;
/** The weight of the stems, in units of the drawing. */
const STEM = 9;

/**
 * A point on a quadratic curve.
 * @param {readonly [number, number]} p0
 * @param {readonly [number, number]} c
 * @param {readonly [number, number]} p2
 * @param {number} t
 * @returns {[number, number]}
 */
const quadAt = (p0, c, p2, t) => [
  (1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * c[0] + t * t * p2[0],
  (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * c[1] + t * t * p2[1],
];

/**
 * An arch whose top sits at the x-height.
 * @param {number} x
 * @param {number} w
 */
const lid = (x, w) => `Q${f(x + w / 2)},${f(2 * -X - SH)} ${f(x + w)},${SH}`;

/**
 * @typedef {{ stems?: number[], arches?: string, bowls?: string, tall?: string, w: number }} Letter
 */

/** The upper control point and the lower one of a bowl, which overshoot the band. */
/** @param {number} x @param {number} w @returns {[number, number]} */
const upper = (x, w) => [x + w / 2, 2 * (-X - OVERSHOOT) - MID];
/** @param {number} x @param {number} w @returns {[number, number]} */
const lower = (x, w) => [x + w / 2, 2 * (-4.5 + 1.57) - MID];

/** @type {Record<string, (x: number) => Letter>} */
const LETTERS = {
  m: (x, w = 40) => ({
    stems: [x, x + w, x + 2 * w],
    arches: `M${x},0V${SH}${lid(x, w)}V0M${x + w},${SH}${lid(x + w, w)}V0`,
    w: 2 * w,
  }),
  n: (x, w = 44) => ({ stems: [x, x + w], arches: `M${x},0V${SH}${lid(x, w)}V0`, w }),
  e: (x, w = 54) => {
    /** @type {[number, number]} */
    const p0 = [x, MID];
    const c = lower(x, w);
    /** @type {[number, number]} */
    const p2 = [x + w, MID];
    const t = 0.76;
    const c1 = [p0[0] + t * (c[0] - p0[0]), p0[1] + t * (c[1] - p0[1])];
    const b = quadAt(p0, c, p2, t);
    const u = upper(x, w);
    // One line from the terminal round the bowl and back along the bar, so the bowl's right corner is a round join.
    return {
      bowls: `M${f(b[0])},${f(b[1])}Q${f(c1[0] ?? 0)},${f(c1[1] ?? 0)} ${x},${MID}Q${f(u[0])},${f(u[1])} ${x + w},${MID}H${x + 2}`,
      w,
    };
  },
  a: (x, w = 54) => {
    const u = upper(x, w);
    const c = lower(x, w);
    return {
      bowls: `M${x},${MID}Q${f(u[0])},${f(u[1])} ${x + w},${MID}Q${f(c[0])},${f(c[1])} ${x},${MID}Z`,
      tall: `M${x + w},${f(-X - 4)}V0`,
      w,
    };
  },
};

/** The space between one letter and the next: the stems of two letters sit apart, a stem and the point of an almond closer. */
const GAPS = [15, 11.2, 11.2, 11.2];

const SKELETON = (() => {
  let x = 0;
  /** @type {number[]} */
  const stems = [];
  let arches = '';
  let bowls = '';
  let tall = '';
  [...'mnema'].forEach((ch, i) => {
    /** @type {Letter} */
    const letter = LETTERS[ch]?.(x) ?? { w: 0 };
    stems.push(...(letter.stems ?? []));
    arches += letter.arches ?? '';
    bowls += letter.bowls ?? '';
    tall += letter.tall ?? '';
    x += letter.w + (GAPS[i] ?? 0);
  });
  return { stems, arches, bowls, tall, w: x };
})();

/**
 * The word, drawn in one ink: its view box (`x y width height`, as numbers) and its marking. Each stem eases into the
 * narrower arch over 12 units, so neither a spur nor a notch shows where they meet.
 * @param {string} ink
 * @returns {{ box: readonly [number, number, number, number], body: string }}
 */
export function wordmark(ink) {
  const h = STEM / 2;
  const ha = (STEM * 0.88) / 2;
  const stems = SKELETON.stems
    .map(
      (x) =>
        `M${f(x - h)},0H${f(x + h)}V${f(SH + 12)}L${f(x + ha)},${SH}H${f(x - ha)}L${f(x - h)},${f(SH + 12)}Z`,
    )
    .join('');
  const body =
    `<path d="${stems}" fill="${ink}"/>` +
    `<path d="${SKELETON.arches}" fill="none" stroke="${ink}" stroke-width="${f(STEM * 0.88)}" stroke-linejoin="miter" stroke-miterlimit="10"/>` +
    `<path d="${SKELETON.tall}" fill="none" stroke="${ink}" stroke-width="${STEM}"/>` +
    `<path d="${SKELETON.bowls}" fill="none" stroke="${ink}" stroke-width="${f(STEM * 0.94)}" stroke-linejoin="round" stroke-linecap="round"/>`;
  return {
    box: [
      Number(f(-STEM - 1)),
      Number(f(-X - STEM - 2)),
      Number(f(SKELETON.w + 2 * STEM + 2)),
      Number(f(X + STEM + 2 + 4)),
    ],
    body,
  };
}
