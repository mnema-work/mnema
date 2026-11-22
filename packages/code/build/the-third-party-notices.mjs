/**
 * Writes `THIRD-PARTY-NOTICES.md`: the license of every third-party package the CLI bundle carries.
 *
 * The packages are not those `package.json` names but those esbuild actually folded in: the build
 * is run into a scratch folder and its metafile lists every input file, so a dependency of a
 * dependency is there and one the bundle tree-shook away is not. For each package the file gives
 * its name, version and the license its `package.json` declares, then the text of its license
 * file and of its NOTICE file where it ships one.
 *
 * Run it after `pnpm build` when a dependency changes:
 * `node packages/code/build/the-third-party-notices.mjs`. It writes the file in place, and
 * `tests/the-notices-name-every-package-the-bundle-carries.test.ts` is red while a package the
 * bundle carries is missing from it.
 */

import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundleTheCli } from './the-cli-bundle.mjs';

const packageRoot = fileURLToPath(new URL('..', import.meta.url));

/** Where the file goes, beside the package's own NOTICE. */
export const NOTICES = join(packageRoot, 'THIRD-PARTY-NOTICES.md');

const MARK = 'node_modules/';

/** The folder of each third-party package among the metafile's inputs, by `name@version`. */
export function packagesOf(inputs) {
  const found = new Map();
  for (const input of inputs) {
    const at = input.lastIndexOf(MARK);
    if (at < 0) continue;
    const parts = input.slice(at + MARK.length).split('/');
    const name = parts[0].startsWith('@') ? `${parts[0]}/${parts[1]}` : parts[0];
    const dir = join(packageRoot, input.slice(0, at + MARK.length + name.length));
    const manifest = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf-8'));
    found.set(`${manifest.name}@${manifest.version}`, { manifest, dir });
  }
  return [...found.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
}

function filesNamed(dir, pattern) {
  return readdirSync(dir)
    .filter((file) => pattern.test(file))
    .sort();
}

function section(id, { manifest, dir }) {
  const lines = [`## ${id}`, '', `License: ${manifest.license ?? 'not declared'}`, ''];
  const licenses = filesNamed(dir, /^(licen[cs]e|copying)(\..*)?$/i);
  const notices = filesNamed(dir, /^notice(\..*)?$/i);
  if (licenses.length === 0) {
    lines.push(
      'The package ships no license file; the license above is the one its package.json declares.',
      '',
    );
  }
  for (const file of [...licenses, ...notices]) {
    lines.push(`${file}:`, '', '```', readFileSync(join(dir, file), 'utf-8').trimEnd(), '```', '');
  }
  return lines.join('\n');
}

const FONTS = join(packageRoot, '..', '..', '.github', 'the-brand', 'fonts');

/**
 * The two faces the record page (`mnema site`) embeds as data, each a Modified Version of the authors' font under the
 * SIL Open Font License 1.1: the copyright and the licence text, as the OFL asks of every copy.
 */
function fontsSection() {
  const face = (name, file, said) => [
    `### ${name}`,
    '',
    said,
    '',
    '```',
    readFileSync(join(FONTS, file), 'utf-8').trim(),
    '```',
    '',
  ];
  return [
    '# Fonts embedded in the record page',
    '',
    'The page `mnema site` writes carries two typefaces as WOFF2 data, each a Latin subset of the authors\' font under the SIL',
    'Open Font License 1.1, which is the text below each name.',
    '',
    ...face(
      'Archivo',
      'OFL-Archivo.txt',
      'Archivo 2.001, Copyright 2020 The Archivo Project Authors. The page carries two static instances of the variable font (weights 400 and 700), each with only the Latin glyphs, and keeps the name Archivo.',
    ),
    ...face(
      'IBM Plex Mono',
      'OFL-IBMPlexMono.txt',
      'IBM Plex Mono Regular 2.3, Copyright 2017 IBM Corp. "Plex" is a Reserved Font Name of its authors, so the page carries a renamed subset: a Modified Version with only the Latin glyphs, named "mnema mono" inside the file.',
    ),
  ].join('\n');
}

/** The text of the file for these packages. */
export function noticesFor(packages) {
  return [
    '# Third-party notices',
    '',
    'The `mnema` command is built as one bundle (`dist/bundle/`) that carries the code of the',
    'packages below. Each is listed with its version and its license, as it ships them.',
    '',
    ...packages.map(([id, found]) => section(id, found)),
    fontsSection(),
  ].join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const scratch = mkdtempSync(join(tmpdir(), 'mnema-notices-'));
  try {
    const { metafile } = await bundleTheCli(scratch);
    writeFileSync(NOTICES, noticesFor(packagesOf(Object.keys(metafile.inputs))));
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}
