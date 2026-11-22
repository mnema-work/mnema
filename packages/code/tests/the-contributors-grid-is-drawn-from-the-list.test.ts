// @reads-the-tree
/**
 * THE CONTRIBUTORS GRID IS DRAWN FROM A LIST: the README table is the one `contributors.json` gives, the check fails when a
 * login is missing from the README or has no SVG, and each SVG is the photo in a circle, set in a small field of lines of
 * the brand's stone that part around it, and loads nothing from outside.
 *
 * `.github/contributors/draw.mjs` keeps the drawing and the check in pure functions; the cases hand them a login list and a
 * README the case makes up, and the last ones read the committed README and files.
 *
 * WHAT THE GRID HOLDS, each with the case that holds it:
 *   - EVERYONE IS IN IT, WITH A PHOTO: every outside contributor whose pull request was merged, a person or an account that
 *     declares itself automated, and no one else (`the list is the contributors, in the order they first contributed`).
 *   - EVERY CELL IS THE SAME WIDTH AND THE LOGIN NEVER WRAPS: the picture is wider than the longest login can be at GitHub's
 *     `<sub>` size, in the widest face a reader may be shown, and a row fits GitHub's README column (`the picture sets the
 *     width of the cell`). A login too long for a cell is a problem the check names.
 *   - NO ROW HANGS: the rows are as even as they can be, each in a centred table of its own, so a shorter row sits in the
 *     middle of the one above (`has no row that hangs`).
 *   - THE PICTURE IS ONE FILE FOR BOTH THEMES: only the stone, no yellow, no stylesheet and no `prefers-color-scheme`; the
 *     lines part round the photo (`the lines part round the photo`).
 *   - THE STAR LINE is the sentence of `CONTRIBUTING.md`, under the grid and the line that says how to join.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  ADVANCE,
  END,
  LOGIN_MAX,
  PER_ROW,
  problems,
  renderBlock,
  renderSvg,
  rewriteReadme,
  rowsOf,
  START,
  SUB,
  svgPath,
  TILE,
} from '../../../.github/contributors/draw.mjs';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8');
const list: { people: string[] } = JSON.parse(read('.github/contributors/contributors.json'));
const logins = list.people;
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
/** The colours of the brand the picture may use, said here by hand: its stone, the white of a mask, and the yellow it must not. */
const STONE = '#8c8a82';
const MASK = '#fff';
const SULPHUR = '#e6da2e';

/** The README block of the grid, between the markers. */
const gridOf = (readme: string) =>
  readme.slice(readme.indexOf(START), readme.indexOf(END) + END.length);

describe('the list is the contributors, in the order they first contributed', () => {
  it('has every outside contributor whose pull request was merged, automated accounts included, said by hand', () => {
    expect(logins).toEqual([
      'mentallyunstable-lab',
      'tylrcc',
      'bfs2021',
      'jay23606',
      'prascli',
      'dh1011',
      'fkolo',
    ]);
  });

  it('is one list, with no one kept apart, and leaves out the maintainer and the dependency bots', () => {
    expect(Object.keys(JSON.parse(read('.github/contributors/contributors.json')))).toEqual([
      'people',
    ]);
    for (const out of ['felipesauer', 'dependabot', 'app/dependabot', 'dependabot[bot]'])
      expect(logins).not.toContain(out);
    expect(new Set(logins).size).toBe(logins.length);
  });

  it('shows an account that declares itself automated like everyone else: a cell, a link and a photo', () => {
    const grid = gridOf(read('README.md'));
    expect(logins).toContain('bfs2021');
    expect(grid).toContain(
      `<a href="https://github.com/bfs2021"><img src="docs/assets/contributor-bfs2021.svg" width="${TILE.w}" height="${TILE.h}" alt="@bfs2021"><br><sub>bfs2021</sub></a>`,
    );
    expect(existsSync(join(ROOT, svgPath('bfs2021')))).toBe(true);
    // The line that kept such an account apart, with no photo, is gone.
    expect(read('README.md')).not.toMatch(
      /Thank you also to|declares? (?:itself|themselves) automated/,
    );
    expect(grid).not.toContain('automated');
  });
});

