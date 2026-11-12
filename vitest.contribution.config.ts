import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig, mergeConfig } from 'vitest/config';
import main from './vitest.config.js';

/**
 * THE MAIN SUITE'S CONFIGURATION, WITH `@mnema/*` READ FROM SOURCE. Used only by
 * `pnpm check:contribution`, for the step that runs the tests tied to the files a change touched.
 * A test that imports `@mnema/core` reaches `dist` through the package's `exports`, so a change
 * under `packages/core/src` is, to the module graph, tied to nothing that imports the package.
 * Here each export is aliased to its source file, so the graph follows the import and
 * `--changed` lists the tests of every package that consumes the one that changed. It sets no
 * timeout and no worker count: those come from the command.
 */
const root = fileURLToPath(new URL('.', import.meta.url));

type Manifest = { name: string; exports?: Record<string, { default?: string }> };

const alias = readdirSync(`${root}packages`).flatMap((dir) => {
  let manifest: Manifest;
  try {
    manifest = JSON.parse(readFileSync(`${root}packages/${dir}/package.json`, 'utf-8')) as Manifest;
  } catch {
    return [];
  }
  return Object.entries(manifest.exports ?? {}).flatMap(([subpath, target]) => {
    const built = target.default?.match(/^\.\/dist\/(.+)\.js$/);
    if (!built) return [];
    const find = subpath === '.' ? manifest.name : `${manifest.name}/${subpath.slice(2)}`;
    return [{ find: new RegExp(`^${find}$`), replacement: `${root}packages/${dir}/src/${built[1]}.ts` }];
  });
});

export default mergeConfig(main, defineConfig({ resolve: { alias } }));
