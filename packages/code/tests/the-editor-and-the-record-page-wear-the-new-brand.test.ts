/**
 * THE EDITOR EXTENSION, THE PLUGIN'S ICON AND THE RECORD PAGE WEAR THE BRAND, read against the brand's own source
 * (`.github/the-brand/palette.mjs` and `eye.mjs`), which no published package may read: this file lives in the tests,
 * where it may.
 *
 *   - THE MANIFEST of the extension: the colour of the `.mnema` folder is sulphur in a dark or dark high-contrast theme
 *     and charcoal in a light one, and the store banner is charcoal with the dark theme.
 *   - THE RECORD PAGE (`packages/code/src/site/page.ts`): each colour of its palette is the brand's value for its role,
 *     the surface is the ground mixed a little toward the other theme's, and the light red is what the page's own rule
 *     gives. `page.test.ts` holds the contrast of every pair and the red to the failures alone.
 *   - THE ICON of the stores and of the plugin (`packages/vscode/build/icon.mjs`): pixels computed by hand from the
 *     numbers of `eye.mjs`, each colour a value of the palette.
 *   - THE GLYPH of the status bar (`packages/vscode/build/icon-font.mjs`): the font read by `opentype.js`, a reader that
 *     is not of the writer's hand, filled on the em's grid and held to the eye sampled here, from `EYE_AT_REST`, by a
 *     sampler that shares no code with the extension's `the-eye.mjs`.
 *
 * WHAT IS NOT HELD: that the editor shows the glyph and the side bar's icon as drawn. The sanitizer of a real editor is
 * not run here; the package's own `install-check` loads the font in one.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { mix, textAccent } from '../src/site/colour.js';
import { PALETTE as PAGE } from '../src/site/page.js';
import { ROOT } from './support/published-examples.js';

/** Named by a variable, because these are scripts of the repository and not modules of the product. */
const BRAND = join(ROOT, '.github', 'the-brand');
const BUILD = join(ROOT, 'packages', 'vscode', 'build');
const load = async <T>(path: string): Promise<T> => (await import(pathToFileURL(path).href)) as T;

const { PALETTE } = await load<{ PALETTE: Readonly<Record<string, string>> }>(
  join(BRAND, 'palette.mjs'),
);
const { EYE_AT_REST } = await load<{
  EYE_AT_REST: {
    almond: string;
    iris: { cx: number; cy: number; r: number };
    lines: readonly { d: string; width: number }[];
  };
}>(join(BRAND, 'eye.mjs'));
const { drawIcon } = await load<{ drawIcon: (size?: number) => Buffer }>(join(BUILD, 'icon.mjs'));
const { drawIconFont } = await load<{ drawIconFont: () => Buffer }>(join(BUILD, 'icon-font.mjs'));

/** The part of `opentype.js` this file uses: the package ships no declarations. */
type Command = {
  type: string;
  x?: number;
  y?: number;
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
};
type Face = {
  unitsPerEm: number;
  charToGlyph: (ch: string) => {
    index: number;
    getPath: (x: number, y: number, size: number) => { commands: Command[] };
  };
};
const spec = 'opentype.js';
const loaded = (await import(spec)) as { default?: { parse: (data: ArrayBuffer) => Face } } & {
  parse: (data: ArrayBuffer) => Face;
};
const opentype = loaded.default ?? loaded;

describe('the manifest of the extension wears the brand', () => {
  const manifest = JSON.parse(
    readFileSync(join(ROOT, 'packages', 'vscode', 'package.json'), 'utf8'),
  ) as {
    galleryBanner: { color: string; theme: string };
    contributes: { colors: { id: string; defaults: Record<string, string> }[] };
  };

  it('paints the .mnema folder sulphur on a dark theme and charcoal on a light one, high contrast following its side', () => {
    const folder = manifest.contributes.colors.find((c) => c.id === 'mnema.recordFolder');
    expect(folder?.defaults).toEqual({
      dark: PALETTE.sulphur,
      light: PALETTE.charcoal,
      highContrast: PALETTE.sulphur,
      highContrastLight: PALETTE.charcoal,
    });
  });

  it("shows the store's banner in charcoal, the brand's dark ground", () => {
    expect(manifest.galleryBanner).toEqual({ color: PALETTE.charcoal, theme: 'dark' });
  });
});

