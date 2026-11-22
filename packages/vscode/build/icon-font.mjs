/**
 * The font that carries the eye to the status bar: `drawIconFont()` returns a TrueType file as a
 * Buffer, written with `node:` alone.
 *
 * The status bar draws text, and the only icons it can draw in text are glyphs of a font: the
 * editor's own codicons, or a font an extension names in `contributes.icons`. The eye of the brand
 * is not among the codicons, and a generator of fonts was refused as a dependency, so this writes
 * the one glyph by hand. The glyph is the eye at rest in one colour, the side bar's drawing
 * (`the-eye.mjs`): the union of the iris and the lines, clipped to the almond, written as
 * TrueType's own quadratic curves, so it keeps its shape at any density. Until this drawing the
 * glyph was the letter M of the console's block wordmark, as rectangles on whole pixels.
 *
 * HOW THE CURVES ARE MADE. Each line of the eye, inside the almond, is one region between two
 * edges over x: above, the lower of the line's top edge and the almond's (in the font, y grows
 * upward); below, the higher of the two bottoms. Where an edge passes from the line to the almond
 * there is a corner, and an on-curve point is put on it; between corners the edge is cut in spans
 * until a parabola through the two ends and the middle (one quadratic, its off-curve point above
 * the span's middle) stays within a quarter of a unit of the edge. The iris is eight quadratic
 * arcs. Every point is rounded to a whole unit, and every outline runs clockwise, so the
 * non-zero fill of TrueType unites the outlines that overlap.
 *
 * The file is built for the sanitizer the editor runs every web font through (OTS, in
 * Chromium), which throws away a font that lacks a table it asks for, and a thrown-away font
 * draws nothing: `OS/2`, `cmap` (format 4, U+E000 to glyph 1), `glyf`, `head`, `hhea`, `hmtx`,
 * `loca`, `maxp` (1.0), `name` and `post` (3.0), each with its checksum and the checksum of the
 * whole file in `head`. Glyph 0 is empty, glyph 1 is the eye. The em is 320 units, 20 for each
 * pixel of the 16 pixel line the bar draws icons on, with the ascent and descent the codicons use
 * (all above the baseline); the eye's frame of 96 units takes 280 of them (14 of the 16 pixels),
 * centred. The boxes in `head`, `hhea`, `hmtx` and `OS/2` are the glyph's own points. There is no
 * timestamp, so the bytes are the same on every run. `package-vsix.mjs` puts the file in the
 * `.vsix` as `media/mnema-icons.ttf`, and the manifest names it in `contributes.icons`.
 */

import { almondEdges, EYE, lineEdges } from './the-eye.mjs';

/** The line the status bar draws icons on, in pixels, and the units of the em for each pixel of it. */
const LINE = 16;
const PIXEL = 20;
const EM = LINE * PIXEL;
/** The units of the em the eye's frame (96 units of its own) takes, centred: 14 of the 16 pixels. */
const DRAWN = 280;
const SCALE = DRAWN / 96;
/** How far, in units of the em, a quadratic may stray from the edge it stands for before the span is cut. */
const TOLERANCE = 0.25;
const FAMILY = 'mnema-icons';
/** The private-use code point the manifest maps to the eye: `\E000`. */
export const EYE_CODE_POINT = 0xe000;

/** A point of the eye's frame (y down) in units of the em (y up), not yet rounded. */
const toEm = (x, y) => [EM / 2 + x * SCALE, EM / 2 - y * SCALE];

