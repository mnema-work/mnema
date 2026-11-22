/**
 * THE RECORD PAGE WEARS THE BRAND'S EYE AND TYPE, read against the brand's own source (`.github/the-brand/`), which no
 * published package may read: this file lives in the tests, where it may.
 *
 *   - THE FILE THE PAGE TAKES THEM FROM (`src/site/the-mark.ts`) is what the script of the brand makes, byte for byte: the
 *     product holds a copy, since it cannot import the brand, and a copy that drifted is a page that no longer wears it.
 *   - THE EYE of the header is the brand's eye at rest: the almond, the iris and the six lines with their widths, read out of
 *     the page's own markup and compared with `EYE_AT_REST`. It carries no animation.
 *   - THE FAVICON is on the page, as `data:`, and it is the same eye in its dark square.
 *   - THE FONTS: Plex Mono is the authors' Regular file whole (the same bytes, so the same sha256 `SOURCES.md` lists), Archivo
 *     is a font that a reader other than the writer parses, named Archivo, holding every glyph of its range the brand's
 *     variable font holds, each as wide as the variable font is at that weight; and the style names both in its font
 *     stacks and carries both licences.
 *   - THE POLICY opens `data:` for fonts and images and nothing else.
 *
 * WHAT IS NOT HELD: how a browser draws the page (the shapes were looked at in a headless browser in both colour schemes
 * when this was written, not here), and the letterforms of the instances beyond their advance widths.
 */

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { renderPage, STYLE } from '../src/site/page.js';
import * as mark from '../src/site/the-mark.js';
import { ROOT } from './support/published-examples.js';

const BRAND = join(ROOT, '.github', 'the-brand');
const load = async <T>(path: string): Promise<T> => (await import(pathToFileURL(path).href)) as T;

const { EYE_AT_REST } = await load<{
  EYE_AT_REST: {
    almond: string;
    iris: { cx: number; cy: number; r: number };
    lines: readonly { d: string; width: number }[];
  };
}>(join(BRAND, 'eye.mjs'));
const brandPage = await load<{
  theMark: () => string;
  TARGET: string;
  ARCHIVO_RANGES: readonly (readonly [number, number])[];
  ARCHIVO_WEIGHTS: readonly number[];
}>(join(BRAND, 'page.mjs'));
const { PALETTE } = await load<{ PALETTE: Readonly<Record<string, string>> }>(
  join(BRAND, 'palette.mjs'),
);

/** The part of `opentype.js` this file uses: the package ships no declarations. */
type Face = {
  names: { unicode?: { fontFamily?: { en?: string } } };
  charToGlyph: (ch: string) => { index: number; advanceWidth?: number };
  getAdvanceWidth?: unknown;
};
type Variable = {
  charToGlyph: (ch: string) => {
    index: number;
    advanceWidth?: number;
    getPath: (x: number, y: number, size: number, o: object, f: unknown) => unknown;
  };
  unitsPerEm: number;
};
const spec = 'opentype.js';
const loaded = (await import(spec)) as { default?: { parse: (d: ArrayBuffer) => unknown } } & {
  parse: (d: ArrayBuffer) => unknown;
};
const opentype = loaded.default ?? loaded;
const parse = <T>(bytes: Buffer): T =>
  opentype.parse(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
  ) as T;

const emptyModel = {
  decisions: [],
  otherNotes: [],
  timeline: [],
  counts: { decisions: 0, inForce: 0, notes: 0, timeline: 0 },
  tails: [],
  files: {},
};
const page = renderPage(emptyModel, '/*v*/');

