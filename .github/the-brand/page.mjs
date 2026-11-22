// What the record page `mnema site` writes wears of the brand: the eye in its header, the eye as its favicon, and the two
// faces of the brand, written into ONE file of the product, `packages/code/src/site/the-mark.ts`. No package reads this
// folder (`the-front-page-is-drawn-from-the-console.test.ts` refuses a product file that names it, or the font reader), so
// the page cannot take the eye or the fonts from here at run time: this script makes the product's copy, the copy is
// committed, and `the-record-page-wears-the-mark.test.ts` holds it equal to what this makes.
//
//   - THE EYE of the header and the favicon are the brand's eye at rest (`./eye.mjs`, `EYE_AT_REST`), still: the header's
//     takes the ink of the page's text (`currentColor`) and the iris's sulphur, with the thin ring round the iris that a
//     light ground needs (the page's style drops the ring on the dark ground); the favicon is the eye in its dark square, the
//     store icon's drawing, which reads on a light tab and on a dark one.
//   - ARCHIVO is the face of the page's text. It is a variable font of 658 KB whose only copy here is the authors' own, and
//     a page embeds what it prints: Latin. So the file holds two static instances of it, at weight 400 and 700 and width
//     100, each with only the glyphs of `ARCHIVO_RANGES` (the rest of a record's text, in another script, falls to the
//     system face the page's font stack names next). The OFL's reserved-name clause binds a font that declares a reserved
//     name; Archivo declares none (`./fonts/OFL-Archivo.txt`, first lines), so the instances keep the name Archivo.
//   - IBM PLEX MONO is the face of ids, hashes and code. Its authors reserve the name "Plex" (`./fonts/OFL-IBMPlexMono.txt`,
//     first line), and a Modified Version may not carry a reserved name, so the Regular file is embedded WHOLE, byte for byte,
//     and no glyph is taken out of it.
//   - THE LICENCES of the two travel with the page, as the OFL asks of every copy: both texts, in a comment of the page's style.
//
// From the root of the repository:
//
//   node .github/the-brand/page.mjs          writes the file
//   node .github/the-brand/page.mjs --check  writes nothing; exits 1 if the committed file differs
//
// The script needs no build, and the file it writes is the same bytes on every run (the writer's timestamp is pinned).

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { eye } from './eye.mjs';
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
/** Any fixed instant: the writer stamps the font with the time it was made, and the file must not change with it. */
const STAMP = Date.UTC(2026, 10, 21);

const spec = 'opentype.js';
/** @type {any} */
const loaded = await import(spec);
/** @type {any} */
const opentype = loaded.default ?? loaded;

/** @param {string} name */
const bytesOf = (name) => readFileSync(here(`./fonts/${name}`));
/** @param {Buffer} b */
const arrayOf = (b) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);

/** @param {number} weight the static instance of Archivo at that weight and width 100, as the bytes of an OpenType file */
function archivoAt(weight) {
  const font = opentype.parse(arrayOf(bytesOf('Archivo[wdth,wght].ttf')));
  const em = font.unitsPerEm;
  const variation = { wdth: 100, wght: weight };
  /** The glyph drawn at the instance, upright again (a path from `getPath` runs y down) and in whole units. */
  /** @param {any} glyph @param {number | undefined} unicode */
  const redraw = (glyph, unicode) => {
    const path = new opentype.Path();
    /** @param {number | undefined} v */
    const n = (v) => (v === undefined ? undefined : Math.round(v));
    /** @param {number | undefined} v */
    const y = (v) => (v === undefined ? undefined : -Math.round(v));
    for (const c of glyph.getPath(0, 0, em, { variation }, font).commands) {
      path.commands.push({
        ...c,
        x: n(c.x),
        y: y(c.y),
        x1: n(c.x1),
        y1: y(c.y1),
        x2: n(c.x2),
        y2: y(c.y2),
      });
    }
    const advance = Math.round(glyph.advanceWidth);
    return new opentype.Glyph({
      name:
        unicode === undefined
          ? '.notdef'
          : `uni${unicode.toString(16).toUpperCase().padStart(4, '0')}`,
      unicode,
      advanceWidth: advance,
      path,
    });
  };
  const glyphs = [redraw(font.glyphs.get(0), undefined)];
  for (const [from, to] of ARCHIVO_RANGES) {
    for (let code = from; code <= to; code++) {
      const glyph = font.charToGlyph(String.fromCodePoint(code));
      if (glyph.index === 0) continue;
      glyphs.push(redraw(glyph, code));
    }
  }
  const instance = new opentype.Font({
    familyName: 'Archivo',
    styleName: weight === 700 ? 'Bold' : 'Regular',
    unitsPerEm: em,
    ascender: font.ascender,
    descender: font.descender,
    copyright:
      'Copyright 2020 The Archivo Project Authors (https://github.com/Omnibus-Type/Archivo)',
    license:
      'This Font Software is licensed under the SIL Open Font License, Version 1.1. This license is available with a FAQ at: https://openfontlicense.org',
    licenseURL: 'https://openfontlicense.org',
    createdTimestamp: STAMP / 1000,
    glyphs,
  });
  // The writer stamps the file's modified time from the clock: hold the clock still while it writes.
  const realGetTime = Date.prototype.getTime;
  Date.prototype.getTime = () => STAMP;
  try {
    return Buffer.from(instance.toArrayBuffer());
  } finally {
    Date.prototype.getTime = realGetTime;
  }
}

/** The drawing of the eye at rest, still, as the inside of an SVG with the view box `-48 -48 96 96`. */
/** @param {string} id @param {{ ink: string, iris: string, ringInk: string, ring: boolean }} options */
const inside = (id, options) => eye({ id, look: 0, ...options });

/** The eye of the header: the ink of the page's text, the iris sulphur, a ring round the iris. */
export function headerEye() {
  return `<svg class="mark" xmlns="http://www.w3.org/2000/svg" viewBox="-48 -48 96 96" width="40" height="40" aria-hidden="true" focusable="false">${inside('mark-eye', { ink: 'currentColor', iris: PALETTE.sulphur, ringInk: 'currentColor', ring: true })}</svg>`;
}

/** The eye of the favicon: the eye in its dark rounded square. */
export function faviconSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-48 -48 96 96" width="96" height="96"><rect x="-48" y="-48" width="96" height="96" rx="22" fill="${PALETTE.charcoal}"/>${inside('favicon-eye', { ink: PALETTE.bone, iris: PALETTE.sulphur, ringInk: PALETTE.charcoal, ring: false })}</svg>`;
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
  const [regular, bold] = ARCHIVO_WEIGHTS.map((w) => base64(archivoAt(w)));
  return `/**
 * What the record page wears of the brand, written by a script of the repository and held equal to it by a test:
 * do not edit. The eye of the header and of the favicon are the brand's eye at rest, still; the faces are Archivo
 * (two static instances of the variable font, Latin only) and IBM Plex Mono Regular (the authors' file, whole), as data.
 * The script's own comment says what is kept of each and why.
 */

${constant('HEADER_EYE', headerEye())}
${constant('FAVICON', `data:image/svg+xml;base64,${base64(faviconSvg())}`)}
${constant('ARCHIVO_RANGE', archivoRange())}
${constant('ARCHIVO_400', regular ?? '')}
${constant('ARCHIVO_700', bold ?? '')}
${constant('PLEX_MONO_400', base64(bytesOf('IBMPlexMono-Regular.ttf')))}
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
