// What the record page `mnema site` writes wears of the brand: the eye in its header, the eye as its favicon, and the two
// faces of the brand, written into ONE file of the product, `packages/code/src/site/the-mark.ts`. No package reads this
// folder (`the-front-page-is-drawn-from-the-console.test.ts` refuses a product file that names it, or the font reader), so
// the page cannot take the eye or the fonts from here at run time: this script makes the product's copy, the copy is
// committed, and `the-record-page-wears-the-mark.test.ts` holds it equal to what this makes.
//
//   - THE EYE of the header and the favicon are the brand's eye at rest (`./eye.mjs`, `EYE_AT_REST`), still: the header's
//     takes the ink of the page's text (`currentColor`) and the iris's sulphur, with no ring round the iris on any ground;
//     the favicon is the eye in its dark square, the
//     store icon's drawing, which reads on a light tab and on a dark one.
//   - THE FACES are WOFF2 subsets made by `subset-font` (HarfBuzz as WebAssembly): only the glyphs of `ARCHIVO_RANGES`, which
//     is Latin, since a page embeds what it prints (a record's text in another script falls to the system face the page's
//     font stack names next), and every layout feature of the font kept, kerning above all. The files of this folder are
//     the authors' own; the page carries a Modified Version of each (OFL, FAQ 2.6 and 3.1).
//   - ARCHIVO is a variable font of 658 KB: the file holds two static instances of it, at weight 400 and 700 and width 100.
//     Archivo declares no reserved name (`./fonts/OFL-Archivo.txt`, first lines), so the instances keep the name Archivo.
//   - IBM PLEX MONO is the face of ids, hashes and code. Its authors reserve the name "Plex" (`./fonts/OFL-IBMPlexMono.txt`,
//     first line), and a Modified Version may not carry a reserved name: the subset is renamed inside the file to
//     "mnema mono" (`MONO_NAME`), with no "Plex" and no "IBM" in any name record, and keeps the copyright and licence records.
//   - THE LICENCES of the two travel with the page, as the OFL asks of every copy: both texts, in a comment of the page's style.
//
// From the root of the repository:
//
//   node .github/the-brand/page.mjs          writes the file
//   node .github/the-brand/page.mjs --check  writes nothing; exits 1 if the committed file differs
//
// The script needs no build, and the file it writes is the same bytes on every run (the subsetter holds no clock).

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { eye, sealRect } from './eye.mjs';
import { PALETTE } from './palette.mjs';

/** @param {string} path */
const here = (path) => new URL(path, import.meta.url);
/** The file of the product this script writes. */
export const TARGET = fileURLToPath(here('../../packages/code/src/site/the-mark.ts'));

/** The codepoints Archivo's instances hold: Basic Latin, Latin-1, general punctuation (dashes, quotes, bullet, ellipsis) and the euro. */
/** @type {readonly (readonly [number, number])[]} */
export const ARCHIVO_RANGES = Object.freeze([
  /** @type {const} */ ([0x20, 0x7e]),
  /** @type {const} */ ([0xa0, 0xff]),
  /** @type {const} */ ([0x2010, 0x2027]),
  /** @type {const} */ ([0x20ac, 0x20ac]),
]);
/** The weights of the instances, at width 100. */
export const ARCHIVO_WEIGHTS = Object.freeze([400, 700]);
/** `subset-font` (HarfBuzz as WebAssembly) is a development dependency of the workspace. */
const spec = 'subset-font';
/** @type {{ default: (font: Uint8Array, text: string | undefined, options: object) => Promise<Buffer> }} */
const { default: subsetFont } = await import(spec);

/** @param {string} name */
const bytesOf = (name) => readFileSync(here(`./fonts/${name}`));

/** The Latin text a subsetter keeps the glyphs of: every codepoint of `ARCHIVO_RANGES`. */
const latinText = () =>
  ARCHIVO_RANGES.map(([from, to]) =>
    Array.from({ length: to - from + 1 }, (_, i) => String.fromCodePoint(from + i)).join(''),
  ).join('');

/** The name ids a subset keeps: the copyright and licence records (the OFL asks for both) and the ones that name the font. */
const KEPT_NAMES = [0, 1, 2, 3, 4, 5, 6, 13, 14];

/** @param {Buffer} b the sum of its 32-bit words, the table is padded with zeros */
const checksum = (b) => {
  let total = 0;
  const padded = Buffer.concat([b, Buffer.alloc((4 - (b.length % 4)) % 4)]);
  for (let i = 0; i < padded.length; i += 4) total = (total + padded.readUInt32BE(i)) >>> 0;
  return total;
};

