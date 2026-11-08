/**
 * THE NOTICES NAME EVERY PACKAGE THE BUNDLE CARRIES: `THIRD-PARTY-NOTICES.md` gives the license
 * of each third-party package whose code is inside `dist/bundle/`, and the package publishes it.
 *
 * The packages are read from the bundle itself, not from the script that writes the file: esbuild
 * opens the code of each module it folds in with a comment naming its source path, and a path
 * under `node_modules/` names the package and the folder its `package.json` is in. A dependency
 * that enters the bundle (a new one, or one that changes version) is red here until
 * `node packages/code/build/the-third-party-notices.mjs` is run again after `pnpm build`.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const PACKAGE = fileURLToPath(new URL('../', import.meta.url));
const BUNDLE = join(PACKAGE, 'dist', 'bundle');
const NOTICES = 'THIRD-PARTY-NOTICES.md';

/** `name@version` of each third-party package whose code a chunk of the bundle carries. */
function packagesIn(chunks: readonly string[]): string[] {
  const found = new Set<string>();
  const source = /^\/\/ (\S*node_modules\/)((?:@[^/\s]+\/)?[^/\s]+)\//gm;
  for (const chunk of chunks) {
    for (const [, before, name] of chunk.matchAll(source)) {
      const manifest = JSON.parse(
        readFileSync(join(PACKAGE, `${before}${name}`, 'package.json'), 'utf-8'),
      ) as { version: string };
      found.add(`${name}@${manifest.version}`);
    }
  }
  return [...found].sort();
}

/** `name@version` of each package the notices file has a section for. */
function packagesNoticed(text: string): string[] {
  return [...text.matchAll(/^## (\S+)$/gm)].map(([, id]) => id as string).sort();
}

function chunks(): string[] {
  return readdirSync(BUNDLE)
    .filter((file) => file.endsWith('.js'))
    .map((file) => readFileSync(join(BUNDLE, file), 'utf-8'));
}

describe('the third-party notices of the bundle', () => {
  it('name each package whose code the bundle carries, with its version, and no other', () => {
    const carried = packagesIn(chunks());
    // The walk finds the packages at all: commander and zod are in every build of the CLI.
    expect(carried.some((id) => id.startsWith('commander@'))).toBe(true);
    expect(carried.some((id) => id.startsWith('zod@'))).toBe(true);
    expect(packagesNoticed(readFileSync(join(PACKAGE, NOTICES), 'utf-8'))).toEqual(carried);
  });

  it('are published with the package', () => {
    const manifest = JSON.parse(readFileSync(join(PACKAGE, 'package.json'), 'utf-8')) as {
      files: string[];
    };
    expect(manifest.files).toContain(NOTICES);
  });
});
