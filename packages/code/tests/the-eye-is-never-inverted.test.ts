/**
 * The eye of the brand is never inverted (ADR-695). On a dark ground it is drawn as is: bone lines, a sulphur iris. On a
 * light ground it is the same dark eye in a charcoal seal, a rounded square, as the icons of the editor and of the plugin
 * draw it.
 *
 * WHAT THIS HOLDS
 *   - every LIGHT picture (the banner and the seven diagrams) draws its eye in a charcoal seal, with bone lines;
 *   - no light picture draws the lines of an eye in charcoal, and no dark picture draws a seal;
 *   - every DARK picture is byte for byte what it was before the seal was drawn (their digests are written here);
 *   - the seal's proportions (its corner radius, and that it fills the eye's frame) are the icons': read off the editor's
 *     icon (`drawIcon`) and the record page's favicon, not off the module that draws the seal;
 *   - the record page's header wears the seal in a light page and none in a dark one, with the lines bone in both.
 *
 * WHAT IT DOES NOT HOLD: how the pictures look; they were looked at in a headless browser on white.
 */

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { STYLE } from '../src/site/page.js';
import * as mark from '../src/site/the-mark.js';
import { ROOT } from './support/published-examples.js';

const load = async <T>(path: string): Promise<T> => (await import(pathToFileURL(path).href)) as T;
const BRAND = join(ROOT, '.github', 'the-brand');
const { PALETTE } = await load<{ PALETTE: Readonly<Record<string, string>> }>(
  join(BRAND, 'palette.mjs'),
);
const { SEAL } = await load<{ SEAL: { x: number; y: number; size: number; rx: number } }>(
  join(BRAND, 'eye.mjs'),
);
const { drawIcon } = await load<{ drawIcon: (size?: number) => Buffer }>(
  join(ROOT, 'packages', 'vscode', 'build', 'icon.mjs'),
);

const LIGHT = [
  'docs/assets/banner-light.svg',
  'docs/assets/how-it-works-light.svg',
  'docs/assets/how-mnema-fits-light.svg',
  'docs/assets/the-family-light.svg',
  'packages/chain/assets/chain-light.svg',
  'packages/core/assets/core-light.svg',
  'packages/context/assets/context-light.svg',
  'packages/stacks/assets/stacks-light.svg',
];

/** The digests of the dark pictures as they were before the light ones took the seal: they must not move. */
const DARK: Record<string, string> = {
  'docs/assets/banner-dark.svg':
    'cff6acbbd90918fddf42359ed2fdb3b1ba475dadafd261a34049deac9cbe0215',
  'docs/assets/how-it-works-dark.svg':
    'eeff49f1b82fca346bad7f580b750659ef18bd8f07ff38eac4585c940ea1be6d',
  'docs/assets/how-mnema-fits-dark.svg':
    '05d2bd6f306785197e0a05fc8109ac56ed2ce5435f7428888d42f35483a99322',
  'docs/assets/the-family-dark.svg':
    '569a925091867ea59d656e339bf4d1ce0de2a30e3ae29d179940555c9a0eeb4f',
  'packages/chain/assets/chain-dark.svg':
    '12b9bdcb188bb647ed181338c7a05c582aee5c150fd11fb4590fa34e2abf5d20',
  'packages/context/assets/context-dark.svg':
    '70e5ad59ae77b5b99a0297354bf45dd91d98002c384af7b9951e203a1430c855',
  'packages/core/assets/core-dark.svg':
    '3bd5ec5431ea9b0898f80ad045ad35e1c538df8f56388e29591f5151b4addda2',
  'packages/stacks/assets/stacks-dark.svg':
    '755967b24d187dca42db0c42b5890160c707cdb95dfe41eba619d857453a3a99',
};

const read = (path: string) => readFileSync(join(ROOT, path), 'utf8');
/** The `<rect>`s that are a seal: the rounded square that fills the eye's frame. */
const sealsIn = (svg: string) =>
  [...svg.matchAll(/<rect\b[^>]*>/g)]
    .map((m) => m[0])
    .filter((r) => r.includes('rx="22"') && r.includes('width="96"'));
/** The groups that draw the lines of an eye: round-ended strokes with no fill. */
const lineGroups = (svg: string) =>
  [...svg.matchAll(/<g fill="none" stroke="([^"]+)" stroke-linecap="round">/g)].map((m) => m[1]);

