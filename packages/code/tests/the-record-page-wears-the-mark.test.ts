/**
 * THE RECORD PAGE WEARS THE BRAND'S EYE AND TYPE, read against the brand's own source (`.github/the-brand/`), which no
 * published package may read: this file lives in the tests, where it may.
 *
 *   - THE FILE THE PAGE TAKES THEM FROM (`src/site/the-mark.ts`) is what the script of the brand makes, byte for byte: the
 *     product holds a copy, since it cannot import the brand, and a copy that drifted is a page that no longer wears it.
 *   - THE EYE of the header is the brand's eye at rest: the almond, the iris and the six lines with their widths, read out of
 *     the page's own markup and compared with `EYE_AT_REST`. It carries no animation.
 *   - THE FAVICON is on the page, as `data:`, and it is the same eye in its dark square.
 *   - THE FONTS are WOFF2 subsets, read out of the page's own bytes (the directory and the `name` and `GPOS` tables of each
 *     file, by a reader of this file's own, not the one that wrote them): the mono carries a name of ours and none of the
 *     reserved "Plex" or "IBM" in any name that names it, keeps the authors' copyright and licence records, and every glyph
 *     of the range as wide as their file has it; Archivo is named Archivo, holds every glyph of its range as wide as the
 *     variable font is at that weight, and keeps its kerning (a GPOS `kern` feature); the style names both in its stacks and
 *     carries both licences; and the whole page stays under a size ceiling.
 *   - THE NOTICES of the package list both fonts with their copyright and licence.
 *   - THE POLICY opens `data:` for fonts and images and nothing else.
 *
 * WHAT IS NOT HELD: how a browser draws the page (the shapes were looked at in a headless browser in both colour schemes
 * when this was written, not here), and the letterforms of the instances beyond their advance widths.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { brotliDecompressSync } from 'node:zlib';
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
  MONO_NAME: string;
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

/** A WOFF2 file as an SFNT one, through the subsetter, so that a reader of SFNT can read it (every glyph is kept). */
const subsetSpec = 'subset-font';
const { default: subsetFont } = (await import(subsetSpec)) as {
  default: (
    font: Buffer,
    text: string | undefined,
    options: { keepAllGlyphs: boolean; targetFormat: string },
  ) => Promise<Buffer>;
};
const unwrap = (woff2: Buffer): Promise<Buffer> =>
  subsetFont(woff2, undefined, { keepAllGlyphs: true, targetFormat: 'sfnt' });

