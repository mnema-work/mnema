#!/usr/bin/env node
/**
 * THE CONTRIBUTORS GRID IS DRAWN FROM A LIST, NOT TYPED.
 *
 * `.github/contributors/contributors.json` lists the logins of the outside contributors whose pull
 * request was merged, in the order they first contributed. Two things come from it:
 *
 *   node .github/contributors/draw.mjs
 *     Fetches each login's avatar from github.com/<login>.png, writes `docs/assets/contributor-<login>.svg`
 *     (the avatar cut to a circle, with a thin neutral ring, embedded as a data URI because an image
 *     shown from a README may not load anything else) and rewrites the table between the two marker
 *     comments in README.md.
 *   node .github/contributors/draw.mjs --check
 *     Exits 1 when the README table is not the one the list gives, or a listed login has no SVG. No network.
 *
 * The files sit flat in `docs/assets/`: the site build copies that folder file by file and refuses a subfolder.
 * GitHub strips `style` from a README, so the roundness has to live in the image.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const START = '<!-- contributors:start -->';
export const END = '<!-- contributors:end -->';
export const PER_ROW = 6;
export const SIZE = 72;
export const SVG_DIR = 'docs/assets';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

/** @param {string} login */
export const svgPath = (login) => `${SVG_DIR}/contributor-${login}.svg`;

/**
 * A square SVG: the PNG inside a circular clip, then a thin ring that reads on light and dark.
 * @param {string} login @param {Uint8Array} png
 */
export function renderSvg(login, png) {
  const data = Buffer.from(png).toString('base64');
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="160" height="160" viewBox="0 0 160 160">',
    `<title>${login}</title>`,
    '<defs><clipPath id="round"><circle cx="80" cy="80" r="78"/></clipPath></defs>',
    `<image width="160" height="160" clip-path="url(#round)" xlink:href="data:image/png;base64,${data}"/>`,
    '<circle cx="80" cy="80" r="78" fill="none" stroke="#8c959f" stroke-opacity="0.6" stroke-width="2"/>',
    '</svg>',
    '',
  ].join('\n');
}

/** @param {string} login */
const cell = (login) =>
  `<td align="center"><a href="https://github.com/${login}"><img src="${svgPath(login)}" width="${SIZE}" height="${SIZE}" alt="@${login}"><br><sub>${login}</sub></a></td>`;

/** The marked block, markers included. @param {string[]} logins */
export function renderBlock(logins) {
  const rows = [];
  for (let i = 0; i < logins.length; i += PER_ROW) {
    rows.push(
      `<tr>\n${logins
        .slice(i, i + PER_ROW)
        .map(cell)
        .join('\n')}\n</tr>`,
    );
  }
  return `${START}\n<table align="center">\n${rows.join('\n')}\n</table>\n${END}`;
}

/**
 * The README with the text between the markers replaced; throws when a marker is missing.
 * @param {string} readme @param {string[]} logins
 */
export function rewriteReadme(readme, logins) {
  const from = readme.indexOf(START);
  const to = readme.indexOf(END);
  if (from < 0 || to < from) throw new Error('README.md has no contributors markers');
  return readme.slice(0, from) + renderBlock(logins) + readme.slice(to + END.length);
}

/**
 * What is out of date, as sentences; empty when nothing is. `hasSvg` says whether a login has its file.
 * @param {string} readme @param {string[]} logins @param {(login: string) => boolean} hasSvg
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
  const logins = JSON.parse(
    readFileSync(join(ROOT, '.github/contributors/contributors.json'), 'utf8'),
  );
  const readmePath = join(ROOT, 'README.md');
  const readme = readFileSync(readmePath, 'utf8');
  if (argv.includes('--check')) {
    const found = problems(readme, logins, (login) => existsSync(join(ROOT, svgPath(login))));
    for (const line of found) console.error(line);
    process.exit(found.length === 0 ? 0 : 1);
  }
  mkdirSync(join(ROOT, SVG_DIR), { recursive: true });
  for (const login of logins) {
    writeFileSync(join(ROOT, svgPath(login)), renderSvg(login, await fetchAvatar(login)));
  }
  writeFileSync(readmePath, rewriteReadme(readme, logins));
}

if (process.argv[1] && dirname(process.argv[1]) === dirname(fileURLToPath(import.meta.url))) {
  await main(process.argv.slice(2));
}
