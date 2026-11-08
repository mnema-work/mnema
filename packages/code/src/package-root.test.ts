import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { packageFile } from './package-root.js';

const PACKAGE = fileURLToPath(new URL('../', import.meta.url));

describe('packageFile', () => {
  it('names a file from the root of this package, from the folder the module runs in', () => {
    expect(packageFile('package.json')).toBe(join(PACKAGE, 'package.json'));
    expect(packageFile('dist/site-verifier.js')).toBe(join(PACKAGE, 'dist', 'site-verifier.js'));
  });

  it('stops at the manifest of this package, not at the first manifest above', () => {
    const manifest = JSON.parse(readFileSync(packageFile('package.json') ?? '', 'utf-8')) as {
      name: string;
    };
    expect(manifest.name).toBe('@mnema/code');
  });
});
