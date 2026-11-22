/**
 * THE SINGLE EXECUTABLE IS CONFIGURED AS NODE READS IT. `build/the-single-executable.mjs` writes the file
 * `node --build-sea` is handed and replaces two modules that an executable cannot resolve from disk. A key Node
 * does not know, an entry that is not an ES module, or a replacement that silently stops matching the source
 * it patches would make an executable that is not built, or that dies on the first wide glyph. The build
 * itself, and the executable running without a Node, are the CI job `the single executable`
 * (`.github/workflows/single-executable.yml`); this one holds what can be held without building a 150 MB file.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

const PACKAGE = fileURLToPath(new URL('../', import.meta.url));

type Handler = (args: { path: string }) => { contents: string } | undefined;
type Plugin = {
  name: string;
  setup: (b: {
    onResolve: (o: unknown, h: unknown) => void;
    onLoad: (o: { filter: RegExp; namespace?: string }, h: Handler) => void;
  }) => void;
};

const { seaConfig, canBuild, nameOfTheExecutable, pluginsOfTheExecutable, NODE_THAT_BUILDS } =
  (await import(pathToFileURL(join(PACKAGE, 'build', 'the-single-executable.mjs')).href)) as {
    seaConfig: (paths: { main: string; output: string }) => Record<string, unknown>;
    canBuild: (running: string) => boolean;
    nameOfTheExecutable: (version: string) => string;
    pluginsOfTheExecutable: () => Plugin[];
    NODE_THAT_BUILDS: [number, number];
  };

describe('the file node --build-sea reads', () => {
  it('names the module, says it is an ES module, and asks for no snapshot and no code cache', () => {
    expect(seaConfig({ main: '/o/mnema.mjs', output: '/o/mnema-x' })).toEqual({
      main: '/o/mnema.mjs',
      mainFormat: 'module',
      output: '/o/mnema-x',
      disableExperimentalSEAWarning: true,
      useSnapshot: false,
      useCodeCache: false,
    });
  });

  it('is named by version, platform and architecture', () => {
    expect(nameOfTheExecutable('1.2.3')).toBe('mnema-1.2.3-linux-x64');
    expect(nameOfTheExecutable('0.2.0-beta')).toBe('mnema-0.2.0-beta-linux-x64');
  });
});

describe('the Node that builds', () => {
  it('is 25.7 or later: the first with an ES module as the entry', () => {
    expect(NODE_THAT_BUILDS).toEqual([25, 7]);
    expect(canBuild('24.22.2')).toBe(false);
    expect(canBuild('25.6.9')).toBe(false);
    expect(canBuild('25.7.0')).toBe(true);
    expect(canBuild('26.0.0')).toBe(true);
    expect(canBuild('26.13.1')).toBe(true);
  });
});

/** The load handler of the plugin that folds `string-width` in, as esbuild would call it. */
function widthHandler(): Handler {
  const plugin = pluginsOfTheExecutable().find((p) => p.name === 'string-width-is-imported');
  let found: Handler | undefined;
  plugin?.setup({
    onResolve: () => undefined,
    onLoad: (_options, handler) => {
      found = handler;
    },
  });
  if (found === undefined) throw new Error('the plugin registered no load handler');
  return found;
}

describe('string-width in the executable', () => {
  it('is imported where the compiled module asks for it at run time', () => {
    const compiled = join(PACKAGE, 'dist', 'presentation', 'width.js');
    expect(readFileSync(compiled, 'utf-8')).toContain(
      "createRequire(import.meta.url)('string-width')",
    );
    const out = widthHandler()({ path: compiled })?.contents ?? '';
    expect(out).toContain("import * as __stringWidth from 'string-width';");
    expect(out).toContain('(__stringWidth).default');
    expect(out).not.toContain("createRequire(import.meta.url)('string-width')");
  });

  it('stops the build when the module no longer asks for it that way', () => {
    const elsewhere = join(PACKAGE, 'dist', 'version.js');
    expect(() => widthHandler()({ path: elsewhere })).toThrow(/no longer asks for string-width/);
  });
});
