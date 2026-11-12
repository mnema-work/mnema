// THE CHECK BEFORE A PULL REQUEST: `pnpm check:contribution`. Lint, build, typecheck, the guards that
// read the whole tree, and only the tests tied to the files this branch changed against its merge
// base with the project's main. It is a subset of CI, on purpose: one worker and a long test timeout,
// so it finishes in a small sandbox, and both are set here and in no workflow. CI runs the whole suite.
//
// `--plan` prints the steps as JSON and runs nothing (the test of this file runs the test steps).
// `MNEMA_CHANGED` (newline-separated paths) stands for the changed files, for the test of this file.
// `MNEMA_BASE` names the ref to compare with, for a clone whose remotes are named otherwise.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { failedGuards } from '../what-a-guard-checks/header.mjs';

/** @param {...string} args */
const git = (...args) => spawnSync('git', args, { encoding: 'utf-8' });
const out = (/** @type {ReturnType<typeof git>} */ r) => String(r.stdout).trim();

const refs = process.env.MNEMA_BASE
  ? [process.env.MNEMA_BASE]
  : ['refs/remotes/upstream/main', 'refs/remotes/origin/main'];
const ref = refs.find((r) => git('rev-parse', '--verify', '--quiet', r).status === 0);

if (ref === undefined && process.env.MNEMA_BASE) {
  console.error(
    `MNEMA_BASE=${process.env.MNEMA_BASE} does not name a ref in this clone. Give a branch, tag or commit that exists here.`,
  );
  process.exit(1);
}

if (ref === undefined) {
  console.error(
    `No main to compare with: ${refs.join(' or ')} is not fetched here, and the changed tests are chosen against it.\n` +
      'In a clone of the project itself:\n\n  git fetch origin main\n\n' +
      'In a fork, add the project as upstream first:\n\n' +
      '  git remote add upstream https://github.com/mnema-work/mnema.git && git fetch upstream main\n',
  );
  process.exit(1);
}

const base = out(git('merge-base', ref, 'HEAD'));
if (base === '') {
  const shallow = out(git('rev-parse', '--is-shallow-repository')) === 'true';
  console.error(
    shallow
      ? `This clone is shallow and ${ref} shares no history with HEAD in it. Run: git fetch --unshallow`
      : `HEAD shares no history with ${ref}. Fetch the project's main in full.`,
  );
  process.exit(1);
}

const changed = (
  process.env.MNEMA_CHANGED !== undefined
    ? process.env.MNEMA_CHANGED.split('\n')
    : [
        ...out(git('diff', '--name-only', base)).split('\n'),
        ...out(git('ls-files', '--others', '--exclude-standard')).split('\n'),
      ]
).filter((file) => file !== '');

/**
 * THE PACKAGES THAT IMPORT A CHANGED ONE. A test of `packages/code` that imports `@mnema/core`
 * reaches the package's built `dist`, not its source, so the module graph that `--changed` walks
 * ties a change under `packages/core/src` to the tests of core alone. These are the directories of
 * every package that depends on one whose source or manifest changed, followed through the
 * workspace dependencies, and their tests run whole.
 */
function dependentsOfChanged() {
  /** @type {Map<string, { name: string, needs: string[] }>} */
  const packages = new Map();
  for (const dir of readdirSync('packages')) {
    try {
      const manifest = JSON.parse(readFileSync(`packages/${dir}/package.json`, 'utf-8'));
      const needs = Object.keys({ ...manifest.dependencies, ...manifest.devDependencies });
      packages.set(dir, { name: manifest.name, needs });
    } catch {}
  }
  const touched = new Set(
    changed
      .flatMap((file) => /^packages\/([^/]+)\/(src\/|package\.json$)/.exec(file)?.[1] ?? [])
      .filter((dir) => packages.has(dir)),
  );
  const reached = new Set(touched);
  for (let grew = true; grew; ) {
    grew = false;
    for (const [dir, { needs }] of packages) {
      if (reached.has(dir)) continue;
      const names = [...reached].map((d) => packages.get(d)?.name);
      if (needs.some((name) => names.includes(name))) {
        reached.add(dir);
        grew = true;
      }
    }
  }
  return [...reached].filter((dir) => !touched.has(dir)).sort();
}
const dependents = dependentsOfChanged();
const pythonChanged = changed.some((file) => /^packages\/chain\/verifier\/.*\.py$/.test(file));

