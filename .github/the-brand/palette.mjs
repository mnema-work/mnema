// The colours of the brand, in one place. No other file of `.github/the-brand/` writes a hex colour, and every colour a
// diagram draws is a value of `PALETTE` (`the-front-page-is-drawn-from-the-console.test.ts` reads both).
//
// Every grey has channels within 17 units of each other; `sulphur` is the one hue, and it appears only where it means
// something: the iris, a decision in force, a record verified.

/** @typedef {'charcoal' | 'bone' | 'stone' | 'darkStone' | 'sulphur' | 'mask' | 'lineDark' | 'lineLight' | 'dimDark' | 'dimLight' | 'pageDark' | 'pageLight'} PaletteName */

/** @type {Readonly<Record<PaletteName, string>>} */
export const PALETTE = Object.freeze({
  charcoal: '#131312',
  bone: '#efebe1',
  stone: '#8c8a82',
  darkStone: '#6b6862',
  sulphur: '#e6da2e',
  mask: '#fff',
  lineDark: '#46453f',
  lineLight: '#cdc8bc',
  dimDark: '#a29e94',
  dimLight: '#5b574f',
  // The colours of GitHub's own page, dark and light: the only ground a diagram ever paints, and only under a sign that
  // must hide a line. A diagram has no ground of its own, so it sits on whatever page shows it.
  pageDark: '#0d1117',
  pageLight: '#ffffff',
});

/**
 * What a diagram paints with, by theme: the colour of the page it hides a line with (`page`: the picture has no ground
 * of its own), its ink, the lines of the band and the threads (`line`), its
 * secondary text (`dim`), the colour of an emphasised text (`acc`), whether a sign carries a ring of ink round its point
 * (`ring`), the opacity of the ink that tints a chip (`chipOpacity`), the dim sign (`muted`: a decision no longer in force, or never accepted) and the ink
 * of the mark drawn across a sign (`mark`).
 */
export const DIAGRAM = Object.freeze({
  dark: Object.freeze({
    name: /** @type {const} */ ('dark'),
    page: PALETTE.pageDark,
    ink: PALETTE.bone,
    line: PALETTE.lineDark,
    dim: PALETTE.dimDark,
    acc: PALETTE.sulphur,
    ring: false,
    chipOpacity: '.04',
    muted: PALETTE.stone,
    mark: PALETTE.charcoal,
  }),
  light: Object.freeze({
    name: /** @type {const} */ ('light'),
    page: PALETTE.pageLight,
    ink: PALETTE.charcoal,
    line: PALETTE.lineLight,
    dim: PALETTE.dimLight,
    acc: PALETTE.charcoal,
    ring: true,
    chipOpacity: '.05',
    muted: PALETTE.darkStone,
    mark: PALETTE.charcoal,
  }),
});

/** @typedef {(typeof DIAGRAM)['dark'] | (typeof DIAGRAM)['light']} Theme */
