#!/usr/bin/env node
/**
 * THE CONTRIBUTORS GRID IS DRAWN FROM A LIST, NOT TYPED.
 *
 * `.github/contributors/contributors.json` has one list of logins, `people`, in the order they first contributed: every
 * outside contributor whose pull request was merged, a person or an account that declares itself automated, and no one
 * else (the maintainer and the dependency-update bots stay out). Every login in it is in the grid, with a photo. Two
 * things come from it:
 *
 *   node .github/contributors/draw.mjs
 *     Fetches each login's avatar from github.com/<login>.png, writes `docs/assets/contributor-<login>.svg` for each of
 *     `people`, and rewrites the table between the two marker comments in README.md. The file is the photo in a circle
 *     with a ring of the brand's stone, set in a small field of lines of the same stone that part around it and fade
 *     at the sides: each contributor is a fixed point of a field of their own. It embeds the photo as a data URI,
 *     because an image shown from a README may not load anything else; one file serves both of GitHub's themes,
 *     because the stone reads on a dark page and on a light one, and it has no yellow, which is the brand's mark for
 *     a decision in force or a record verified, and a person is neither.
 *   node .github/contributors/draw.mjs --check
 *     Exits 1 when the README block is not the one the list gives, a login of `people` has no SVG, or a login is
 *     longer than a cell holds. No network.
 *
 * EVERY CELL IS THE SAME WIDTH, AND THE LOGIN NEVER WRAPS. The picture is wider than any login can be at GitHub's
 * `<sub>` size, so the picture sets the width of the cell and the login sits under it on one line: `TILE.w` is
 * at least `LOGIN_MAX` characters at `SUB` pixels in the widest face a reader may be shown (a monospace one, 0.6 of
 * its size an advance). There are at most `PER_ROW` cells to a row, so that a row fits GitHub's README column, and the rows
 * are as even as they can be, each in a table of its own, centred: no row hangs to the left of the one above.
 *
 * The files sit flat in `docs/assets/`: the site build copies that folder file by file and refuses a subfolder.
 * GitHub strips `style` from a README, so the roundness and the field have to live in the image.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { f, line, smooth } from '../the-brand/field.mjs';
import { PALETTE } from '../the-brand/palette.mjs';

export const START = '<!-- contributors:start -->';
export const END = '<!-- contributors:end -->';
export const PER_ROW = 4;
export const SVG_DIR = 'docs/assets';
/** The picture of a contributor as the README shows it, in pixels, and as it is drawn, in units. */
export const TILE = { w: 168, h: 84, view: { w: 288, h: 144 } };
/** The font size GitHub gives `<sub>` (75% of 16 px), and how wide a character of the widest face is, as a share of it. */
export const SUB = 12;
export const ADVANCE = 0.6;
/** The photo's radius, in units of the drawing, and the radius of the fixed point the lines part round. */
const PHOTO = 54;
const POINT = 64;
/** How many characters of a login a cell holds on one line. */
export const LOGIN_MAX = Math.floor(TILE.w / (SUB * ADVANCE));

export const svgPath = (/** @type {string} */ login) => `${SVG_DIR}/contributor-${login}.svg`;

/** The lines of the small field, the same for everyone: eight of them, parted round the fixed point at the middle. */
const FIELD = (() => {
  const cx = TILE.view.w / 2;
  const cy = TILE.view.h / 2;
  /** @type {string[]} */
  const paths = [];
  for (let k = -4; k <= 4; k++) {
    if (k === 0) continue;
    paths.push(smooth(line(cy + k * 17, [[cx, cy, POINT, 1]], -10, TILE.view.w + 10, 70)));
  }
  return paths;
})();

/**
 * One contributor's picture: the field of lines, parting round the photo and fading at the sides, and the photo in a
 * circle with a ring of stone.
 * @param {string} login
 * @param {Uint8Array} png
 */