describe('the README table is the one the list gives', () => {
  it('holds the committed README to the committed list', () => {
    expect(
      problems(read('README.md'), logins, (l: string) => existsSync(join(ROOT, svgPath(l)))),
    ).toEqual([]);
  });

  it('has one linked, centred cell per login and at most four to a row', () => {
    const many = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    const block = renderBlock(many);
    expect(PER_ROW).toBe(4);
    expect(block.match(/<tr>/g)).toHaveLength(2);
    expect(block.match(/<td align="center">/g)).toHaveLength(7);
    expect(block).toContain(
      `<a href="https://github.com/g"><img src="docs/assets/contributor-g.svg" width="${TILE.w}"`,
    );
    expect(block).toContain('<sub>g</sub>');
    expect(block.split('<tr>')[1]?.match(/<td/g)).toHaveLength(4);
  });

  it('has no row that hangs: the rows are even, and each is a centred table of its own', () => {
    const names = (n: number) => Array.from({ length: n }, (_, i) => `p${i}`);
    // Seven are four and three, five are three and two, eight are four and four, and one is one: never four and a lone one.
    const sizes = [1, 2, 4, 5, 6, 7, 8, 9, 13].map((n) => [
      n,
      rowsOf(names(n)).map((r) => r.length),
    ]);
    expect(sizes).toEqual([
      [1, [1]],
      [2, [2]],
      [4, [4]],
      [5, [3, 2]],
      [6, [3, 3]],
      [7, [4, 3]],
      [8, [4, 4]],
      [9, [3, 3, 3]],
      [13, [4, 3, 3, 3]],
    ]);
    for (let n = 1; n <= 40; n++) {
      const rows = rowsOf(names(n));
      expect(rows.flat()).toEqual(names(n));
      expect(
        Math.max(...rows.map((r) => r.length)) - Math.min(...rows.map((r) => r.length)),
      ).toBeLessThanOrEqual(1);
      expect(Math.max(...rows.map((r) => r.length))).toBeLessThanOrEqual(PER_ROW);
    }
    // In the block, a row is a table: a row of three is not a row of four with a cell missing, which would hang to the left.
    const block = renderBlock(names(7));
    const tables = block.match(/<table align="center">\n<tr>\n[\s\S]*?<\/tr>\n<\/table>/g) ?? [];
    expect(tables.map((t) => t.match(/<td align="center">/g)?.length)).toEqual([4, 3]);
    expect(block.match(/<table\b/g)).toHaveLength(2);
  });

  it('shows the committed README with no row hanging', () => {
    const grid = gridOf(read('README.md'));
    const tables = grid.match(/<table align="center">[\s\S]*?<\/table>/g) ?? [];
    const sizes = tables.map((t) => t.match(/<td align="center">/g)?.length ?? 0);
    expect(sizes.reduce((a, b) => a + b, 0)).toBe(logins.length);
    expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
    expect(grid.match(/<tr>/g)).toHaveLength(tables.length);
  });

  it('keeps what is outside the markers', () => {
    const readme = `before\n${START}\nold\n${END}\nafter\n`;
    const out = rewriteReadme(readme, ['x']);
    expect(out.startsWith('before\n')).toBe(true);
    expect(out.endsWith('\nafter\n')).toBe(true);
    expect(out).not.toContain('old');
  });
});

describe('the picture sets the width of the cell, so every cell is the same and no login wraps', () => {
  it('shows every picture at one size', () => {
    const grid = gridOf(read('README.md'));
    const sizes = [...grid.matchAll(/<img [^>]*width="(\d+)" height="(\d+)"/g)].map(
      (m) => `${m[1]}x${m[2]}`,
    );
    expect(sizes).toHaveLength(logins.length);
    expect(new Set(sizes)).toEqual(new Set([`${TILE.w}x${TILE.h}`]));
    // and the picture is drawn in that shape, so none is stretched or squashed
    expect(TILE.view.w / TILE.view.h).toBe(TILE.w / TILE.h);
  });

  it('is wider than the longest login can be at the size of <sub>, in a monospace face', () => {
    // 75% of 16 px, and a monospace advance of 0.6 of the size: the widest a login can be set in any face a reader has.
    expect([SUB, ADVANCE]).toEqual([12, 0.6]);
    const longest = Math.max(...logins.map((l) => [...l].length));
    expect(longest).toBeLessThanOrEqual(LOGIN_MAX);
    expect(longest * SUB * ADVANCE).toBeLessThan(TILE.w);
    // The most a login can be on GitHub is 39 characters; the check names one too long for a cell and leaves room for none.
    expect(LOGIN_MAX).toBe(23);
  });

  it('names a login that a cell would wrap', () => {
    const long = 'a'.repeat(LOGIN_MAX + 1);
    const readme = rewriteReadme(`${START}\n${END}`, [long]);
    expect(problems(readme, [long], () => true)).toEqual([
      `${long} is longer than the ${LOGIN_MAX} characters a cell holds on one line`,
    ]);
    const fits = 'a'.repeat(LOGIN_MAX);
    expect(problems(rewriteReadme(`${START}\n${END}`, [fits]), [fits], () => true)).toEqual([]);
  });

  it('has a row that fits the column GitHub gives a README: 832 pixels of text', () => {
    // A cell is its picture, 13 pixels of padding each side and a pixel of border each side.
    expect(PER_ROW * (TILE.w + 2 * 13 + 2)).toBeLessThanOrEqual(832);
  });
});

