// THE CHECK BEFORE A PULL REQUEST: `pnpm check:contribution`. Lint, build, typecheck, the guards that
// read the whole tree, and only the tests tied to the files this branch changed against its merge
// base with the project's main. It is a subset of CI, on purpose: one worker and a long test timeout,
// so it finishes in a small sandbox, and both are set here and in no workflow. CI runs the whole suite.
//
// `--plan` prints the steps as JSON and runs nothing (the test of this file runs the test steps).
// `MNEMA_BASE` names the ref to compare with, for a clone whose remotes are named otherwise.
import { spawnSync } from 'node:child_process';

/** @param {...string} args */
const git = (...args) => spawnSync('git', args, { encoding: 'utf-8' });
const out = (/** @type {ReturnType<typeof git>} */ r) => String(r.stdout).trim();

const refs = process.env.MNEMA_BASE
  ? [process.env.MNEMA_BASE]
  : ['refs/remotes/upstream/main', 'refs/remotes/origin/main'];
const ref = refs.find((r) => git('rev-parse', '--verify', '--quiet', r).status === 0);

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

const changed = [
  ...out(git('diff', '--name-only', base)).split('\n'),
  ...out(git('ls-files', '--others', '--exclude-standard')).split('\n'),
].filter((file) => file !== '');
const pythonChanged = changed.some((file) => /^packages\/chain\/verifier\/.*\.py$/.test(file));

const slow = ['--maxWorkers=1', '--testTimeout=30000'];
/** @type {Array<[string, string, string[]]>} */
const steps = [
  ['lint', 'pnpm', ['lint']],
  ['build', 'pnpm', ['build']],
  ['typecheck', 'pnpm', ['typecheck']],
  ['guards', 'pnpm', ['exec', 'vitest', 'run', '--config', 'vitest.guards.config.ts', ...slow]],
  [
    `tests tied to the files changed since ${base.slice(0, 8)} (@mnema/* read from source, so a change in a package reaches the tests that import it)`,
    'pnpm',
    [
      'exec',
      'vitest',
      'run',
      '--config',
      'vitest.contribution.config.ts',
      '--changed',
      base,
      ...slow,
      '--passWithNoTests',
    ],
  ],
];
if (pythonChanged) {
  const reader = 'packages/chain/verifier/mnema_verify.py';
  steps.push(['second reader: self-test', 'python3', [reader, 'self-test']]);
  steps.push(['second reader: vectors', 'python3', [reader, 'vectors']]);
}

if (process.argv.includes('--plan')) {
  console.log(JSON.stringify(steps));
  process.exit(0);
}

const ran = [];
for (const [name, command, args] of steps) {
  console.log(`\n== ${name}: ${[command, ...args].join(' ')}`);
  const result = spawnSync(command, args, { stdio: 'inherit' });
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
