/**
 * THE BUNDLE'S ENTRY LINKS NOTHING A NODE BELOW THE FLOOR LACKS. An ES module is linked before its
 * first line runs: every static import, and every static import of those, the whole closure. The
 * floor check (`src/node-floor.ts`) can speak only if that closure holds nothing an old Node cannot
 * link (`node:sqlite` is absent below 22.5 and warns below 24.15), and the program arrives through
 * an `import()` reached past the check. `the-node-below-the-floor-is-refused.test.ts` holds the
 * source to that; this holds what `build/the-cli-bundle.mjs` wrote, since a bundler decides which
 * chunk a module lands in and what each chunk imports.
 *
 * The walk follows the static imports of `dist/bundle/cli.js` from chunk to chunk and stops at an
 * `import()`; what it gathers outside the bundle must be builtins every Node a person can have
 * carries.
 */

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const PACKAGE = fileURLToPath(new URL('../', import.meta.url));
const ENTRY = join(PACKAGE, 'dist', 'bundle', 'cli.js');

/** What the entry may link: builtins every Node carries. */
const EVERY_NODE_HAS = ['node:fs', 'node:module', 'node:url'];

/** A static `import ... from "x"`, `import "x"` or `export ... from "x"`; never an `import(`. */
const STATIC = /^[ \t]*(?:import|export)\s+(?:[^'";]*?\sfrom\s*)?["']([^"']+)["']/gm;

interface Closure {
  readonly files: readonly string[];
  readonly outside: readonly string[];
}

function staticClosure(entry: string): Closure {
  const files = new Set<string>();
  const outside = new Set<string>();
  const walk = (file: string): void => {
    if (files.has(file)) return;
    files.add(file);
    for (const [, specifier] of readFileSync(file, 'utf-8').matchAll(STATIC)) {
      if (specifier === undefined) continue;
      if (specifier.startsWith('.')) walk(resolve(dirname(file), specifier));
      else outside.add(specifier);
    }
  };
  walk(entry);
  return { files: [...files], outside: [...outside].sort() };
}

describe('the static closure of the bundled entry', () => {
  it('links only builtins every Node has, and so no node:sqlite', () => {
    const { outside } = staticClosure(ENTRY);
    expect(outside).not.toContain('node:sqlite');
    expect(outside.filter((name) => !EVERY_NODE_HAS.includes(name))).toEqual([]);
  });

  it('holds the floor check, and reaches the program only through an import()', () => {
    const { files } = staticClosure(ENTRY);
    const linked = files.map((file) => readFileSync(file, 'utf-8')).join('\n');
    expect(linked).toContain('mnema needs Node');
    expect(linked).not.toContain('function runAsTheBinary');
    expect(readFileSync(ENTRY, 'utf-8')).toMatch(/import\("\.\/program-[A-Z0-9]+\.js"\)/);
  });

  it('follows a chain of chunks and an import split over lines, and stops at an import()', () => {
    const dir = mkdtempSync(join(tmpdir(), 'mnema-closure-'));
    try {
      writeFileSync(join(dir, 'entry.js'), 'import "./a.js";\nvoid import("./late.js");\n');
      writeFileSync(join(dir, 'a.js'), 'import {\n  one,\n  two\n} from "./b.js";\n');
      writeFileSync(join(dir, 'b.js'), 'import { DatabaseSync } from "node:sqlite";\n');
      writeFileSync(join(dir, 'late.js'), 'import "node:worker_threads";\n');
      expect(staticClosure(join(dir, 'entry.js')).outside).toEqual(['node:sqlite']);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
