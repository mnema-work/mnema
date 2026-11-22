/**
 * The first letter of the console's block wordmark (`THE_BLOCKS`, `packages/code/src/presentation/banner.ts`), the M,
 * read from the rows of the wordmark: `firstLetter` and its full blocks, `letterCells`. They were the extension's mark
 * until the brand's redesign drew the eye in its place (`the-eye.mjs`), and no file of the extension reads them now.
 * They stay, byte for byte, because the site imports both from this file at a release tag to draw its favicon and its
 * header, until the site reads the brand's own source; the guard of the front page holds their values by hand
 * (`the-front-page-is-drawn-from-the-console.test.ts`). This file imports nothing: the site loads it from a checkout
 * with no `node_modules`.
 */

/**
 * The first letter of the wordmark: each row up to the column of the last row's second `╝`, which
 * is where the M ends (the next letter starts in the very next column, with no gap).
 * @param {readonly string[]} blocks
 */
export const firstLetter = (blocks) => {
  const last = [...(blocks.at(-1) ?? '')];
  let seen = 0;
  let end = last.length - 1;
  for (let i = 0; i < last.length; i++) {
    if (last[i] === '╝' && ++seen === 2) {
      end = i;
      break;
    }
  }
  return blocks.map((row) => [...row].slice(0, end + 1));
};

/**
 * The cells of the first letter that are full blocks, as [column, row]. The thin strokes of the
 * wordmark are not cells: they vanish at the sizes the mark is drawn at.
 * @param {readonly string[]} blocks
 * @returns {[number, number][]}
 */
export const letterCells = (blocks) => {
  const cells = [];
  firstLetter(blocks).forEach((row, r) => {
    row.forEach((glyph, c) => {
      if (glyph === '█') cells.push([c, r]);
    });
  });
  return cells;
};
