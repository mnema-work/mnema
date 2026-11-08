import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { packageFile, rootAbove } from './package-root.js';

const PACKAGE = fileURLToPath(new URL('../', import.meta.url));

describe('packageFile', () => {
  it('names a file from the root of this package, from the folder the module runs in', () => {
    expect(packageFile('package.json')).toBe(join(PACKAGE, 'package.json'));
    expect(packageFile('dist/site-verifier.js')).toBe(join(PACKAGE, 'dist', 'site-verifier.js'));
  });
});

describe('rootAbove', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'mnema-root-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });
  const folder = (...parts: string[]): URL => pathToFileURL(`${join(dir, ...parts)}/`);

  it('walks past a manifest of another package and one that does not parse, to its own', () => {
    mkdirSync(join(dir, 'pkg', 'dist', 'bundle', 'deeper'), { recursive: true });
    writeFileSync(join(dir, 'pkg', 'package.json'), JSON.stringify({ name: '@mnema/code' }));
    writeFileSync(join(dir, 'pkg', 'dist', 'package.json'), JSON.stringify({ name: 'other' }));
    writeFileSync(join(dir, 'pkg', 'dist', 'bundle', 'package.json'), '{ not json');
    expect(rootAbove(folder('pkg', 'dist', 'bundle', 'deeper'))?.href).toBe(folder('pkg').href);
  });

  it('finds nothing when no folder above holds the package', () => {
    mkdirSync(join(dir, 'a', 'b'), { recursive: true });
    writeFileSync(join(dir, 'a', 'package.json'), JSON.stringify({ name: 'other' }));
    expect(rootAbove(folder('a', 'b'))).toBeUndefined();
  });
});