/** Where `f` changes sign between `a` and `b`, to within a billionth of a unit. */
function rootOf(f, a, b) {
  let lo = a;
  let hi = b;
  const below = f(lo) < 0;
  for (let n = 0; n < 60 && hi - lo > 1e-9; n++) {
    const mid = (lo + hi) / 2;
    if (f(mid) < 0 === below) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** Every x in `[a, b]` where `f` changes sign, scanned at a sixteenth of a unit and then refined. */
function rootsOf(f, a, b) {
  const roots = [];
  const step = 1 / 16;
  let x0 = a;
  let v0 = f(a);
  for (let x1 = a + step; x0 < b; x1 = Math.min(b, x1 + step)) {
    const v1 = f(x1);
    if (v0 < 0 !== v1 < 0) roots.push(rootOf(f, x0, x1));
    x0 = x1;
    v0 = v1;
    if (x1 === b) break;
  }
  return roots;
}

/**
 * The edge `f` from `a` to `b` as quadratics, each `[off-curve point, on-curve end]` in the frame's units. The off-curve
 * point stands over the middle of the span, so the quadratic is the parabola through the two ends and the middle.
 */
function quadratics(f, a, b, depth = 0) {
  const m = (a + b) / 2;
  const [fa, fm, fb] = [f(a), f(m), f(b)];
  const c = 2 * fm - (fa + fb) / 2;
  let stray = 0;
  for (const s of [0.125, 0.25, 0.375, 0.625, 0.75, 0.875]) {
    const drawn = (1 - s) ** 2 * fa + 2 * s * (1 - s) * c + s ** 2 * fb;
    stray = Math.max(stray, Math.abs(drawn - f(a + (b - a) * s)));
  }
  if (stray * SCALE > TOLERANCE && depth < 16)
    return [...quadratics(f, a, m, depth + 1), ...quadratics(f, m, b, depth + 1)];
  return [
    [
      [m, c],
      [b, fb],
    ],
  ];
}

/**
 * The outlines of one line of the eye inside the almond, each a closed list of points `{ x, y, on }` in the frame's
 * units, running clockwise as the font sees it: along the top from left to right, then along the bottom back.
 */
function lineOutlines(edges) {
  const top = (x) => Math.max(edges.top(x), almondEdges.top(x));
  const bottom = (x) => Math.min(edges.bottom(x), almondEdges.bottom(x));
  const open = (x) => bottom(x) - top(x);
  const { left, right } = almondEdges;
  const bounds = [left, ...rootsOf(open, left, right), right];
  const outlines = [];
  for (let k = 0; k < bounds.length - 1; k++) {
    const [a, b] = [bounds[k], bounds[k + 1]];
    if (!(open((a + b) / 2) > 0)) continue;
    /** The corners of an edge: where it passes between the line and the almond. */
    const pieces = (f, g) => [a, ...rootsOf((x) => f(x) - g(x), a, b), b];
    const along = (edge, corners) => {
      const points = [];
      for (let n = 0; n < corners.length - 1; n++)
        for (const [off, end] of quadratics(edge, corners[n], corners[n + 1]))
          points.push({ x: off[0], y: off[1], on: false }, { x: end[0], y: end[1], on: true });
      return points;
    };
    const upper = along(top, pieces(edges.top, almondEdges.top));
    const lower = along(bottom, pieces(edges.bottom, almondEdges.bottom));
    // The bottom, walked back from b to a: the same quadratics, read the other way.
    const back = [{ x: a, y: bottom(a), on: true }, ...lower].reverse();
    outlines.push([{ x: a, y: top(a), on: true }, ...upper, ...back]);
  }
  return outlines;
}

/** The iris as eight quadratic arcs, clockwise as the font sees it: each on-curve point, then the off-curve one after it. */
function irisOutline() {
  const { cx, cy, r } = EYE.iris;
  const reach = r / Math.cos(Math.PI / 8);
  const points = [];
  for (let k = 0; k < 8; k++) {
    // In the frame y grows downward, so the angle grows to run clockwise once the font turns y upward.
    const on = (k * Math.PI) / 4;
    const off = on + Math.PI / 8;
    points.push({ x: cx + r * Math.cos(on), y: cy + r * Math.sin(on), on: true });
    points.push({ x: cx + reach * Math.cos(off), y: cy + reach * Math.sin(off), on: false });
  }
  return points;
}

/**
 * The glyph's outlines in whole units of the em: the four lines inside the almond (the two outer lines of the six stay
 * outside it) and the iris. A point that rounds onto the on-curve point before it is dropped, and so is the last point
 * of an outline when it rounds onto the first.
 */
function outlinesInEm() {
  const outlines = [...lineEdges.flatMap(lineOutlines), irisOutline()];
  return outlines.map((outline) => {
    const kept = [];
    for (const point of outline) {
      const [x, y] = toEm(point.x, point.y).map(Math.round);
      const last = kept.at(-1);
      if (last !== undefined && last.on && point.on && last.x === x && last.y === y) continue;
      kept.push({ x, y, on: point.on });
    }
    const [first] = kept;
    const last = kept.at(-1);
    if (kept.length > 1 && first.x === last.x && first.y === last.y && last.on) kept.pop();
    return kept;
  });
}

const u16 = (n) => {
  const b = Buffer.alloc(2);
  b.writeUInt16BE(n & 0xffff);
  return b;
};
const i16 = (n) => {
  const b = Buffer.alloc(2);
  b.writeInt16BE(n);
  return b;
};
const u32 = (n) => {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(n >>> 0);
  return b;
};
const pad4 = (b) => Buffer.concat([b, Buffer.alloc((4 - (b.length % 4)) % 4)]);
const checksum = (b) => {
  const padded = pad4(b);
  let total = 0;
  for (let i = 0; i < padded.length; i += 4) total = (total + padded.readUInt32BE(i)) >>> 0;
  return total;
};


/**
 * The simple glyph of the outlines: each point's flag says whether it is on the curve (bit 0) or the off-curve point of
 * a quadratic, and its x and y are full 16 bit deltas from the point before.
 */
function glyphOf(outlines) {
  const points = outlines.flat();
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const box = { xMin: Math.min(...xs), yMin: Math.min(...ys), xMax: Math.max(...xs), yMax: Math.max(...ys) };
  let end = -1;
  const ends = outlines.map((outline) => {
    end += outline.length;
    return u16(end);
  });
  const parts = [
    i16(outlines.length),
    i16(box.xMin),
    i16(box.yMin),
    i16(box.xMax),
    i16(box.yMax),
    ...ends,
    u16(0), // no instructions
    Buffer.from(points.map((p) => (p.on ? 0x01 : 0x00))), // a full 16 bit delta on each axis
  ];
  for (const axis of ['x', 'y']) {
    let previous = 0;
    for (const point of points) {
      parts.push(i16(point[axis] - previous));
      previous = point[axis];
    }
  }
  return { data: pad4(Buffer.concat(parts)), box, points: points.length, contours: outlines.length };
}

/** `name` records are Windows, Unicode BMP, US English, sorted by id as the format asks. */
function nameTable() {
  const entries = [
    [1, FAMILY],
    [2, 'Regular'],
    [3, `${FAMILY} Regular`],
    [4, FAMILY],
    [5, 'Version 1.000'],
    [6, FAMILY],
  ];
  const strings = entries.map(([, text]) => Buffer.from(text, 'utf16le').swap16());
  let offset = 0;
  const records = entries.map(([id], i) => {
    const length = strings[i]?.length ?? 0;
    const record = Buffer.concat([u16(3), u16(1), u16(0x409), u16(id), u16(length), u16(offset)]);
    offset += length;
    return record;
  });
  return Buffer.concat([u16(0), u16(entries.length), u16(6 + 12 * entries.length), ...records, ...strings]);
}

/** cmap: one format 4 subtable, Windows Unicode BMP: the private-use code point to glyph 1. */
function cmapTable() {
  const subtable = Buffer.concat([
    u16(4),
    u16(32),
    u16(0),
    u16(4), // two segments, doubled
    u16(4),
    u16(1),
    u16(0),
    u16(EYE_CODE_POINT), // end codes
    u16(0xffff),
    u16(0), // reserved pad
    u16(EYE_CODE_POINT), // start codes
    u16(0xffff),
    u16(1 - EYE_CODE_POINT), // deltas: the code point plus the delta is the glyph
    u16(1),
    u16(0), // no range offsets
    u16(0),
  ]);
  return Buffer.concat([u16(0), u16(1), u16(3), u16(1), u32(12), subtable]);
}

/**
 * The font, its one glyph the eye.
 * @returns {Buffer}
 */
export function drawIconFont() {
  const m = glyphOf(outlinesInEm());
  const os2 = Buffer.alloc(96);
  os2.writeUInt16BE(4, 0); // version
  os2.writeInt16BE(EM, 2); // xAvgCharWidth
  os2.writeUInt16BE(400, 4); // regular weight
  os2.writeUInt16BE(5, 6); // normal width
  os2.writeInt16BE(PIXEL * 10, 10); // subscript size and offsets, and superscript: unused, plausible
  os2.writeInt16BE(PIXEL * 10, 12);
  os2.writeInt16BE(PIXEL * 2, 16);
  os2.writeInt16BE(PIXEL * 10, 18);
  os2.writeInt16BE(PIXEL * 10, 20);
  os2.writeInt16BE(PIXEL * 6, 24);
  os2.writeInt16BE(PIXEL, 26); // strikeout size
  os2.writeInt16BE(PIXEL * 6, 28); // strikeout position
  os2.writeUInt32BE(0x10000000, 46); // ulUnicodeRange2: bit 60, the private use area
  os2.write('NONE', 58, 'latin1'); // achVendID
  os2.writeUInt16BE(0x40, 62); // fsSelection: regular
  os2.writeUInt16BE(EYE_CODE_POINT, 64);
  os2.writeUInt16BE(EYE_CODE_POINT, 66);
  os2.writeInt16BE(EM, 68); // typo ascender: the line, all above the baseline
  os2.writeInt16BE(0, 70);
  os2.writeInt16BE(0, 72);
  os2.writeUInt16BE(EM, 74); // win ascent
  os2.writeUInt16BE(0, 76);
  os2.writeUInt32BE(1, 78); // code page range: Latin 1
  os2.writeInt16BE(m.box.yMax, 86); // xHeight
  os2.writeInt16BE(m.box.yMax, 88); // capHeight

  const head = Buffer.concat([
    u32(0x00010000), // version 1.0
    u32(0x00010000), // font revision 1.0
    u32(0), // checkSumAdjustment, set below
    u32(0x5f0f3cf5),
    u16(0x000b),
    u16(EM),
    Buffer.alloc(16), // created and modified: none, so the bytes never change
    i16(m.box.xMin),
    i16(m.box.yMin),
    i16(m.box.xMax),
    i16(m.box.yMax),
    u16(0), // macStyle
    u16(8), // lowest readable size in pixels
    i16(2),
    i16(0), // short offsets in `loca`
    i16(0),
  ]);

  const hhea = Buffer.concat([
    u32(0x00010000),
    i16(EM),
    i16(0),
    i16(0),
    u16(EM),
    i16(0), // min left side bearing: glyph 0 is empty and sits at 0
    i16(EM - m.box.xMax), // min right side bearing
    i16(m.box.xMax), // max extent
    i16(1), // caret slope: upright
    i16(0),
    i16(0),
    Buffer.alloc(8),
    i16(0),
    u16(2),
  ]);

  const hmtx = Buffer.concat([u16(EM), i16(0), u16(EM), i16(m.box.xMin)]);
  const loca = Buffer.concat([u16(0), u16(0), u16(m.data.length / 2)]);
  const maxp = Buffer.concat([
    u32(0x00010000),
    u16(2),
    u16(m.points),
    u16(m.contours),
    u16(0),
    u16(0),
    u16(1),
    Buffer.alloc(16),
  ]);
  const post = Buffer.concat([u32(0x00030000), u32(0), i16(-PIXEL), i16(PIXEL), Buffer.alloc(20)]);

  const tables = [
    ['OS/2', os2],
    ['cmap', cmapTable()],
    ['glyf', m.data],
    ['head', head],
    ['hhea', hhea],
    ['hmtx', hmtx],
    ['loca', loca],
    ['maxp', maxp],
    ['name', nameTable()],
    ['post', post],
  ];

  const directory = 12 + 16 * tables.length;
  let offset = directory;
  const entries = tables.map(([tag, table]) => {
    const entry = Buffer.concat([Buffer.from(tag, 'latin1'), u32(checksum(table)), u32(offset), u32(table.length)]);
    offset += pad4(table).length;
    return entry;
  });
  // For ten tables: the largest power of two not above the count is 8.
  const search = 16 * 2 ** Math.floor(Math.log2(tables.length));
  const file = Buffer.concat([
    Buffer.from([0, 1, 0, 0]),
    u16(tables.length),
    u16(search),
    u16(Math.floor(Math.log2(tables.length))),
    u16(16 * tables.length - search),
    ...entries,
    ...tables.map(([, table]) => pad4(table)),
  ]);
  // The adjustment makes the whole file sum to a constant; `head` is summed with it as zero.
  const headAt = 12 + 16 * tables.findIndex(([tag]) => tag === 'head');
  const at = file.readUInt32BE(headAt + 8) + 8;
  file.writeUInt32BE((0xb1b0afba - checksum(file)) >>> 0, at);
  return file;
}
