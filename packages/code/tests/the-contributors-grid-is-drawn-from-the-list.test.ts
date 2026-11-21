// @reads-the-tree
/**
 * THE CONTRIBUTORS GRID IS DRAWN FROM A LIST: the README table is the one `contributors.json` gives, the
 * check fails when a login is missing from the README or has no SVG, and each SVG cuts its avatar to a
 * circle and loads nothing from outside.
 *
 * `.github/contributors/draw.mjs` keeps the drawing and the check in pure functions; the cases hand them
 * a login list and a README the case makes up, and the last ones read the committed README and files.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  END,
  PER_ROW,
  problems,
  renderBlock,
  renderSvg,
  rewriteReadme,
  START,
  svgPath,
} from '../../../.github/contributors/draw.mjs';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8');
const list: { people: string[]; automated: string[] } = JSON.parse(
  read('.github/contributors/contributors.json'),
);
const logins = list.people;
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);

describe('the README table is the one the list gives', () => {
  it('holds the committed README to the committed list', () => {
    expect(
      problems(
        read('README.md'),
        logins,
        (l: string) => existsSync(join(ROOT, svgPath(l))),
        list.automated,
      ),
    ).toEqual([]);
  });

  it('keeps an automated account out of the grid and thanks it on a line below, with no photo', () => {
    expect(list.automated).toContain('bfs2021');
    expect(logins).not.toContain('bfs2021');
    const readme = read('README.md');
    const block = readme.slice(readme.indexOf(START), readme.indexOf(END));
    const [grid = '', below = ''] = block.split('</table>');
    expect(grid).not.toContain('bfs2021');
    expect(below).toContain('<a href="https://github.com/bfs2021">@bfs2021</a>');
    expect(below).not.toContain('<img');
    expect(existsSync(join(ROOT, svgPath('bfs2021')))).toBe(false);
  });

  it('has one linked, centred cell per login and at most six to a row', () => {
    const many = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    const block = renderBlock(many);
    expect(PER_ROW).toBe(6);
    expect(block.match(/<tr>/g)).toHaveLength(2);
    expect(block.match(/<td align="center">/g)).toHaveLength(7);
    expect(block).toContain(
      '<a href="https://github.com/g"><img src="docs/assets/contributor-g.svg" width="72"',
    );
    expect(block).toContain('<sub>g</sub>');
    expect(block.split('<tr>')[1]?.match(/<td/g)).toHaveLength(6);
  });

  it('keeps what is outside the markers', () => {
    const readme = `before\n${START}\nold\n${END}\nafter\n`;
    const out = rewriteReadme(readme, ['x']);
    expect(out.startsWith('before\n')).toBe(true);
    expect(out.endsWith('\nafter\n')).toBe(true);
    expect(out).not.toContain('old');
  });
});

describe('an automated account is thanked on a line of its own', () => {
  const block = renderBlock(['a'], ['bot-one', 'bot-two']);
  const [grid = '', below = ''] = block.split('</table>');

  it('draws no cell and no image for it, and links each login', () => {
    expect(grid.match(/<td/g)).toHaveLength(1);
    expect(grid).not.toContain('bot-one');
    expect(below).not.toContain('<img');
    expect(below).toContain('<a href="https://github.com/bot-one">@bot-one</a>');
    expect(below).toContain('<a href="https://github.com/bot-two">@bot-two</a>');
    expect(below).toContain('automated');
    expect(below.trimEnd().endsWith(END)).toBe(true);
  });

  it('writes no line at all when none is listed', () => {
    expect(renderBlock(['a'])).toBe(renderBlock(['a'], []));
    expect(renderBlock(['a'])).not.toContain('automated');
  });

  it('is part of what the check holds the README to', () => {
    const readme = rewriteReadme(`${START}\n${END}`, ['a'], ['bot-one']);
    expect(problems(readme, ['a'], () => true, ['bot-one'])).toEqual([]);
    expect(problems(readme, ['a'], () => true, [])).toEqual([
      'the README table is not the one contributors.json gives',
    ]);
    expect(problems(readme, ['a'], () => true, ['bot-one', 'bot-two'])).toEqual([
      'the README table is not the one contributors.json gives',
    ]);
  });

  it('is not an avatar to fetch: no SVG is required for it', () => {
    const readme = rewriteReadme(`${START}\n${END}`, ['a'], ['bot-one']);
    expect(problems(readme, ['a'], (l: string) => l === 'a', ['bot-one'])).toEqual([]);
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

describe('each SVG is a circle around the avatar', () => {
  const svg = renderSvg('someone', png);

  it('clips to a circle, rings it, titles it with the login and embeds the bytes', () => {
    expect(svg).toContain('<clipPath id="round"><circle');
    expect(svg).toContain('clip-path="url(#round)"');
    expect(svg).toContain('<title>someone</title>');
    expect(svg).toContain(`data:image/png;base64,${png.toString('base64')}`);
    expect(svg).toContain('stroke="#8c959f"');
  });

  it('is the same bytes for the same input and loads nothing from outside', () => {
    expect(renderSvg('someone', png)).toBe(svg);
    expect(svg.replace(/xmlns(:xlink)?="[^"]*"/g, '')).not.toMatch(/https?:/);
  });

  it('is what is committed for each listed login: round, titled, offline', () => {
    for (const login of logins) {
      const file = read(svgPath(login));
      expect(file).toContain('clip-path="url(#round)"');
      expect(file).toContain(`<title>${login}</title>`);
      expect(file.replace(/xmlns(:xlink)?="[^"]*"/g, '')).not.toMatch(/https?:/);
    }
  });
});