export function renderSvg(login, png) {
  const data = Buffer.from(png).toString('base64');
  const { w, h } = TILE.view;
  const cx = w / 2;
  const cy = h / 2;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`,
    `<title>${login}</title>`,
    `<defs><clipPath id="round"><circle cx="${cx}" cy="${cy}" r="${PHOTO}"/></clipPath><linearGradient id="fade"><stop offset="0" stop-color="${PALETTE.mask}" stop-opacity="0"/><stop offset=".2" stop-color="${PALETTE.mask}"/><stop offset=".8" stop-color="${PALETTE.mask}"/><stop offset="1" stop-color="${PALETTE.mask}" stop-opacity="0"/></linearGradient><mask id="sides" maskUnits="userSpaceOnUse" x="0" y="0" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="url(#fade)"/></mask></defs>`,
    `<g mask="url(#sides)" fill="none" stroke="${PALETTE.stone}" stroke-opacity=".75" stroke-width="2.2" stroke-linecap="round">${FIELD.map((d) => `<path d="${d}"/>`).join('')}</g>`,
    `<image x="${cx - PHOTO}" y="${cy - PHOTO}" width="${2 * PHOTO}" height="${2 * PHOTO}" clip-path="url(#round)" xlink:href="data:image/png;base64,${data}"/>`,
    `<circle cx="${cx}" cy="${cy}" r="${f(PHOTO + 1)}" fill="none" stroke="${PALETTE.stone}" stroke-width="2.4"/>`,
    '</svg>',
    '',
  ].join('\n');
}

/** @param {string} login */
const cell = (login) =>
  `<td align="center"><a href="https://github.com/${login}"><img src="${svgPath(login)}" width="${TILE.w}" height="${TILE.h}" alt="@${login}"><br><sub>${login}</sub></a></td>`;

/**
 * The marked block, markers included: the grid of everyone in the list.
 * @param {string[]} logins
 */
export function renderBlock(logins) {
  const tables = rowsOf(logins).map(
    (row) => `<table align="center">\n<tr>\n${row.map(cell).join('\n')}\n</tr>\n</table>`,
  );
  return `${START}\n${tables.join('\n')}\n${END}`;
}

/**
 * The logins in as few rows as `PER_ROW` allows, and as even as they can be: seven are four and three, never four and a
 * row of three that hangs to the left of it. Each row is its own centred table (see `renderBlock`), so a shorter row sits in
 * the middle of the one above.
 * @param {string[]} logins
 * @returns {string[][]}
 */
export function rowsOf(logins) {
  const rows = Math.ceil(logins.length / PER_ROW);
  const base = Math.floor(logins.length / rows);
  const longer = logins.length % rows;
  let from = 0;
  return Array.from({ length: rows }, (_, i) => {
    const size = base + (i < longer ? 1 : 0);
    const row = logins.slice(from, from + size);
    from += size;
    return row;
  });
}

/**
 * The README with the text between the markers replaced; throws when a marker is missing.
 * @param {string} readme
 * @param {string[]} logins
 */
export function rewriteReadme(readme, logins) {
  const from = readme.indexOf(START);
  const to = readme.indexOf(END);
  if (from < 0 || to < from) throw new Error('README.md has no contributors markers');
  return readme.slice(0, from) + renderBlock(logins) + readme.slice(to + END.length);
}

/**
 * What is out of date, as sentences; empty when nothing is. `hasSvg` says whether a login has its file.
 * @param {string} readme
 * @param {string[]} logins
 * @param {(login: string) => boolean} hasSvg
 */
export function problems(readme, logins, hasSvg) {
  const found = [];
  let want;
  try {
    want = rewriteReadme(readme, logins);
  } catch (e) {
    return [e instanceof Error ? e.message : String(e)];
  }
  if (want !== readme) found.push('the README table is not the one contributors.json gives');
  for (const login of logins) {
    if (!hasSvg(login)) found.push(`${svgPath(login)} is missing`);
    if ([...login].length > LOGIN_MAX)
      found.push(`${login} is longer than the ${LOGIN_MAX} characters a cell holds on one line`);
  }
  return found;
}

/** @param {string} login */
async function fetchAvatar(login) {
  const res = await fetch(`https://github.com/${login}.png?size=160`, { redirect: 'follow' });
  if (!res.ok) throw new Error(`${login}: avatar answered ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

/** @param {string[]} argv */
async function main(argv) {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const { people: logins } = JSON.parse(
    readFileSync(join(root, '.github/contributors/contributors.json'), 'utf8'),
  );
  const readmePath = join(root, 'README.md');
  const readme = readFileSync(readmePath, 'utf8');
  if (argv.includes('--check')) {
    const found = problems(readme, logins, (login) => existsSync(join(root, svgPath(login))));
    for (const message of found) console.error(message);
    process.exit(found.length === 0 ? 0 : 1);
  }
  mkdirSync(join(root, SVG_DIR), { recursive: true });
  for (const login of logins) {
    writeFileSync(join(root, svgPath(login)), renderSvg(login, await fetchAvatar(login)));
  }
  writeFileSync(readmePath, rewriteReadme(readme, logins));
}

if (process.argv[1] && dirname(process.argv[1]) === dirname(fileURLToPath(import.meta.url))) {
  await main(process.argv.slice(2));
}
