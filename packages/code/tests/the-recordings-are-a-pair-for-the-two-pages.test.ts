// @reads-the-tree
/**
 * EVERY RECORDING ON THE FRONT PAGE IS A PAIR: one GIF drawn on GitHub's dark page colour and one
 * on its light one, shown with `<picture>` and `prefers-color-scheme` the way the diagrams are.
 *
 * WHAT IS HELD, each by the files rather than by a list:
 *
 *   - EVERY `recordings/*.gif` THE README NAMES is the pair of one `<picture>`: the `-dark` file
 *     in the dark `<source>`, the `-light` file in the `<img>`, both on disk, and no GIF without a
 *     suffix is left in `recordings/` for the older single picture to hide in.
 *   - THE CONSOLE'S CAPTION SAYS THE FLOOR THE CODE HAS: the columns and rows it states are
 *     `THE_FLOOR`'s, so a drawing that moves the floor moves the page in the same pull request.
 *   - THE THEME IS WRITTEN IN ONE FILE. The pair is drawn by `.github/the-recordings/render.mjs`
 *     and by nothing else: no other instrument, recording script or test spells the theme option of
 *     the renderer, so a recording cannot come out on a floor the others are not on.
 *   - AND THE THEME IS THE PAGE'S: the floor of each mode is GitHub's page colour, and what a
 *     status colour reads as on it keeps the contrast the choice was made for.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { THE_FLOOR } from '../src/repl/floor.js';
import { ROOT } from './support/published-examples.js';

const README = readFileSync(join(ROOT, 'README.md'), 'utf-8');

/** Every `<picture>` of the README that holds a recording: its dark source and its light image. */
function recordingPictures(): { dark: string; light: string }[] {
  const found: { dark: string; light: string }[] = [];
  for (const block of README.matchAll(/<picture>[\s\S]*?<\/picture>/g)) {
    const dark = /<source media="\(prefers-color-scheme: dark\)" srcset="(recordings\/[^"]+)"/.exec(
      block[0],
    );
    const light = /<img src="(recordings\/[^"]+)"/.exec(block[0]);
    if (dark !== null && light !== null)
      found.push({ dark: dark[1] as string, light: light[1] as string });
  }
  return found;
}

describe('every recording of the README is a pair', () => {
  it('shows the dark file to a dark page and the light one to a light page, both on disk', () => {
    const pairs = recordingPictures();
    const named = [...README.matchAll(/recordings\/[A-Za-z0-9-]+\.gif/g)].map((m) => m[0]);
    // THE INSTRUMENT FIRST: something was found, and every GIF the README names is in a pair.
    expect(pairs.length, 'no recording picture was found in the README').toBeGreaterThanOrEqual(5);
    expect(named.length).toBe(pairs.length * 2);
    for (const { dark, light } of pairs) {
      expect(dark, 'the dark source is not a -dark file').toMatch(/-dark\.gif$/);
      expect(light, 'the image is not a -light file').toMatch(/-light\.gif$/);
      expect(dark.replace(/-dark\.gif$/, '')).toBe(light.replace(/-light\.gif$/, ''));
      for (const file of [dark, light]) {
        expect(existsSync(join(ROOT, file)), `${file} is not on disk`).toBe(true);
      }
    }
    // AND NO GIF IS LEFT WITHOUT A SUFFIX: the older single picture would hide there.
    const loose = readdirSync(join(ROOT, 'recordings')).filter(
      (file) => file.endsWith('.gif') && !/-(?:dark|light)\.gif$/.test(file),
    );
    expect(loose, 'a recording is still a single picture').toEqual([]);
  });
});

describe('the README says the floor the code has', () => {
  it("states the console's columns and rows as THE_FLOOR does", () => {
    const caption = /at least (\d+) columns wide and (\d+) rows tall/.exec(README);
    expect(caption, 'the console caption does not state a window').not.toBeNull();
    expect([Number(caption?.[1]), Number(caption?.[2])]).toEqual([
      THE_FLOOR.columns,
      THE_FLOOR.rows,
    ]);
  });
});

/** The text of every tracked file under the given roots, by path, found by git and not by a list. */
function textsUnder(...roots: string[]): Map<string, string> {
  const listed = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', ...roots], {
    cwd: ROOT,
    encoding: 'utf-8',
  })
    .split('\0')
    .filter((file) => file !== '' && /\.(?:mjs|js|ts|sh|json|yml|md)$/.test(file));
  return new Map(listed.map((file) => [file, readFileSync(join(ROOT, file), 'utf-8')]));
}

/** The option's spelling, assembled so this file does not write it either. */
const THE_OPTION = `--${'the'}me`;

describe('the theme of the recordings is written in one file', () => {
  it('is spelled by the renderer of the pair and by no other file of the instruments, the scripts or the tests', () => {
    const spelled = [...textsUnder('.github', 'recordings', 'packages/code/tests')]
      .filter(([, text]) => text.includes(THE_OPTION))
      .map(([file]) => file);
    expect(spelled).toEqual(['.github/the-recordings/render.mjs']);
  });
});

describe('the pair is drawn on the pages GitHub shows', () => {
  it('floors each mode on its own page colour, and keeps a status colour legible on it', async () => {
    const { DARK, LIGHT, aggArguments } = await import(
      join(ROOT, '.github/the-recordings/render.mjs')
    );
    expect(DARK[0]).toBe('0d1117');
    expect(LIGHT[0]).toBe('ffffff');
    // THE LISTS ARE WHAT `agg` READS: the floor, the text and the sixteen ANSI colours.
    expect(DARK).toHaveLength(18);
    expect(LIGHT).toHaveLength(18);
    // WHAT THE DEFAULT LIGHT THEME GOT WRONG, asserted: the green (ANSI 2) and the yellow (ANSI 3)
    // of a status line read at 3:1 or better on the white floor, where the renderer's own light
    // theme had them at 1.24:1 and 1.69:1.
    const luminance = (hex: string): number => {
      const channel = (at: number): number => {
        const v = Number.parseInt(hex.slice(at, at + 2), 16) / 255;
        return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
    };
    const contrast = (a: string, b: string): number => {
      const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
      return ((high as number) + 0.05) / ((low as number) + 0.05);
    };
    for (const [theme, name] of [
      [DARK, 'dark'],
      [LIGHT, 'light'],
    ] as const) {
      for (const colour of [3, 4, 5]) {
        expect(
          contrast(theme[0] as string, theme[colour] as string),
          `${name}: ANSI ${colour - 2} on the floor`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    }
    // AND ONE CAST BECOMES TWO FILES, each with its own theme and the one size.
    const [dark, light] = [
      aggArguments('recordings/x.cast', 'dark'),
      aggArguments('recordings/x.cast', 'light'),
    ];
    expect(dark.at(-1)).toBe('recordings/x-dark.gif');
    expect(light.at(-1)).toBe('recordings/x-light.gif');
    expect(dark[dark.indexOf(THE_OPTION) + 1]).toBe(DARK.join(','));
    expect(light[light.indexOf(THE_OPTION) + 1]).toBe(LIGHT.join(','));
  });
});