const slow = ['--maxWorkers=1', '--testTimeout=30000'];
/** @type {Array<[string, string, string[]]>} */
const steps = [
  ['lint', 'pnpm', ['lint']],
  ['build', 'pnpm', ['build']],
  ['typecheck', 'pnpm', ['typecheck']],
  ['guards', 'pnpm', ['exec', 'vitest', 'run', '--config', 'vitest.guards.config.ts', ...slow]],
  [
    `tests tied to the files changed since ${base.slice(0, 8)}`,
    'pnpm',
    ['exec', 'vitest', 'run', '--changed', base, ...slow, '--passWithNoTests'],
  ],
];
// Never left out, even when vitest runs every test anyway (a changed package.json does that; a changed
// vitest configuration does not, in the vitest installed): guessing which files make it do so was wrong
// once, and a repeated file costs less than a dependent that was skipped.
if (dependents.length > 0) {
  steps.push([
    `every test of the packages that import a changed one (${dependents.join(', ')}), added because --changed does not follow @mnema/* across packages`,
    'pnpm',
    [
      'exec',
      'vitest',
      'run',
      ...dependents.map((dir) => `packages/${dir}/`),
      ...slow,
      '--passWithNoTests',
    ],
  ]);
}
if (pythonChanged) {
  const reader = 'packages/chain/verifier/mnema_verify.py';
  steps.push(['second reader: self-test', 'python3', [reader, 'self-test']]);
  steps.push(['second reader: vectors', 'python3', [reader, 'vectors']]);
}

if (process.argv.includes('--plan')) {
  console.log(JSON.stringify(steps));
  process.exit(0);
}

/**
 * FOR EACH GUARD THAT FAILED, WHAT IT CHECKS. The guards step also writes vitest's JSON report to a
 * file of its own, beside the normal output, and this prints the path and the paragraph at the top
 * of each guard that is red, since a guard's message says what differed and this says what it is for.
 *
 * @param {string} reportPath
 */
function sayWhatTheFailedGuardsCheck(reportPath) {
  let guards = [];
  try {
    guards = failedGuards(JSON.parse(readFileSync(reportPath, 'utf-8')), process.cwd());
  } catch {
    return;
  }
  if (guards.length > 0) console.error('\nWhat each guard that failed checks:');
  for (const { file, says } of guards) {
    console.error(`\n${file}\n${says.replace(/^/gm, '  ')}`);
  }
}

const ran = [];
for (const [name, command, args] of steps) {
  console.log(`\n== ${name}: ${[command, ...args].join(' ')}`);
  const guards = name === 'guards';
  const scratch = mkdtempSync(join(tmpdir(), 'check-contribution-'));
  const report = join(scratch, 'vitest-report.json');
  const result = spawnSync(
    command,
    guards
      ? [...args, '--reporter=default', '--reporter=json', `--outputFile.json=${report}`]
      : args,
    { stdio: 'inherit' },
  );
  if (guards && result.status !== 0) sayWhatTheFailedGuardsCheck(report);
  rmSync(scratch, { recursive: true, force: true });
  if (result.status !== 0) {
    console.error(`\nFailed at "${name}". Fix it and run pnpm check:contribution again.`);
    process.exit(result.status ?? 1);
  }
  ran.push(name);
}

console.log(`\nRan, in order: ${ran.join('; ')}.`);
console.log(`${changed.length} files changed against ${ref}.`);
console.log(
  'This is a subset. CI runs the whole suite on Node 24.15.0, 24 and 26, and is the check that counts.',
);