describe('the record page wears the brand', () => {
  it('takes each colour of its palette from the brand, by role', () => {
    const { dark, light } = PAGE;
    expect([dark.bg, dark.text, dark.muted, dark.border, dark.accent, dark.ok, dark.wait]).toEqual([
      PALETTE.charcoal,
      PALETTE.bone,
      PALETTE.dimDark,
      PALETTE.lineDark,
      PALETTE.bone,
      PALETTE.sulphur,
      PALETTE.stone,
    ]);
    expect([
      light.bg,
      light.text,
      light.muted,
      light.border,
      light.accent,
      light.ok,
      light.wait,
    ]).toEqual([
      PALETTE.paper,
      PALETTE.charcoal,
      PALETTE.dimLight,
      PALETTE.lineLight,
      PALETTE.charcoal,
      PALETTE.charcoal,
      PALETTE.darkStone,
    ]);
  });

  it('mixes the surface from the two grounds, and takes the light red as far toward charcoal as the floor needs', () => {
    expect(PAGE.dark.surface).toBe(mix(PALETTE.charcoal ?? '', PALETTE.paper ?? '', 0.06));
    expect(PAGE.light.surface).toBe(mix(PALETTE.paper ?? '', PALETTE.charcoal ?? '', 0.035));
    expect(PAGE.dark.bad).toBe('#ff7b72');
    expect(PAGE.light.bad).toBe(
      textAccent({
        ink: '#cf222e',
        toward: PALETTE.charcoal ?? '',
        grounds: [PAGE.light.bg, PAGE.light.surface],
        floor: 4.5,
      }),
    );
    // GitHub's red reads 4.498:1 on the paper surface, under the floor: the rule moves it 1%.
    expect(PAGE.light.bad).toBe('#cd222e');
  });
});

/** The colour at (x, y) of a PNG the icon's writer made: 8-bit RGBA, every row unfiltered. */
function pixels(png: Buffer): (x: number, y: number) => number[] {
  const size = png.readUInt32BE(16);
  const data = inflateSync(png.subarray(png.indexOf('IDAT') + 4, png.indexOf('IEND') - 8));
  return (x, y) => [
    ...data.subarray(y * (1 + size * 4) + 1 + x * 4, y * (1 + size * 4) + 5 + x * 4),
  ];
}

const rgba = (hex: string | undefined): number[] => [
  ...[1, 3, 5].map((i) => Number.parseInt((hex ?? '').slice(i, i + 2), 16)),
  255,
];

describe('the icon of the stores and of the plugin is the eye in its dark square', () => {
  // At 128 pixels a pixel is 0.75 units of the frame (-48 to 48): pixel n covers x from 0.75 n - 48 to 0.75 n - 47.25.
  const at = pixels(drawIcon());

  it('paints the iris sulphur: pixel (64, 64) is the frame from 0 to 0.75 on both axes, inside the iris of radius 15.5', () => {
    expect(at(64, 64)).toEqual(rgba(PALETTE.sulphur));
  });

  it('paints a line bone: the second line passes x = 0 at y = -34.52 with a width of 9.5, and pixel (64, 17) covers y -35.25 to -34.5', () => {
    expect(at(64, 17)).toEqual(rgba(PALETTE.bone));
  });

  it('leaves the gap between two lines charcoal: pixel (64, 26) covers y -28.5 to -27.75, under -29.77 and above the lid at -25.88', () => {
    expect(at(64, 26)).toEqual(rgba(PALETTE.charcoal));
  });

  it('leaves the square outside the almond charcoal: pixel (64, 3) covers y -45.75 to -45, above the almond, whose top is -43', () => {
    expect(at(64, 3)).toEqual(rgba(PALETTE.charcoal));
  });

  it('is transparent outside the rounded square: pixel (0, 0) is 30 units from the centre of the corner of radius 22', () => {
    expect(at(0, 0)[3]).toBe(0);
  });
});