/**
 * A copy of an SFNT file with the records of its `name` table rewritten: `rewrite` maps a name id to its new text, or to
 * `null` to drop the record; the other records are kept as they are. The checksums are recomputed; nothing else moves.
 * @param {Buffer} sfnt @param {Record<number, string | null>} rewrite
 */
function renamed(sfnt, rewrite) {
  const tables = [];
  for (let i = 0; i < sfnt.readUInt16BE(4); i++) {
    const at = 12 + i * 16;
    const offset = sfnt.readUInt32BE(at + 8);
    tables.push({
      tag: sfnt.toString('latin1', at, at + 4),
      data: Buffer.from(sfnt.subarray(offset, offset + sfnt.readUInt32BE(at + 12))),
    });
  }
  const nameAt = tables.findIndex((t) => t.tag === 'name');
  const old = /** @type {Buffer} */ (tables[nameAt]?.data);
  const strings = old.readUInt16BE(4);
  const records = [];
  for (let i = 0; i < old.readUInt16BE(2); i++) {
    const r = 6 + i * 12;
    const id = old.readUInt16BE(r + 6);
    const from = strings + old.readUInt16BE(r + 10);
    const raw = old.subarray(from, from + old.readUInt16BE(r + 8));
    const text = rewrite[id];
    if (text === null) continue;
    const value =
      text === undefined
        ? raw
        : old.readUInt16BE(r) === 1
          ? Buffer.from(text, 'latin1')
          : Buffer.from(text, 'utf16le').swap16();
    records.push({ id, kind: old.subarray(r, r + 6), value });
  }
  const head = Buffer.alloc(6 + records.length * 12);
  head.writeUInt16BE(records.length, 2);
  head.writeUInt16BE(head.length, 4);
  let offset = 0;
  for (const [i, r] of records.entries()) {
    const w = 6 + i * 12;
    r.kind.copy(head, w);
    head.writeUInt16BE(r.id, w + 6);
    head.writeUInt16BE(r.value.length, w + 8);
    head.writeUInt16BE(offset, w + 10);
    offset += r.value.length;
  }
  tables[nameAt] = { tag: 'name', data: Buffer.concat([head, ...records.map((r) => r.value)]) };
  const headTable = tables.find((t) => t.tag === 'head');
  headTable?.data.writeUInt32BE(0, 8);
  const directory = Buffer.alloc(12 + tables.length * 16);
  sfnt.copy(directory, 0, 0, 12);
  const parts = [directory];
  let place = directory.length;
  let headWhere = 0;
  for (const [i, t] of tables.entries()) {
    const w = 12 + i * 16;
    directory.write(t.tag, w, 'latin1');
    directory.writeUInt32BE(checksum(t.data), w + 4);
    directory.writeUInt32BE(place, w + 8);
    directory.writeUInt32BE(t.data.length, w + 12);
    if (t === headTable) headWhere = place;
    const padding = Buffer.alloc((4 - (t.data.length % 4)) % 4);
    parts.push(t.data, padding);
    place += t.data.length + padding.length;
  }
  const whole = Buffer.concat(parts);
  if (headTable) whole.writeUInt32BE((0xb1b0afba - checksum(whole)) >>> 0, headWhere + 8);
  return whole;
}

/**
 * One face as a WOFF2 subset: the Latin glyphs of the page, every layout feature kept (kerning above all), and, when the
 * authors' file is variable, pinned to one instance. The names inside are rewritten between the two passes.
 * @param {string} file @param {Record<number, string | null>} rename @param {Record<string, number>} [pin]
 */
async function subsetOf(file, rename, pin) {
  const text = latinText();
  const options = { preserveNameIds: KEPT_NAMES };
  const sfnt = await subsetFont(bytesOf(file), text, {
    ...options,
    ...(pin ? { variationAxes: pin } : {}),
    targetFormat: 'sfnt',
  });
  return subsetFont(renamed(sfnt, rename), text, { ...options, targetFormat: 'woff2' });
}