describe('the eye on a light ground', () => {
  it.each(LIGHT)('%s draws its eye in a charcoal seal, with bone lines', (path) => {
    const svg = read(path);
    const seals = sealsIn(svg);
    expect(seals.length).toBeGreaterThanOrEqual(1);
    for (const seal of seals) {
      expect(seal).toContain(`fill="${PALETTE.charcoal}"`);
      expect(seal).toContain(
        `x="${SEAL.x}" y="${SEAL.y}" width="${SEAL.size}" height="${SEAL.size}"`,
      );
    }
    const groups = lineGroups(svg);
    expect(groups.length).toBeGreaterThanOrEqual(1);
    expect(groups.every((ink) => ink === PALETTE.bone)).toBe(true);
  });

  it.each(LIGHT)('%s draws no eye with charcoal lines', (path) => {
    expect(lineGroups(read(path))).not.toContain(PALETTE.charcoal);
  });

  it('keeps the iris plain sulphur, no ring', () => {
    for (const path of LIGHT) {
      for (const m of read(path).matchAll(/<ellipse\b[^>]*>/g)) {
        if (!m[0].includes(`fill="${PALETTE.sulphur}"`)) continue;
        expect(m[0]).not.toContain('stroke');
      }
    }
  });
});

describe('the eye on a dark ground', () => {
  it.each(Object.keys(DARK))('%s is as it was: no seal, and its digest has not moved', (path) => {
    const svg = read(path);
    expect(sealsIn(svg)).toEqual([]);
    expect(lineGroups(svg).every((ink) => ink === PALETTE.bone)).toBe(true);
    expect(createHash('sha256').update(svg).digest('hex')).toBe(DARK[path]);
  });
});

describe("the seal's proportions are the icons'", () => {
  /** The alpha of the pixel (x, y) of the editor's icon drawn at 96 pixels, one pixel to a unit of the frame. */
  function alphaAt(x: number, y: number): number {
    const png = drawIcon(96);
    let at = 8;
    const data: Buffer[] = [];
    while (at < png.length) {
      const length = png.readUInt32BE(at);
      const type = png.toString('latin1', at + 4, at + 8);
      if (type === 'IDAT') data.push(png.subarray(at + 8, at + 8 + length));
      at += 12 + length;
    }
    const raw = inflateSync(Buffer.concat(data));
    return raw[y * (1 + 96 * 4) + 1 + x * 4 + 3] as number;
  }

  it("has the editor's icon cut at the corner where a radius of the seal's would cut it", () => {
    // On the diagonal, a rounded square of radius r is inside from r (1 - 1/sqrt 2) of the corner.
    const from = SEAL.rx * (1 - Math.SQRT1_2);
    let checked = 0;
    for (const d of [1, 2, 3, 4, 5, 8, 9, 10, 12]) {
      if (d + 0.5 > from + 0.75) {
        expect(alphaAt(d, d), `pixel ${d}`).toBe(255);
        checked++;
      } else if (d + 0.5 < from - 0.75) {
        expect(alphaAt(d, d), `pixel ${d}`).toBe(0);
        checked++;
      }
    }
    expect(checked).toBeGreaterThanOrEqual(6);
    expect(SEAL.size).toBe(96);
    expect(SEAL.x).toBe(-48);
  });

  it("is the favicon's rounded square", () => {
    const favicon = Buffer.from(
      mark.FAVICON.replace(/^data:image\/svg\+xml;base64,/, ''),
      'base64',
    ).toString();
    const [seal] = sealsIn(favicon);
    expect(seal).toContain(`rx="${SEAL.rx}"`);
    expect(seal).toContain(`width="${SEAL.size}"`);
  });
});

describe('the record page header', () => {
  it('wears the seal where the page is light and none where it is dark, with bone lines in both', () => {
    expect(mark.HEADER_EYE).toContain('class="seal"');
    expect(STYLE).toMatch(/:root \{[^}]*--seal: #131312;[^}]*--seal-ink: #efebe1;/);
    expect(STYLE).toMatch(
      /prefers-color-scheme: dark\) \{ :root \{[^}]*--seal: none;[^}]*--seal-ink: #efebe1;/,
    );
    expect(STYLE).toMatch(/\.mark \{[^}]*color: var\(--seal-ink\)/);
    expect(STYLE).toMatch(/\.mark \.seal \{ fill: var\(--seal\); \}/);
  });
});