/** An absolute path of `M`, `Q`, `C` and `Z` as polygons: each curve cut in `cuts` straight pieces. */
function polylines(d: string, cuts: number): [number, number][][] {
  const tokens = d.match(/[MQCZ]|-?\d*\.?\d+/g) ?? [];
  const out: [number, number][][] = [];
  let current: [number, number][] = [];
  let i = 0;
  let command = '';
  const next = (): [number, number] => [Number(tokens[i++]), Number(tokens[i++])];
  while (i < tokens.length) {
    if (/[A-Z]/.test(tokens[i] ?? '')) command = tokens[i++] ?? '';
    const from = current.at(-1) ?? [0, 0];
    if (command === 'M') {
      current = [next()];
      out.push(current);
    } else if (command === 'Q' || command === 'C') {
      const controls = command === 'Q' ? [from, next(), next()] : [from, next(), next(), next()];
      for (let k = 1; k <= cuts; k++) {
        let points = controls;
        const t = k / cuts;
        while (points.length > 1)
          points = points
            .slice(1)
            .map((p, n) => [
              (points[n]?.[0] ?? 0) + (p[0] - (points[n]?.[0] ?? 0)) * t,
              (points[n]?.[1] ?? 0) + (p[1] - (points[n]?.[1] ?? 0)) * t,
            ]);
        current.push(points[0] as [number, number]);
      }
    } else if (command === 'Z') {
      current.push(current[0] ?? [0, 0]);
    }
  }
  return out;
}

/** Whether (x, y) is inside a closed polygon, by the crossings of a ray to its right. */
function inside(polygon: readonly [number, number][], x: number, y: number): boolean {
  let crossings = 0;
  for (let k = 0; k < polygon.length - 1; k++) {
    const [ax, ay] = polygon[k] ?? [0, 0];
    const [bx, by] = polygon[k + 1] ?? [0, 0];
    if (ay > y !== by > y && x < ax + ((y - ay) * (bx - ax)) / (by - ay)) crossings++;
  }
  return crossings % 2 === 1;
}

/** The distance from (x, y) to the segment from a to b. */
function distance(x: number, y: number, [ax, ay]: [number, number], [bx, by]: [number, number]) {
  const [dx, dy] = [bx - ax, by - ay];
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(x - ax - t * dx, y - ay - t * dy);
}

/** The em of the font, and the eye's frame of 96 units drawn 280 units wide in its middle. */
const EM = 320;
const SCALE = 280 / 96;

/**
 * The eye sampled on the em's grid (one sample at the middle of each unit, row 0 at the top), from `EYE_AT_REST` alone:
 * inside the almond, and within half its width of a line or inside the iris. Also the almond alone.
 */
function theEyeOnTheGrid(): { eye: Uint8Array; almond: Uint8Array } {
  const [almond = []] = polylines(EYE_AT_REST.almond, 64);
  const lines = EYE_AT_REST.lines.map(({ d, width }) => ({
    half: width / 2,
    points: (polylines(d, 32)[0] ?? []).slice().sort((p, q) => p[0] - q[0]),
  }));
  const { cx, cy, r } = EYE_AT_REST.iris;
  const eye = new Uint8Array(EM * EM);
  const inAlmond = new Uint8Array(EM * EM);
  for (let row = 0; row < EM; row++) {
    for (let column = 0; column < EM; column++) {
      const x = (column + 0.5 - EM / 2) / SCALE;
      const y = (row + 0.5 - EM / 2) / SCALE;
      if (!inside(almond, x, y)) continue;
      inAlmond[row * EM + column] = 1;
      const onALine = lines.some(({ half, points }) => {
        // The points run left to right: start at the first piece that reaches x - half.
        let [lo, hi] = [0, points.length - 1];
        while (lo < hi) {
          const mid = (lo + hi) >> 1;
          if ((points[mid + 1]?.[0] ?? 0) < x - half) lo = mid + 1;
          else hi = mid;
        }
        for (let k = lo; k < points.length - 1; k++) {
          const [a, b] = [points[k] ?? [0, 0], points[k + 1] ?? [0, 0]];
          if (a[0] > x + half) break;
          if (distance(x, y, a, b) <= half) return true;
        }
        return false;
      });
      if (onALine || (x - cx) ** 2 + (y - cy) ** 2 <= r * r) eye[row * EM + column] = 1;
    }
  }
  return { eye, almond: inAlmond };
}

