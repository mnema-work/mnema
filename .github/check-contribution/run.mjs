// THE CHECK BEFORE A PULL REQUEST: `pnpm check:contribution`. Lint, build, typecheck, the guards that
// read the whole tree, and only the tests tied to the files this branch changed against its merge
// base with origin/main. It is a subset of CI, on purpose: one worker and a long test timeout, so it
// finishes in a small sandbox, and both are set here and in no workflow. CI runs the whole suite.
import { spawnSync } from 'node:child_process';

/** @param {...string} args */
const git = (...args) => spawnSync('git', args, { encoding: 'utf-8' });

if (git('rev-parse', '--verify', '--quiet', 'refs/remotes/origin/main').status !== 0) {
  console.error(
    'origin/main is not fetched here, and the changed tests are chosen against it.\n' +
      'Fetch it, then run this again:\n\n  git fetch origin main\n',
  );
  process.exit(1);
}

const base = String(git('merge-base', 'origin/main', 'HEAD').stdout).trim();
if (base === '') {
  console.error('HEAD shares no history with origin/main. Fetch it in full: git fetch origin main');
  process.exit(1);
}

const slow = ['--maxWorkers=1', '--testTimeout=30000'];
/** @type {Array<[string, string, string[]]>} */
const steps = [
  ['lint', 'pnpm', ['lint']],
  ['build', 'pnpm', ['build']],
  ['typecheck', 'pnpm', ['typecheck']],
  ['guards', 'pnpm', ['test:guards', ...slow]],
  [
    `tests related to the files changed since ${base.slice(0, 8)}`,
    'pnpm',
    ['exec', 'vitest', 'run', '--changed', base, ...slow, '--passWithNoTests'],
  ],
];

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

console.log(`\nRan: ${ran.join(', ')}.`);
console.log(
  'This is a subset. CI runs the whole suite on Node 24.15.0, 24 and 26, and is the check that counts.',
);
