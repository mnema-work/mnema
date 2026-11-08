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

/** The text of the file for these packages. */
export function noticesFor(packages) {
  return [
    '# Third-party notices',
    '',
    'The `mnema` command is built as one bundle (`dist/bundle/`) that carries the code of the',
    'packages below. Each is listed with its version and its license, as it ships them.',
    '',
    ...packages.map(([id, found]) => section(id, found)),
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