/** The name of the mono inside its file: a Modified Version of IBM Plex Mono carries a name of ours, with no "Plex" and no "IBM". */
export const MONO_NAME = 'mnema mono';
const mnemaMono = await subsetOf('IBMPlexMono-Regular.ttf', {
  1: MONO_NAME,
  2: 'Regular',
  3: `${MONO_NAME} 2.3`,
  4: `${MONO_NAME} Regular`,
  6: 'mnemamono-Regular',
});
/** @param {number} weight the static instance of Archivo at that weight and width 100, as WOFF2 */
const archivoAt = (weight) => {
  const style = weight === 700 ? 'Bold' : 'Regular';
  return subsetOf(
    'Archivo[wdth,wght].ttf',
    {
      1: 'Archivo',
      2: style,
      3: `Archivo ${style}`,
      4: `Archivo ${style}`,
      6: `Archivo-${style}`,
      16: null,
      17: null,
    },
    { wdth: 100, wght: weight },
  );
};
const archivo400 = await archivoAt(400);
const archivo700 = await archivoAt(700);

/** The drawing of the eye at rest, still, as the inside of an SVG with the view box `-48 -48 96 96`. */
/** @param {string} id @param {{ ink: string, iris: string }} options */
const inside = (id, options) => eye({ id, look: 0, ...options });

/**
 * The eye of the header: the dark eye, never inverted. Its lines are the page's `--seal-ink` and the seal behind it is the
 * page's `--seal`: on a dark page the seal is not painted and the lines are bone, on a light page it is charcoal under bone
 * lines. The iris is sulphur, no ring.
 */
export function headerEye() {
  return `<svg class="mark" xmlns="http://www.w3.org/2000/svg" viewBox="-48 -48 96 96" width="40" height="40" aria-hidden="true" focusable="false">${sealRect({ className: 'seal' })}${inside('mark-eye', { ink: 'currentColor', iris: PALETTE.sulphur })}</svg>`;
}

/** The eye of the favicon: the eye in its dark rounded square. */
export function faviconSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-48 -48 96 96" width="96" height="96">${sealRect({ fill: PALETTE.charcoal })}${inside('favicon-eye', { ink: PALETTE.bone, iris: PALETTE.sulphur })}</svg>`;
}

/** @param {Uint8Array | string} b */
const base64 = (b) => (typeof b === 'string' ? Buffer.from(b) : Buffer.from(b)).toString('base64');

/** The CSS range the Archivo instances answer for, as `unicode-range` writes it. */
export const archivoRange = () =>
  ARCHIVO_RANGES.map(([a, b]) => {
    const hex = (/** @type {number} */ n) => n.toString(16).toUpperCase();
    return a === b ? `U+${hex(a)}` : `U+${hex(a)}-${hex(b)}`;
  }).join(', ');

/** @param {string} name @param {string} value */
function constant(name, value) {
  const literal = `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\r?\n/g, '\\n')}'`;
  const one = `export const ${name} = ${literal};`;
  return one.length <= 100 ? `${one}\n` : `export const ${name} =\n  ${literal};\n`;
}

/** The text of `the-mark.ts`. */
export function theMark() {
  const licences = `${readFileSync(here('./fonts/OFL-Archivo.txt'), 'utf8').trim()}\n\n${readFileSync(here('./fonts/OFL-IBMPlexMono.txt'), 'utf8').trim()}\n`;
  if (licences.includes('*/')) throw new Error('a licence the comment cannot carry');
  return `/**
 * What the record page wears of the brand, written by a script of the repository and held equal to it by a test:
 * do not edit. The eye of the header and of the favicon are the brand's eye at rest, still; the faces are Archivo
 * (two static instances of the variable font, Latin only) and IBM Plex Mono Regular
 * (a subset of it, renamed 'mnema mono' under the OFL), as data.
 * The script's own comment says what is kept of each and why.
 */

${constant('HEADER_EYE', headerEye())}
${constant('FAVICON', `data:image/svg+xml;base64,${base64(faviconSvg())}`)}
${constant('ARCHIVO_RANGE', archivoRange())}
${constant('ARCHIVO_400', base64(archivo400))}
${constant('ARCHIVO_700', base64(archivo700))}
${constant('MNEMA_MONO_400', base64(mnemaMono))}
/** The licence of each face, as its authors wrote it: the page carries both. */
${constant('FONT_LICENCES', licences)}`;
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const made = theMark();
  if (process.argv.includes('--check')) {
    const same = (() => {
      try {
        return readFileSync(TARGET, 'utf8') === made;
      } catch {
        return false;
      }
    })();
    if (!same) {
      process.stderr.write(`${TARGET} is not what this script makes\n`);
      process.exit(1);
    }
  } else writeFileSync(TARGET, made);
}
