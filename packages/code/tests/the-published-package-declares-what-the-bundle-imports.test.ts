// @reads-the-tree
/**
 * THE PUBLISHED PACKAGE DECLARES WHAT THE BUNDLE IMPORTS, and nothing else.
 *
 * `build/the-cli-bundle.mjs` folds the code of every dependency into `dist/bundle/` and leaves
 * outside only the packages named in `LEFT_OUTSIDE`. A manifest that goes on declaring the rest
 * makes `npm i -g @mnema/code` fetch packages the command never loads (132 of them, measured),
 * and a manifest that forgets one the bundle does import fails at the first run, on a machine
 * with no workspace to hide it. Both are asked of the packed manifest and of the bundle's own
 * metafile, never of the manifest on disk, where the workspace needs the siblings declared.
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { isBuiltin } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';

const PACKAGE = fileURLToPath(new URL('../', import.meta.url));
const SANDBOX = mkdtempSync(join(tmpdir(), 'mnema-declares-'));
afterAll(() => rmSync(SANDBOX, { recursive: true, force: true }));

const { bundleTheCli, LEFT_OUTSIDE } = (await import(
  pathToFileURL(join(PACKAGE, 'build', 'the-cli-bundle.mjs')).href
)) as {
  bundleTheCli: (outdir: string) => Promise<{
    metafile: { outputs: Record<string, { imports: { path: string; external?: boolean }[] }> };
  }>;
  LEFT_OUTSIDE: readonly string[];
};

/**
 * Imports the bundle holds that no install has to satisfy: `react-devtools-core` is ink's
 * development hook and `bufferutil` and `utf-8-validate` are the native speedups `ws` requires
 * inside a try, falling back to JavaScript when they are absent.
 */
const OPTIONAL = ['react-devtools-core', 'bufferutil', 'utf-8-validate'];

/** The package a bare import names: `@scope/name/deep` is `@scope/name`. */
const packageOf = (path: string): string =>
  path
    .split('/')
    .slice(0, path.startsWith('@') ? 2 : 1)
    .join('/');

/** What the bundle imports from node_modules at run time, from the metafile of a fresh build. */
async function importedByTheBundle(): Promise<string[]> {
  const { metafile } = await bundleTheCli(join(SANDBOX, 'bundle'));
  const found = new Set<string>();
  for (const output of Object.values(metafile.outputs)) {
    for (const entry of output.imports) {
      if (entry.external !== true || isBuiltin(entry.path) || entry.path.startsWith('node:'))
        continue;
      found.add(packageOf(entry.path));
    }
  }
  return [...found].sort();
}

function packed(): { manifest: Record<string, unknown>; files: string[] } {
  const said = execFileSync('pnpm', ['pack', '--json', '--pack-destination', SANDBOX], {
    cwd: PACKAGE,
    encoding: 'utf-8',
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  const tarball = (JSON.parse(said) as { filename: string }).filename;
  const manifest = JSON.parse(
    execFileSync('tar', ['-xzOf', tarball, 'package/package.json'], { encoding: 'utf-8' }),
  ) as Record<string, unknown>;
  const files = execFileSync('tar', ['-tzf', tarball], {
    encoding: 'utf-8',
    maxBuffer: 64 * 1024 * 1024,
  })
    .split('\n')
    .filter((line) => line !== '' && !line.endsWith('/'))
    .map((line) => line.replace(/^package\//, ''));
  return { manifest, files };
}

describe('the package as it is published', () => {
  const tarball = packed();

  it('declares as dependencies the packages the bundle imports, and no other', async () => {
    const wanted = (await importedByTheBundle()).filter((name) => !OPTIONAL.includes(name));
    const declared = Object.keys(
      (tarball.manifest.dependencies ?? {}) as Record<string, string>,
    ).sort();
    expect(
      declared,
      'The bundle imports these from node_modules at run time; declare each in dependencies, and move every other dependency of packages/code/package.json to devDependencies',
    ).toEqual(wanted);
  });

  it('leaves outside only what the bundle script says it leaves outside', async () => {
    const imported = (await importedByTheBundle()).filter((name) => !OPTIONAL.includes(name));
    expect(imported).toEqual(LEFT_OUTSIDE.filter((name) => !OPTIONAL.includes(name)).sort());
  });

  it('carries nothing of dist/ outside dist/bundle/', () => {
    const stray = tarball.files.filter(
      (path) => path.startsWith('dist/') && !path.startsWith('dist/bundle/'),
    );
    expect(stray).toEqual([]);
  });

  it('exports nothing but its manifest, so the library is not a way in', () => {
    expect(tarball.manifest.exports).toEqual({ './package.json': './package.json' });
  });
});
