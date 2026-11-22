// The eye of the brand: an almond opening drawn as six lines of the field (the two in the middle are the lids) parting
// round a flat iris, clipped to the almond's own outline. It draws no glint and no pupil. `eye` is the eye at rest, with
// its downward look; `blinkingEye` is the same eye on the banner's 9 s cycle, where only the lids and the iris move and
// the almond stays. A diagram draws both and shows the one at rest under `prefers-reduced-motion`.

import { f, line, relative, smooth } from './field.mjs';

/** The six lines of the eye, as levels. */
const LEVELS = [-38.75, -21.75, -4.75, 4.75, 21.75, 38.75];
/** The opening (radius, horizontal stretch) and the iris. */
const EYE = { a: 21, k: 1.45, r: 15.5 };
/** The outline of the almond the eye is clipped to. */
export const ALMOND = 'M-47,0Q0,-86 47,0Q0,86 -47,0Z';

/** The six lines, as path data, with the opening at the middle. */
const LIDS = LEVELS.map((c) => smooth(line(c, [[0, 0, EYE.a, EYE.k]], -58, 58, 16)));

/**
 * The eye as the inside of an `<svg>` with the view box `-48 -48 96 96`: its clip, and the iris and the lines drawn in it.
 * `look` shifts the iris down by a share of itself, as a glance does. `ring` draws a thin ring round the iris, which a light
 * ground needs, since the iris gives little contrast on it.
 * @param {{ id: string, ink: string, iris: string, ringInk: string, ring: boolean, look: number }} o
 */
export function eye({ id, ink, iris, ringInk, ring, look }) {
  const ellipse = `<ellipse cx="0" cy="${f(look * 0.45)}" rx="${EYE.r}" ry="${EYE.r}" fill="${iris}"${ring ? ` stroke="${ringInk}" stroke-width="2.2"` : ''}></ellipse>`;
  const lids = LIDS.map(
    (d, i) => `<path d="${d}" stroke-width="${i === 2 || i === 3 ? 4.75 : 9.5}"></path>`,
  ).join('');
  return `<clipPath id="${id}"><path d="${ALMOND}"/></clipPath><g clip-path="url(#${id})">${ellipse}<g fill="none" stroke="${ink}" stroke-linecap="round">${lids}</g></g>`;
}

/**
 * One cycle of 9 s, the banner's: the eye looks ahead, left, ahead, right, ahead, blinks once, then twice. Each stop is
 * `[time as a share of the cycle, the iris's shift along the lines, how open the lids are]`.
 */
/** @type {readonly (readonly [number, number, number])[]} */
const KEY = [
  [0, 0, 1],
  [0.1, 0, 1],
  [0.15, -7.5, 1],
  [0.32, -7.5, 1],
  [0.37, 0, 1],
  [0.46, 0, 1],
  [0.51, 7.5, 1],
  [0.64, 7.5, 1],
  [0.69, 0, 1],
  [0.8, 0, 1],
  [0.83, 0, 0],
  [0.86, 0, 1],
  [0.9, 0, 1],
  [0.925, 0, 0],
  [0.95, 0, 1],
  [1, 0, 1],
];

/**
 * The six lines at one stop of the cycle, as compact path data: closing brings the two lids together on the middle, and
 * a closed lid is a straight line.
 * @param {number} dx
 * @param {number} open
 */
const lidsAt = (dx, open) =>
  LEVELS.map((c, i) => {
    const lid = i === 2 || i === 3;
    const level = lid ? c * (0.1 + 0.9 * open) : c;
    const o = lid ? open : 1;
    const opening = o > 0.04 ? [[dx, 0, EYE.a * o, EYE.k]] : [];
    return relative(smooth(line(level, /** @type {never} */ (opening), -58, 58, 16)));
  });

const FRAMES = KEY.map(([, dx, open]) => lidsAt(dx, open));

/**
 * An `<animate>` of one attribute over the cycle, eased between the stops.
 * @param {string} attribute
 * @param {readonly string[]} values
 * @param {number} begin where in the cycle this eye starts, in seconds
 */
const animate = (attribute, values, begin) =>
  `<animate attributeName="${attribute}" dur="9s" begin="${f(begin)}s" repeatCount="indefinite" calcMode="spline" keyTimes="${KEY.map(([at]) => at).join(';')}" keySplines="${Array(
    KEY.length - 1,
  )
    .fill('.45 0 .25 1')
    .join(';')}" values="${values.join(';')}"/>`;

/**
 * What the eye on the banner's cycle draws inside its clip: the iris and the six lines, the lids and the iris moving.
 * With no `begin` it is the same marking without the `<animate>`s, which is the first stop of the cycle: the eye the
 * banner shows to a reader who asks for less motion. `begin` is where in the cycle the eye starts: a fixed value, so
 * that a picture is its bytes.
 * @param {{ ink: string, iris: string, ringInk: string, ring: boolean, begin?: number }} o
 */
export function blinkingInside({ ink, iris, ringInk, ring, begin }) {
  /**
   * @param {string} attribute
   * @param {readonly string[]} values
   */
  const move = (attribute, values) =>
    begin === undefined ? '' : animate(attribute, values, begin);
  const ellipse = `<ellipse cx="0" cy="0" rx="${EYE.r}" ry="${EYE.r}" fill="${iris}"${ring ? ` stroke="${ringInk}" stroke-width="2.2"` : ''}>${move(
    'cx',
    KEY.map(([, dx]) => f(dx)),
  )}${move(
    'ry',
    KEY.map(([, , open]) => f(Math.max(0.4, EYE.r * open))),
  )}</ellipse>`;
  const lids = LEVELS.map(
    (_, i) =>
      `<path d="${FRAMES[0]?.[i]}" stroke-width="${i === 2 || i === 3 ? 4.75 : 9.5}">${move(
        'd',
        FRAMES.map((frame) => frame[i] ?? ''),
      )}</path>`,
  ).join('');
  return `${ellipse}<g fill="none" stroke="${ink}" stroke-linecap="round">${lids}</g>`;
}

/**
 * The eye on the banner's cycle, as the inside of an `<svg>` with the view box `-48 -48 96 96`: the same clip, iris and
 * six lines as `eye`, with the lids and the iris moving.
 * @param {{ id: string, ink: string, iris: string, ringInk: string, ring: boolean, begin: number }} o
 */
export function blinkingEye({ id, ...rest }) {
  return `<clipPath id="${id}"><path d="${ALMOND}"/></clipPath><g clip-path="url(#${id})">${blinkingInside(rest)}</g>`;
}