/** The size, in bytes, of the page of an empty record: 81,900 when the fonts went in as WOFF2 subsets, and 5% more. */
const CEILING = 86_000;

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

  it('draws the iris with no ring, on a light page and on a dark one', () => {
    const iris = /<ellipse\b[^>]*>/.exec(mark.HEADER_EYE)?.[0] ?? '';
    expect(iris).toContain(`fill="${PALETTE.sulphur}"`);
    expect(iris).not.toContain('stroke');
    expect(STYLE).not.toMatch(/\.mark ellipse/);
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

/** What a WOFF2 file holds, read without a font library: the tables of its directory, decompressed (only `glyf`, `loca` and `hmtx` can be transformed, and no test here asks for them). */
const WOFF2_TAGS =
  'cmap head hhea hmtx maxp name OS/2 post cvt fpgm glyf loca prep CFF VORG EBDT EBLC gasp hdmx kern LTSH PCLT VDMX vhea vmtx BASE GDEF GPOS GSUB EBSC JSTF MATH CBDT CBLC COLR CPAL SVG sbix acnt avar bdat bloc bsln cvar fdsc feat fmtx fvar gvar hsty just lcar mort morx opbd prop trak Zapf Silf Glat Gloc Feat Sill'.split(
    ' ',
  );
function woff2Tables(bytes: Buffer): Map<string, Buffer> {
  expect(bytes.subarray(0, 4).toString('latin1')).toBe('wOF2');
  const count = bytes.readUInt16BE(12);
  const compressed = bytes.readUInt32BE(20);
  let at = 48;
  const base128 = (): number => {
    let value = 0;
    for (let i = 0; i < 5; i++) {
      const byte = bytes.readUInt8(at++);
      value = value * 128 + (byte & 0x7f);
      if ((byte & 0x80) === 0) return value;
    }
    throw new Error('a UIntBase128 that does not end');
  };
  const entries: { tag: string; length: number }[] = [];
  for (let i = 0; i < count; i++) {
    const flags = bytes.readUInt8(at++);
    const index = flags & 0x3f;
    let tag: string;
    if (index === 63) {
      tag = bytes.toString('latin1', at, at + 4);
      at += 4;
    } else tag = (WOFF2_TAGS[index] ?? '').padEnd(4, ' ');
    const version = flags >> 6;
    const original = base128();
    const transformed = tag === 'glyf' || tag === 'loca' ? version === 0 : version !== 0;
    entries.push({ tag, length: transformed ? base128() : original });
  }
  const whole = brotliDecompressSync(bytes.subarray(at, at + compressed));
  const tables = new Map<string, Buffer>();
  let from = 0;
  for (const { tag, length } of entries) {
    tables.set(tag.trim(), whole.subarray(from, from + length));
    from += length;
  }
  return tables;
}

/** The records of a `name` table, as text, by name id. */
function namesOf(name: Buffer): Map<number, string> {
  const found = new Map<number, string>();
  for (let i = 0; i < name.readUInt16BE(2); i++) {
    const r = 6 + i * 12;
    const from = name.readUInt16BE(4) + name.readUInt16BE(r + 10);
    const raw = Buffer.from(name.subarray(from, from + name.readUInt16BE(r + 8)));
    found.set(
      name.readUInt16BE(r + 6),
      name.readUInt16BE(r) === 1 ? raw.toString('latin1') : raw.swap16().toString('utf16le'),
    );
  }
  return found;
}

/** EVERY record of a `name` table (every platform, encoding and language), as text, by name id. */
function everyNameOf(name: Buffer): { id: number; text: string }[] {
  return Array.from({ length: name.readUInt16BE(2) }, (_, i) => {
    const r = 6 + i * 12;
    const from = name.readUInt16BE(4) + name.readUInt16BE(r + 10);
    const raw = Buffer.from(name.subarray(from, from + name.readUInt16BE(r + 8)));
    const text =
      name.readUInt16BE(r) === 1 ? raw.toString('latin1') : raw.swap16().toString('utf16le');
    return { id: name.readUInt16BE(r + 6), text };
  });
}

/** The tags of the layout features a `GPOS` or `GSUB` table offers. */
function featuresOf(table: Buffer): string[] {
  const list = table.readUInt16BE(6);
  return Array.from({ length: table.readUInt16BE(list) }, (_, i) =>
    table.toString('latin1', list + 2 + i * 6, list + 6 + i * 6),
  );
}

describe("the record page's fonts", () => {
  const faces = [...STYLE.matchAll(/@font-face \{([^}]*)\}/g)].map((m) => m[1] ?? '');
  const dataOf = (face: string) => /url\(data:[^;]+;base64,([A-Za-z0-9+/=]+)\)/.exec(face)?.[1];
  const monoFace = faces.find((f) => f.includes("font-family: 'mnema mono'")) ?? '';
  const mono = Buffer.from(dataOf(monoFace) ?? '', 'base64');
  const archivoFaces = faces.filter((f) => f.includes("font-family: 'Archivo'"));

  it('embeds three faces, each as WOFF2 data, and requests nothing', () => {
    expect(faces).toHaveLength(3);
    for (const face of faces) {
      expect(dataOf(face)?.length).toBeGreaterThan(10_000);
      expect(face).toContain("format('woff2')");
      expect(
        Buffer.from(dataOf(face) ?? '', 'base64')
          .subarray(0, 4)
          .toString('latin1'),
      ).toBe('wOF2');
    }
    expect(STYLE).not.toMatch(/url\((?!data:)/);
    expect(STYLE).not.toContain('@import');
  });

  it('names no name of the mono "Plex" or "IBM": a Modified Version of a font whose name is reserved takes another', () => {
    const names = namesOf(woff2Tables(mono).get('name') ?? Buffer.alloc(0));
    // The names that name the font (the family, the style, the unique id, the full name, the PostScript name, the
    // typographic family and style): the copyright and licence records keep the authors' words, as the OFL asks.
    const naming = [1, 2, 3, 4, 6, 16, 17]
      .map((id) => names.get(id))
      .filter((n) => n !== undefined);
    expect(naming).toContain('mnema mono');
    for (const name of naming) expect(name).not.toMatch(/plex|ibm/i);
    // Every record, on every platform and in every language, but the copyright (0) and the licence (13, 14).
    const records = everyNameOf(woff2Tables(mono).get('name') ?? Buffer.alloc(0));
    expect(records.length).toBeGreaterThan(0);
    for (const { id, text } of records) {
      if (id === 0 || id === 13 || id === 14) continue;
      expect(text, `name record ${id}`).not.toMatch(/plex|ibm/i);
    }
    expect(names.get(0)).toContain('Copyright 2017 IBM Corp.');
    expect(names.get(13)).toContain('SIL Open Font License');
  });

  it('keeps every glyph of its range in the mono, as wide as the authors file has it', async () => {
    const authors = parse<Face>(readFileSync(join(BRAND, 'fonts', 'IBMPlexMono-Regular.ttf')));
    const kept = parse<Face>(await unwrap(mono));
    let checked = 0;
    for (const [from, to] of brandPage.ARCHIVO_RANGES) {
      for (let code = from; code <= to; code++) {
        const char = String.fromCodePoint(code);
        const whole = authors.charToGlyph(char);
        if (whole.index === 0) continue;
        const glyph = kept.charToGlyph(char);
        expect(glyph.index, `U+${code.toString(16)} is missing`).toBeGreaterThan(0);
        expect(glyph.advanceWidth).toBe(whole.advanceWidth);
        checked++;
      }
    }
    // NON-VACUITY
    expect(checked).toBeGreaterThan(200);
  });

  it('names no family "Plex" or "IBM" anywhere in the page style', () => {
    expect(STYLE).not.toMatch(/font-family: '[^']*(?:Plex|IBM)/);
    expect(STYLE).toContain(`font-family: '${brandPage.MONO_NAME}'`);
  });

  it('embeds Archivo at 400 and 700, named Archivo, with the glyphs of its range as wide as the brand font is', async () => {
    const variable = parse<Variable>(readFileSync(join(BRAND, 'fonts', 'Archivo[wdth,wght].ttf')));
    const em = variable.unitsPerEm;
    expect(archivoFaces.map((f) => /font-weight: (\d+)/.exec(f)?.[1])).toEqual(['400', '700']);
    let checked = 0;
    for (const face of archivoFaces) {
      const weight = Number(/font-weight: (\d+)/.exec(face)?.[1]);
      const bytes = Buffer.from(dataOf(face) ?? '', 'base64');
      const names = namesOf(woff2Tables(bytes).get('name') ?? Buffer.alloc(0));
      expect(names.get(1)).toBe('Archivo');
      expect(names.get(4)).toBe(weight === 700 ? 'Archivo Bold' : 'Archivo Regular');
      const instance = parse<Face>(await unwrap(bytes));
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

  it('keeps the kerning of Archivo at both weights: its GPOS offers a kern feature', () => {
    expect(archivoFaces).toHaveLength(2);
    for (const face of archivoFaces) {
      const tables = woff2Tables(Buffer.from(dataOf(face) ?? '', 'base64'));
      expect(featuresOf(tables.get('GPOS') ?? Buffer.alloc(8))).toContain('kern');
    }
  });

  it("names Archivo and mnema mono in the stacks of the page's text and of its code, and says Archivo's range", () => {
    expect(STYLE).toMatch(/:root \{[^}]*font-family: 'Archivo', system-ui, sans-serif;/);
    expect(STYLE).toMatch(/code, pre \{ font-family: 'mnema mono', ui-monospace, monospace;/);
    expect(STYLE).toContain(`unicode-range: ${mark.ARCHIVO_RANGE};`);
  });

  it('carries the licence of each face, as the OFL asks of every copy', () => {
    expect(STYLE).toContain('Copyright 2020 The Archivo Project Authors');
    expect(STYLE).toContain('Copyright © 2017 IBM Corp. with Reserved Font Name "Plex"');
    expect(STYLE).toContain('SIL OPEN FONT LICENSE Version 1.1');
  });

  it(`stays under ${CEILING} bytes, the size measured when the fonts went in as WOFF2 subsets, and 5% more`, () => {
    expect(Buffer.byteLength(page)).toBeLessThanOrEqual(CEILING);
    // NON-VACUITY: the ceiling is not loose by an order of magnitude.
    expect(Buffer.byteLength(page)).toBeGreaterThan(CEILING / 1.2);
  });
});

describe("the notices of the package that carries the page's fonts", () => {
  const notices = readFileSync(join(ROOT, 'packages/code/THIRD-PARTY-NOTICES.md'), 'utf8');

  it('list both fonts, with their copyright and the OFL, and say the mono is a renamed subset', () => {
    expect(notices).toContain('### Archivo');
    expect(notices).toContain('### IBM Plex Mono');
    expect(notices).toContain('Copyright 2020 The Archivo Project Authors');
    expect(notices).toContain('Copyright © 2017 IBM Corp. with Reserved Font Name "Plex"');
    expect(notices.match(/SIL OPEN FONT LICENSE Version 1\.1/g)).toHaveLength(2);
    expect(notices).toMatch(/renamed subset[^.]*"mnema mono"/);
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
