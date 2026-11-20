/**
 * Builds the CLI as one executable file for Linux x64, with Node's single executable applications
 * (SEA): the program folded into one ES module by esbuild, and Node's own `--build-sea` writing the
 * executable (the Node that runs this script, plus the module as a blob). EXPERIMENTAL: unsigned,
 * Linux only, and what a release attaches with its SHA-256 (`docs/install.md`).
 *
 * WHICH NODE. `--build-sea` and an ES module as the entry arrive in Node 25.5 and 25.7, so the build
 * runs on Node 26, which the engines range of the package admits; that needs no `postject` and no
 * other dependency. The executable carries the Node that built it. A Node below 25.7 is refused
 * here, by name, before anything is written.
 *
 * WHAT IS THE SAME PROGRAM. The same entry (`dist/cli.js`), the same constants the build writes in
 * (`constantsOfTheBuild`) and the same target as `dist/bundle/`, but in ONE file: a SEA runs a single
 * script and cannot import its neighbours. Two modules are not the bundle's:
 *   - `react-devtools-core`, which ink imports only in its development mode and which is not
 *     installed, is an empty module here (the bundle leaves it as an import nobody reaches);
 *   - `string-width`, which `presentation/width.ts` asks for with a `require` at run time, is folded in
 *     and asked for as an import, because an executable has no `node_modules` beside it to resolve from.
 *
 * WHAT IT DOES NOT CARRY. The files a package finds beside itself are not inside an executable:
 * the built-in stack index (`mnema stack index`, `stack add` of a built-in name) and the site verifier
 * (`mnema site`). The hooks and the gate, which are what an executable is for where the first `node` on
 * the PATH is the wrong one, and the record verbs, do not read them.
 *
 * Writes into `outdir` (`dist/single-executable/` unless named): `mnema-<version>-linux-x64` and
 * `mnema-<version>-linux-x64.sha256`, the line `sha256sum --check` reads.
 */

import { spawnSync } from 'node:child_process';
import { chmodSync, createReadStream, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { constantsOfTheBuild } from './the-cli-bundle.mjs';

const here = new URL('.', import.meta.url);
const packageRoot = fileURLToPath(new URL('..', here));

/** Where the executable goes: beside the compiler's output, in a folder of its own. */
export const SINGLE_EXECUTABLE_DIR = fileURLToPath(new URL('../dist/single-executable', here));

/** The Node that builds: `--build-sea` (25.5) with an ES module as the entry (25.7). */
export const NODE_THAT_BUILDS = [25, 7];

/** What the executable is called for a version: platform and architecture are in the name. */
export function nameOfTheExecutable(version) {
  return `mnema-${version}-linux-x64`;
}

/** The configuration `node --build-sea` reads. Paths are absolute: Node resolves them from the file. */
export function seaConfig({ main, output }) {
  return {
    main,
    mainFormat: 'module',
    output,
    disableExperimentalSEAWarning: true,
    useSnapshot: false,
    useCodeCache: false,
  };
}

/** Whether `running` (`process.versions.node`) can build: at or past {@link NODE_THAT_BUILDS}. */
export function canBuild(running) {
  const [major = 0, minor = 0] = running.split('.').map(Number);
  const [needMajor, needMinor] = NODE_THAT_BUILDS;
  return major > needMajor || (major === needMajor && minor >= needMinor);
}

const ASKED_AT_RUN_TIME = /createRequire\(import\.meta\.url\)\('string-width'\)/;

/** esbuild plugins that make the two modules above what the executable can run. */
export function pluginsOfTheExecutable() {
  return [
    {
      name: 'react-devtools-core-is-empty',
      setup(b) {
        b.onResolve({ filter: /^react-devtools-core$/ }, () => ({
          path: 'react-devtools-core',
          namespace: 'empty',
        }));
        b.onLoad({ filter: /.*/, namespace: 'empty' }, () => ({ contents: 'export default {};' }));
      },
    },
    {
      name: 'string-width-is-imported',
      setup(b) {
        b.onLoad({ filter: /presentation[\\/]width\.js$/ }, (args) => {
          const source = readFileSync(args.path, 'utf-8');
          if (!ASKED_AT_RUN_TIME.test(source)) {
            throw new Error(
              'presentation/width.js no longer asks for string-width the way this build replaces',
            );
          }
          return {
            contents: `import * as __stringWidth from 'string-width';\n${source.replace(ASKED_AT_RUN_TIME, '(__stringWidth)')}`,
            loader: 'js',
            resolveDir: packageRoot,
          };
        });
      },
    },
  ];
}

function sha256Of(file) {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    createReadStream(file)
      .on('data', (chunk) => hash.update(chunk))
      .on('error', reject)
      .on('end', () => resolve(hash.digest('hex')));
  });
}

/** Builds the executable and its checksum file into `outdir`; returns both paths and the hash. */
export async function buildTheSingleExecutable(outdir = SINGLE_EXECUTABLE_DIR) {
  if (process.platform !== 'linux' || process.arch !== 'x64') {
    throw new Error(`the executable is built on Linux x64 only, this is ${process.platform} ${process.arch}`);
  }
  if (!canBuild(process.versions.node)) {
    throw new Error(
      `building the executable needs Node ${NODE_THAT_BUILDS.join('.')} or later (Node 26 is in the supported range), this is Node ${process.versions.node}`,
    );
  }
  const { version } = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf-8'));
  const name = nameOfTheExecutable(version);
  rmSync(outdir, { recursive: true, force: true });
  mkdirSync(outdir, { recursive: true });
  const main = join(outdir, 'mnema.mjs');
  const output = join(outdir, name);

  await build({
    entryPoints: [join(packageRoot, 'dist', 'cli.js')],
    absWorkingDir: packageRoot,
    outfile: main,
    bundle: true,
    splitting: false,
    platform: 'node',
    format: 'esm',
    target: 'node24',
    minify: false,
    sourcemap: false,
    define: await constantsOfTheBuild(),
    plugins: pluginsOfTheExecutable(),
    banner: {
      js: "import { createRequire as __mnemaCreateRequire } from 'node:module'; const require = __mnemaCreateRequire(import.meta.url);",
    },
    logLevel: 'warning',
    logOverride: { 'empty-import-meta': 'silent' },
  });

  const config = join(outdir, 'sea-config.json');
  writeFileSync(config, `${JSON.stringify(seaConfig({ main, output }), null, 2)}\n`);
  const made = spawnSync(process.execPath, ['--build-sea', config], { encoding: 'utf-8' });
  if (made.status !== 0) throw new Error(`node --build-sea failed:\n${made.stderr}${made.stdout}`);
  chmodSync(output, 0o755);

  const hash = await sha256Of(output);
  const sums = `${output}.sha256`;
  writeFileSync(sums, `${hash}  ${name}\n`);
  return { executable: output, checksum: sums, sha256: hash };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { executable, sha256 } = await buildTheSingleExecutable();
  process.stdout.write(`${executable}\n${sha256}\n`);
}