/** The eye as an SVG says it: the almond's path, the iris and each line's data and width, in order. */
function eyeOf(svg: string) {
  const almond = /<clipPath id="[^"]*"><path d="([^"]*)"/.exec(svg)?.[1];
  const iris = /<ellipse cx="([^"]*)" cy="([^"]*)" rx="([^"]*)" ry="([^"]*)"/.exec(svg);
  const lines = [...svg.matchAll(/<path d="([^"]*)" stroke-width="([^"]*)"/g)].map((m) => ({
    d: m[1],
    width: Number(m[2]),
  }));
  return {
    almond,
    iris: {
      cx: Number(iris?.[1]),
      cy: Number(iris?.[2]),
      rx: Number(iris?.[3]),
      ry: Number(iris?.[4]),
    },
    lines,
  };
}

const theBrandsEye = {
  almond: EYE_AT_REST.almond,
  iris: {
    cx: EYE_AT_REST.iris.cx,
    cy: EYE_AT_REST.iris.cy,
    rx: EYE_AT_REST.iris.r,
    ry: EYE_AT_REST.iris.r,
  },
  lines: EYE_AT_REST.lines.map(({ d, width }) => ({ d, width })),
};

describe('the file the page takes the eye and the fonts from', () => {
  it('is what the script of the brand makes, byte for byte', () => {
    expect(readFileSync(brandPage.TARGET, 'utf8')).toBe(brandPage.theMark());
    expect(readFileSync(join(ROOT, 'packages/code/src/site/the-mark.ts'), 'utf8')).toBe(
      brandPage.theMark(),
    );
  }, 60_000);
});

describe("the eye in the record page's header", () => {
  it("is the brand's eye at rest: its almond, its iris and its six lines with their widths", () => {
    const header = /<header class="head">\n(<svg[\s\S]*?<\/svg>)\n<h1>The record<\/h1>/.exec(
      page,
    )?.[1];
    expect(header).toBe(mark.HEADER_EYE);
    expect(eyeOf(header ?? '')).toEqual(theBrandsEye);
    expect(eyeOf(header ?? '').lines).toHaveLength(6);
  });

  it('is still: no animation, no script, no style attribute', () => {
    expect(mark.HEADER_EYE).not.toMatch(/<animate|<set|animateTransform|<script|style=|@keyframes/);
    expect(mark.HEADER_EYE).toContain('aria-hidden="true"');
    expect(STYLE).not.toContain('@keyframes');
  });

  it('draws the iris sulphur and the lines in the ink of the page', () => {
    expect(mark.HEADER_EYE).toContain(`fill="${PALETTE.sulphur}"`);
    expect(mark.HEADER_EYE).toContain('stroke="currentColor"');
    expect(STYLE).toMatch(/\.mark \{[^}]*color: var\(--text\)/);
  });
});

describe("the record page's favicon", () => {
  const link =
    /<link rel="icon" type="image\/svg\+xml" href="(data:image\/svg\+xml;base64,[A-Za-z0-9+/=]+)">/.exec(
      page,
    )?.[1];

  it('is on the page, as data, and is the one the file holds', () => {
    expect(link).toBeDefined();
    expect(link).toBe(mark.FAVICON);
  });

  it("is the brand's eye in a dark square", () => {
    const svg = Buffer.from((link ?? '').split(',')[1] ?? '', 'base64').toString('utf8');
    expect(eyeOf(svg)).toEqual(theBrandsEye);
    expect(svg).toContain(`fill="${PALETTE.charcoal}"`);
    expect(svg).toContain(`fill="${PALETTE.sulphur}"`);
  });
});

describe("the record page's fonts", () => {
  const faces = [...STYLE.matchAll(/@font-face \{([^}]*)\}/g)].map((m) => m[1] ?? '');
  const dataOf = (face: string) => /url\(data:[^;]+;base64,([A-Za-z0-9+/=]+)\)/.exec(face)?.[1];

  it('embeds three faces, each as data, and requests nothing', () => {
    expect(faces).toHaveLength(3);
    for (const face of faces) expect(dataOf(face)?.length).toBeGreaterThan(10_000);
    expect(STYLE).not.toMatch(/url\((?!data:)/);
    expect(STYLE).not.toContain('@import');
  });

  it("embeds IBM Plex Mono Regular as the authors' own file, byte for byte", () => {
    const face = faces.find((f) => f.includes("font-family: 'IBM Plex Mono'")) ?? '';
    const bytes = Buffer.from(dataOf(face) ?? '', 'base64');
    expect(bytes.equals(readFileSync(join(BRAND, 'fonts', 'IBMPlexMono-Regular.ttf')))).toBe(true);
    const listed = readFileSync(join(BRAND, 'fonts', 'SOURCES.md'), 'utf8').match(
      /`IBMPlexMono-Regular\.ttf` \|.*\| `([0-9a-f]{64})` \|/,
    )?.[1];
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(listed);
  });

  it('embeds Archivo at 400 and 700, named Archivo, with the glyphs of its range as wide as the brand font is', () => {
    const variable = parse<Variable>(readFileSync(join(BRAND, 'fonts', 'Archivo[wdth,wght].ttf')));
    const em = variable.unitsPerEm;
    const inRange = faces.filter((f) => f.includes("font-family: 'Archivo'"));
    expect(inRange.map((f) => /font-weight: (\d+)/.exec(f)?.[1])).toEqual(['400', '700']);
    let checked = 0;
    for (const face of inRange) {
      const weight = Number(/font-weight: (\d+)/.exec(face)?.[1]);
      const instance = parse<Face>(Buffer.from(dataOf(face) ?? '', 'base64'));
      expect(instance.names.unicode?.fontFamily?.en).toBe('Archivo');
      for (const [from, to] of brandPage.ARCHIVO_RANGES) {
        for (let code = from; code <= to; code++) {
          const char = String.fromCodePoint(code);
          const whole = variable.charToGlyph(char);
          if (whole.index === 0) {
            expect(
              instance.charToGlyph(char).index,
              `U+${code.toString(16)} is not in Archivo`,
            ).toBe(0);
            continue;
          }
          whole.getPath(0, 0, em, { variation: { wdth: 100, wght: weight } }, variable);
          const kept = instance.charToGlyph(char);
          expect(kept.index, `U+${code.toString(16)} is missing at ${weight}`).toBeGreaterThan(0);
          expect(
            Math.abs((kept.advanceWidth ?? -1) - (whole.advanceWidth ?? -2)),
          ).toBeLessThanOrEqual(1);
          checked++;
        }
      }
    }
    // NON-VACUITY: two instances of a couple of hundred glyphs each, not a handful.
    expect(checked).toBeGreaterThan(400);
  }, 60_000);

  it("names Archivo and IBM Plex Mono in the stacks of the page's text and of its code, and says Archivo's range", () => {
    expect(STYLE).toMatch(/:root \{[^}]*font-family: 'Archivo', system-ui, sans-serif;/);
    expect(STYLE).toMatch(/code, pre \{ font-family: 'IBM Plex Mono', ui-monospace, monospace;/);
    expect(STYLE).toContain(`unicode-range: ${mark.ARCHIVO_RANGE};`);
  });

  it('carries the licence of each face, as the OFL asks of every copy', () => {
    expect(STYLE).toContain('Copyright 2020 The Archivo Project Authors');
    expect(STYLE).toContain('Copyright © 2017 IBM Corp. with Reserved Font Name "Plex"');
    expect(STYLE).toContain('SIL OPEN FONT LICENSE Version 1.1');
  });
});

describe("the record page's policy", () => {
  it('opens data: for fonts and images, and nothing else', () => {
    const policy = /Content-Security-Policy" content="([^"]*)"/
      .exec(page)?.[1]
      ?.replaceAll('&#39;', "'");
    const directives = (policy ?? '').split('; ').map((d) => d.split(' ')[0]);
    expect(directives).toEqual(['default-src', 'font-src', 'img-src', 'script-src', 'style-src']);
    expect(policy).toContain("default-src 'none'");
    expect(policy).toContain('font-src data:;');
    expect(policy).toContain('img-src data:;');
  });
});
