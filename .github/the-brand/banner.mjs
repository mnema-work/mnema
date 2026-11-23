// Draws the banner of the README, in the brand: `docs/assets/banner-{dark,light}.svg`. It is the lockup of the brand, the
// eye (`./eye.mjs`) and the word beside it (`./wordmark.mjs`), and nothing else: no words, no ground of its own (it sits
// on the colour of whatever page shows it), no glint and no pupil. The README says in words what the lockup stands for,
// in the line under it.
//
// THE EYE BLINKS, AND STOPS WHEN ASKED TO. It looks ahead, left, ahead, right, ahead, blinks once, then twice, on a cycle
// of 9 s that `./eye.mjs` owns. The motion is SMIL, which a media query cannot stop, so the banner holds two copies of
// the eye in one clip: one that moves and one at rest, the first stop of the cycle, and a media query inside the SVG swaps
// them under `prefers-reduced-motion`. The copy at rest is the moving copy without its `<animate>`s.
//
// Every id and class is made from the file's own name and the part's role, and the phase of the blink is a constant of the
// file, so drawing twice gives the same bytes. The light banner's lettering is charcoal; its eye is the dark
// eye in a charcoal seal (the eye is never inverted), with the iris plain sulphur and no ring.
//
// From the root of the repository (it needs no build):
//
//   node .github/the-brand/banner.mjs          writes the banners
//   node .github/the-brand/banner.mjs --check  writes nothing; exits 1 if one differs

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { ALMOND, blinkingInside, sealRect } from './eye.mjs';
import { f } from './field.mjs';
import { PALETTE } from './palette.mjs';
import { wordmark } from './wordmark.mjs';

/** What the banner says, as the README's `alt` and as the banner's own `aria-label` and `<title>`. */
export const BANNER_ALT = 'mnema: the decision record for AI coding agents';

/** The frame the banner is drawn in. */
const FRAME = { w: 1280, h: 220 };
/** The scale of the lockup in the frame, and where it starts from the top. */
const SCALE = 1.25;
const TOP = 35;
/** The height the word is drawn at, in the units of the lockup. */
const WORD_HEIGHT = 76;

/**
 * What differs between the two banners: the ink, and where in the cycle the eye starts (a constant
 * per file).
 */
const THEMES = {
  dark: { ink: PALETTE.bone, begin: -6.1, sealed: false },
  light: { ink: PALETTE.charcoal, begin: -0.8, sealed: true },
};

/**
 * The lockup of the eye and the word, centred in the frame.
 * @param {'dark' | 'light'} theme
 */
const banner = (theme) => {
  const { ink, begin, sealed } = THEMES[theme];
  const almond = `banner-${theme}-almond`;
  const moving = `banner-${theme}-moving`;
  const still = `banner-${theme}-still`;
  const word = wordmark(ink);
  const [vx, vy, vw, vh] = word.box;
  const scale = WORD_HEIGHT / vh;
  const width = 150 + vw * scale;
  // The eye is never inverted: on the light page it is the dark eye (bone lines) in a charcoal seal; the lettering keeps `ink`.
  const eyeFor = { ink: sealed ? PALETTE.bone : ink, iris: PALETTE.sulphur };
  const swap = `.${still}{display:none}@media (prefers-reduced-motion:reduce){.${moving}{display:none}.${still}{display:inline}}`;
  const eye = `<g transform="translate(60,60) scale(1.16)">${sealed ? sealRect({ fill: PALETTE.charcoal }) : ''}<clipPath id="${almond}"><path d="${ALMOND}"/></clipPath><g clip-path="url(#${almond})"><g class="${moving}">${blinkingInside({ ...eyeFor, begin })}</g><g class="${still}">${blinkingInside(eyeFor)}</g></g></g>`;
  const letters = `<g transform="translate(140,22) scale(${f(scale)}) translate(${f(-vx)},${f(-vy)})">${word.body}</g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${FRAME.w} ${FRAME.h}" width="${FRAME.w}" height="${FRAME.h}" role="img" aria-label="${BANNER_ALT}"><title>${BANNER_ALT}</title><style>${swap}</style><g transform="translate(${f(FRAME.w / 2 - (width * SCALE) / 2)},${TOP}) scale(${SCALE})">${eye}${letters}</g></svg>`;
};

/**
 * The two banners, by the path of the file they are written to.
 * @returns {Record<string, string>}
 */
export function drawTheBanner() {
  return {
    'docs/assets/banner-dark.svg': banner('dark'),
    'docs/assets/banner-light.svg': banner('light'),
  };
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
  let differs = 0;
  for (const [path, content] of Object.entries(drawTheBanner())) {
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
