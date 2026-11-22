/**
 * The extension's icon, drawn in code: `drawIcon()` returns a 128x128 PNG as a Buffer, and
 * `drawIcon(512)` the same drawing at 512 pixels, for the plugin's icon in Anthropic's directory
 * (`plugin/.claude-plugin/icon.png`, written by `.github/the-plugin-icon/make.mjs`): every length
 * below is a share of the icon, so the shapes are the same at any size.
 *
 * The mark is the eye of the brand at rest, looking ahead, inside a dark rounded square, since a
 * store and the plugin directory ask for a square: the square fills the brand's frame (the view box
 * `-48 -48 96 96`, a corner radius of 22 units) in charcoal, the lines are bone and the iris is
 * sulphur, all three values of the brand's palette (`PALETTE`, `.github/the-brand/palette.mjs`),
 * and outside the square the icon is transparent. There is no border and no ring round the iris:
 * the ground is the dark one. What paints each point of the frame is `paintAt` of `the-eye.mjs`,
 * the extension's one door to the eye's geometry. Until this drawing the icon was the letter M of
 * the console's block wordmark in the old lilac accent, on GitHub's dark page, with a lilac border:
 * the brand's redesign took that mark away from every surface (ADR-370, ADR-488).
 *
 * The stores take a PNG and refuse an SVG, and the repository holds no raster tool, so the shapes
 * are filled at 4x4 samples per pixel and written as a PNG with `node:zlib` alone: the same bytes
 * on every run, no binary kept in the tree that has no source. Run by `package-vsix.mjs`, which
 * puts the file in the `.vsix` as `icon.png`.
 */

import { deflateSync } from 'node:zlib';
import { PALETTE } from '../../../.github/the-brand/palette.mjs';
import { paintAt } from './the-eye.mjs';

/** The size of the extension's icon, in pixels. */
const SIZE = 128;
const SAMPLES = 4;
/** The brand's frame, in its own units, and the corner radius of the square that fills it. */
const FRAME = 96;
const RADIUS = 22;
const rgb = (hex) => [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));
const GROUND = rgb(PALETTE.charcoal);
const LINE = rgb(PALETTE.bone);
const IRIS = rgb(PALETTE.sulphur);

/** Whether a point of the frame, centred on 0, is inside the rounded square that fills it. */
const inRoundedSquare = (x, y) => {
  const reach = FRAME / 2 - RADIUS;
  const qx = Math.abs(x) - reach;
  const qy = Math.abs(y) - reach;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) <= RADIUS;
};

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, 'latin1');
  const tail = Buffer.alloc(4);
  tail.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, tail]);
};

/**
 * The icon, `size` pixels on a side: the eye in its dark rounded square.
 * @param {number} [size] A whole number of pixels, at least 16; 128 by default.
 * @returns {Buffer}
 */
export function drawIcon(size = SIZE) {
  if (!Number.isInteger(size) || size < 16)
    throw new Error(`the icon is a whole number of pixels, at least 16, not ${String(size)}`);
  const unit = FRAME / size;

  /** The colour at a point of the icon, in pixels: [r, g, b, a] with a in 0..1. */
  const sample = (px, py) => {
    const x = px * unit - FRAME / 2;
    const y = py * unit - FRAME / 2;
    if (!inRoundedSquare(x, y)) return [0, 0, 0, 0];
    const paint = paintAt(x, y);
    if (paint === 'line') return [...LINE, 1];
    if (paint === 'iris') return [...IRIS, 1];
    return [...GROUND, 1];
  };

  const rows = [];
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 4);
    for (let x = 0; x < size; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = 0; sy < SAMPLES; sy++) {
        for (let sx = 0; sx < SAMPLES; sx++) {
          const [cr, cg, cb, ca] = sample(x + (sx + 0.5) / SAMPLES, y + (sy + 0.5) / SAMPLES);
          r += cr * ca;
          g += cg * ca;
          b += cb * ca;
          a += ca;
        }
      }
      const o = 1 + x * 4;
      row[o] = a === 0 ? 0 : Math.round(r / a);
      row[o + 1] = a === 0 ? 0 : Math.round(g / a);
      row[o + 2] = a === 0 ? 0 : Math.round(b / a);
      row[o + 3] = Math.round((a / (SAMPLES * SAMPLES)) * 255);
    }
    rows.push(row);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.set([8, 6, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(Buffer.concat(rows), { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