/** The glyph's outline filled by the non-zero rule on the same grid: its quadratics cut in 32 pieces each. */
function theGlyphOnTheGrid(commands: readonly Command[]): Uint8Array {
  const edges: [number, number, number, number][] = [];
  let start: [number, number] = [0, 0];
  let at: [number, number] = [0, 0];
  for (const c of commands) {
    if (c.type === 'M') {
      start = [c.x ?? 0, c.y ?? 0];
      at = start;
    } else if (c.type === 'L') {
      edges.push([...at, c.x ?? 0, c.y ?? 0]);
      at = [c.x ?? 0, c.y ?? 0];
    } else if (c.type === 'Q') {
      let [px, py] = at;
      for (let k = 1; k <= 32; k++) {
        const t = k / 32;
        const x = (1 - t) ** 2 * at[0] + 2 * t * (1 - t) * (c.x1 ?? 0) + t * t * (c.x ?? 0);
        const y = (1 - t) ** 2 * at[1] + 2 * t * (1 - t) * (c.y1 ?? 0) + t * t * (c.y ?? 0);
        edges.push([px, py, x, y]);
        [px, py] = [x, y];
      }
      at = [c.x ?? 0, c.y ?? 0];
    } else if (c.type === 'Z') {
      if (at[0] !== start[0] || at[1] !== start[1]) edges.push([...at, ...start]);
      at = start;
    } else throw new Error(`a command this reader does not fill: ${c.type}`);
  }
  const filled = new Uint8Array(EM * EM);
  for (let row = 0; row < EM; row++) {
    const y = row + 0.5;
    const crossings: [number, number][] = [];
    for (const [ax, ay, bx, by] of edges) {
      if (ay > y === by > y) continue;
      crossings.push([ax + ((y - ay) * (bx - ax)) / (by - ay), by > ay ? 1 : -1]);
    }
    crossings.sort((p, q) => p[0] - q[0]);
    for (let column = 0; column < EM; column++) {
      const x = column + 0.5;
      let winding = 0;
      for (const [cx, direction] of crossings) if (cx < x) winding += direction;
      if (winding !== 0) filled[row * EM + column] = 1;
    }
  }
  return filled;
}

/** The grid grown (`grow`) or shrunk by `reach` samples in every direction (a square of side 2 reach + 1). */
function morph(grid: Uint8Array, reach: number, grow: boolean): Uint8Array {
  const out = new Uint8Array(EM * EM);
  for (let row = 0; row < EM; row++) {
    for (let column = 0; column < EM; column++) {
      let any = false;
      let all = true;
      for (let dy = -reach; dy <= reach; dy++) {
        for (let dx = -reach; dx <= reach; dx++) {
          const [r, c] = [row + dy, column + dx];
          const value = r >= 0 && r < EM && c >= 0 && c < EM ? grid[r * EM + c] : 0;
          if (value) any = true;
          else all = false;
        }
      }
      out[row * EM + column] = (grow ? any : all) ? 1 : 0;
    }
  }
  return out;
}

describe("the glyph of the status bar is the brand's eye, read by another hand", () => {
  const bytes = drawIconFont();
  const face = opentype.parse(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
  );
  const glyph = face.charToGlyph(String.fromCodePoint(0xe000));

  it('is the glyph U+E000 maps to, in an em of 320 units, drawn in quadratics', () => {
    expect(face.unitsPerEm).toBe(EM);
    expect(glyph.index).toBe(1);
    const types = new Set(glyph.getPath(0, EM, EM).commands.map((c) => c.type));
    expect(types.has('Q')).toBe(true);
  });

  it('fills, within 2 units of the edge, what the eye at rest covers: no more, no less, and nothing outside the almond', () => {
    // At 16 pixels, 2 units of the em are a tenth of a pixel.
    const filled = theGlyphOnTheGrid(glyph.getPath(0, EM, EM).commands);
    const { eye, almond } = theEyeOnTheGrid();
    const core = morph(eye, 2, false);
    const reach = morph(eye, 2, true);
    const almondReach = morph(almond, 2, true);
    let coreCount = 0;
    const missing: number[] = [];
    const extra: number[] = [];
    for (let n = 0; n < EM * EM; n++) {
      if (core[n]) coreCount++;
      if (core[n] && !filled[n]) missing.push(n);
      if (filled[n] && (!reach[n] || !almondReach[n])) extra.push(n);
    }
    // NON-VACUITY: the eye's core is most of the glyph, not a handful of samples.
    expect(coreCount).toBeGreaterThan(15_000);
    expect(missing.map((n) => [n % EM, Math.floor(n / EM)])).toEqual([]);
    expect(extra.map((n) => [n % EM, Math.floor(n / EM)])).toEqual([]);
    let differ = 0;
    for (let n = 0; n < EM * EM; n++) if (filled[n] !== eye[n]) differ++;
    require('node:fs').writeFileSync(
      '/tmp/wnbt/diverged.txt',
      `${differ} of ${EM * EM}, eye ${eye.reduce((a, b) => a + b, 0)}, core ${coreCount}`,
    );
  }, 60_000);
});