describe('the check fails when the grid is out of date', () => {
  const readme = `${START}\n${END}`;
  const upToDate = rewriteReadme(readme, ['x', 'y']);

  it('passes when the README and the files are as the list says', () => {
    expect(problems(upToDate, ['x', 'y'], () => true)).toEqual([]);
  });

  it('fails when a login is missing from the README', () => {
    expect(problems(upToDate, ['x', 'y', 'z'], () => true)).toEqual([
      'the README table is not the one contributors.json gives',
    ]);
  });

  it('fails when a login has no SVG', () => {
    expect(problems(upToDate, ['x', 'y'], (l: string) => l !== 'y')).toEqual([
      'docs/assets/contributor-y.svg is missing',
    ]);
  });

  it('fails when the markers are gone', () => {
    expect(problems('no markers', ['x'], () => true)).toEqual([
      'README.md has no contributors markers',
    ]);
  });
});

/** The points a path of the field reaches: the ends of its curves, which the curve passes through. */
function endsOf(d: string): [number, number][] {
  const numbers = [...d.matchAll(/-?\d*\.?\d+/g)].map((m) => Number(m[0]));
  const ends: [number, number][] = [[numbers[0] ?? 0, numbers[1] ?? 0]];
  for (let i = 2; i + 5 < numbers.length; i += 6)
    ends.push([numbers[i + 4] ?? 0, numbers[i + 5] ?? 0]);
  return ends;
}

describe('each SVG is the photo in a circle, in a small field of lines in stone', () => {
  const svg = renderSvg('someone', png);

  it('clips to a circle, rings it in stone, titles it with the login and embeds the bytes', () => {
    expect(svg).toContain('<clipPath id="round"><circle');
    expect(svg).toContain('clip-path="url(#round)"');
    expect(svg).toContain('<title>someone</title>');
    expect(svg).toContain(`data:image/png;base64,${png.toString('base64')}`);
    expect(svg).toContain(
      `<circle cx="144" cy="72" r="55" fill="none" stroke="${STONE}" stroke-width="2.4"/>`,
    );
  });

  it('is the same bytes for the same input and loads nothing from outside', () => {
    expect(renderSvg('someone', png)).toBe(svg);
    expect(svg.replace(/xmlns(:xlink)?="[^"]*"/g, '')).not.toMatch(/https?:/);
  });

  it('is one file for both themes: the stone and the mask alone, no yellow, no stylesheet', () => {
    // Stone reads on a dark page and on a light one, so there is one file and nothing in it asks which page it is on.
    const colours = new Set(
      [...svg.matchAll(/(?:stroke|fill|stop-color)="(#[0-9a-fA-F]{3,8})"/g)].map((m) => m[1]),
    );
    expect([...colours].sort()).toEqual([MASK, STONE].sort());
    expect(svg).not.toContain(SULPHUR);
    expect(svg).not.toMatch(/<style|prefers-color-scheme/);
  });

  it('fades the field at the sides, so the lines do not stop at the edge of the picture', () => {
    expect(svg).toContain('<mask id="sides"');
    expect(svg).toContain('stop-opacity="0"/><stop offset=".2"');
    expect(svg).toContain('<g mask="url(#sides)"');
  });

  it('draws eight lines, and the lines part round the photo, none of them crossing its ring', () => {
    const paths = [...svg.matchAll(/<path d="([^"]*)"\/>/g)].map((m) => m[1] as string);
    expect(paths).toHaveLength(8);
    const rim = 55;
    const nearest = paths.map((d) =>
      Math.min(...endsOf(d).map(([x, y]) => Math.hypot(x - 144, y - 72))),
    );
    expect(nearest.filter((n) => n < rim + 1)).toEqual([]);
    // and they do reach: a field that left no line near the photo would pass the case above for nothing
    expect(Math.min(...nearest)).toBeLessThan(rim + 25);
  });

  it('is what is committed for each listed login: the script draws that file from its own photo', () => {
    for (const login of logins) {
      const file = read(svgPath(login));
      const photo = /xlink:href="data:image\/png;base64,([^"]+)"/.exec(file)?.[1] ?? '';
      expect(photo.length, login).toBeGreaterThan(100);
      expect(file, login).toBe(renderSvg(login, Buffer.from(photo, 'base64')));
      expect(file.replace(/xmlns(:xlink)?="[^"]*"/g, '')).not.toMatch(/https?:/);
    }
  });
});

describe('the README ends the section with the star line of CONTRIBUTING.md', () => {
  it('says the sentence CONTRIBUTING.md says, under the grid and under the line that says how to join', () => {
    const sentence =
      'If mnema helps your work, a star on the repository helps others find it; it is only ever yours to give.';
    // Said by hand, and found in CONTRIBUTING.md too: the two are one sentence.
    expect(read('CONTRIBUTING.md')).toContain(sentence);
    const readme = read('README.md');
    expect(readme.match(/a star on the repository/g)).toHaveLength(1);
    expect(readme).toContain(`<p align="center"><sub>${sentence}</sub></p>`);
    const at = (text: string) => readme.indexOf(text);
    expect(at(END)).toBeGreaterThan(0);
    expect(at('To join them, start from')).toBeGreaterThan(at(END));
    expect(at(sentence)).toBeGreaterThan(at('To join them, start from'));
    expect(at('## License')).toBeGreaterThan(at(sentence));
  });
});
