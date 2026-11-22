#!/usr/bin/env node
// THE ONE PLACE A RECORDING BECOMES A PAIR OF PICTURES.
//
// A `.cast` (what the terminal received, as text) is drawn twice with `agg`: `<name>-dark.gif` on
// GitHub's dark page colour (#0d1117) and `<name>-light.gif` on its light one (#ffffff), so the
// README can show each reader the one that sits on their page (`<picture>` and
// `prefers-color-scheme`, as the diagrams do).
//
// THE THEME IS HERE AND NOWHERE ELSE. It used to be one `agg --theme github-dark` line copied
// into every recording script, the release preparation and the test that explains how to make
// the files again, and a theme written seven times is how a recording comes out on a floor the
// others are not on. `agg`'s own `github-dark` draws its floor at #171b21 and its `github-light`
// at #eceff4, neither of them the page, and `github-light` keeps the pastel palette of the dark
// one, where a green `(accepted)` is 1.24:1 on white and a yellow `(proposed)` 1.69:1. So the
// theme is GitHub's own terminal palette for each mode, from `@primer/primitives` 11.10.0 (the
// `color-ansi-*`, `fgColor-default` and `bgColor-default` tokens of `dark` and `light`), handed to
// `agg` as its custom list: the floor, the text, then the sixteen ANSI colours. Red, green and
// yellow on white are 5.36, 7.39 and 12.42:1, and on #0d1117 7.51, 7.45 and 7.50:1.
//
// The font size is the one the recordings always had; everything else is `agg`'s default.
//
// USAGE, from the root of a checkout: `node .github/the-recordings/render.mjs recordings/<name>.cast...`
import { execFileSync } from 'node:child_process';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** The floor, the text and the sixteen ANSI colours of GitHub's dark terminal, in `agg`'s order. */
export const DARK = [
  '0d1117',
  'f0f6fc',
  '2f3742',
  'ff7b72',
  '3fb950',
  'd29922',
  '58a6ff',
  'be8fff',
  '39c5cf',
  'f0f6fc',
  '656c76',
  'ffa198',
  '56d364',
  'e3b341',
  '79c0ff',
  'd2a8ff',
  '56d4dd',
  'ffffff',
];

/** The same, for GitHub's light terminal. */
export const LIGHT = [
  'ffffff',
  '1f2328',
  '1f2328',
  'cf222e',
  '116329',
  '4d2d00',
  '0969da',
  '8250df',
  '1b7c83',
  '59636e',
  '393f46',
  'a40e26',
  '1a7f37',
  '633c01',
  '218bff',
  'a475f9',
  '3192aa',
  '818b98',
];

/** The two modes, with the suffix each one's file carries. */
export const MODES = /** @type {const} */ ([
  ['dark', DARK],
  ['light', LIGHT],
]);

/** The size of the type, as the recordings have always been drawn. */
export const FONT_SIZE = '16';

/**
 * The `agg` arguments for one mode of one cast: the theme, the size, the input and the output.
 *
 * @param {string} cast the `.cast` path, ending in `.cast`
 * @param {'dark' | 'light'} mode
 * @returns {string[]}
 */
export function aggArguments(cast, mode) {
  const theme = mode === 'dark' ? DARK : LIGHT;
  const output = `${cast.slice(0, -'.cast'.length)}-${mode}.gif`;
  return ['-q', '--theme', theme.join(','), '--font-size', FONT_SIZE, cast, output];
}

/** Draws one cast on both pages. */
export function render(/** @type {string} */ cast) {
  if (!cast.endsWith('.cast')) throw new Error(`${basename(cast)} is not a .cast file`);
  for (const [mode] of MODES) execFileSync('agg', aggArguments(cast, mode), { stdio: 'inherit' });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const casts = process.argv.slice(2);
  if (casts.length === 0) {
    console.error('usage: node .github/the-recordings/render.mjs recordings/<name>.cast...');
    process.exit(2);
  }
  for (const cast of casts) render(join(dirname(cast), basename(cast)));
}
