// WHAT A PULL REQUEST PAYS FOR. `ci.yml` and `host-contract.yml` start with a job named `changes`
// that hands this script the list of files the pull request changes and writes two answers to the
// job's outputs:
//
//   code  false only for a pull request that changes nothing but Markdown pages under `docs/` and
//         `changelog/` that no test names. A page a test reads is something the pull request
//         touches, so the test files themselves are read at run time (`namedIn`): a page whose
//         path or file name appears in any test or support file, and every page under `changelog/`
//         while a test names that folder, counts as code. The guards that sweep every page
//         (`the-guards`) are a job of their own and always run, and the whole suite runs on every
//         push to the trunk.
//   host  false for a pull request that touches nothing the host contract runs: the plugin, the
//         source of the packages the binary is built from, what the contract and its harness
//         read, and the two workflows. Then the seven host jobs skip their steps.
//
// A SKIP IS A STEP THAT DOES NOT RUN, NOT A JOB THAT DOES NOT START. The branch requires each job by
// the name it publishes, and a matrix job skipped as a whole publishes the name unexpanded
// (`test (node ${{ matrix.node }}, ...)`), which is never the name required: the merge would wait
// for ever. So every job still starts, publishes its name, and ends green having run nothing.
//
// FAIL TOWARDS RUNNING. Anything that is not a pull request, an empty list, or a list that could
// not be read answers true for both.

import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** A page the test matrix does not need to run for. */
const A_PAGE = /^(?:docs|changelog)\/.*\.md$/;

/**
 * What the host contract runs or reads, by path. Tests that sit beside the source
 * (`*.test.ts`) are not it: the contract starts the built binary, not the suite.
 */
const THE_HOST_CONTRACT_READS = [
  /^plugin\//,
  /^\.claude-plugin\//,
  /^packages\/(?:code|core|chain|context)\/src\/(?!.*\.test\.ts$)/,
  /^packages\/(?:code|core|chain|context)\/package\.json$/,
  /^packages\/code\/tests\/host-contract\//,
  /^packages\/code\/tests\/support\//,
  /^packages\/code\/build\//,
  /^docs\/rule-arrival\.md$/,
  /^\.github\/instructions\//,
  /^\.github\/workflows\/host-contract\.yml$/,
  /^vitest\.host-contract\.config\.ts$/,
  /^(?:package\.json|pnpm-lock\.yaml|pnpm-workspace\.yaml|tsconfig[^/]*\.json)$/,
];

/**
 * The text of every test file and support file of the checkout at `root`.
 * @param {string} root
 * @returns {string}
 */
export function corpusOf(root) {
  const tracked = execFileSync(
    'git',
    ['ls-files', '-z', '--', 'packages/*.test.ts', 'packages/*/tests/*'],
    { cwd: root, encoding: 'utf-8', maxBuffer: 64 * 1024 * 1024 },
  )
    .split('\0')
    .filter((file) => file.endsWith('.ts') || file.endsWith('.mjs'));
  return tracked.map((file) => readFileSync(join(root, file), 'utf-8')).join('\n');
}

/**
 * Whether a page is named by the tests, by what the tests say, text of every test and support file.
 * Over-reading is the safe side: a mention in a comment makes the page count as read.
 * @param {string} corpus the text of every test file and support file
 * @returns {(page: string) => boolean}
 */
export function namedIn(corpus) {
  const folderRead = /['"`/]changelog['"`/]/.test(corpus);
  return (page) =>
    page.startsWith('changelog/')
      ? folderRead
      : corpus.includes(page) || corpus.includes(page.slice(page.lastIndexOf('/') + 1));
}

/**
 * @param {readonly string[]} files the paths the pull request changes
 * @param {string} event the name of the event that started the run
 * @param {(page: string) => boolean} [readByATest] without it every page counts as read
 * @returns {{ code: boolean, host: boolean }}
 */
export function decide(files, event, readByATest = () => true) {
  if (event !== 'pull_request' || files.length === 0) return { code: true, host: true };
  return {
    code: !files.every((file) => A_PAGE.test(file) && !readByATest(file)),
    host: files.some((file) => THE_HOST_CONTRACT_READS.some((reads) => reads.test(file))),
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  /** @type {string[]} */
  let files = [];
  try {
    files = readFileSync(0, 'utf-8').split('\n').filter(Boolean);
  } catch {
    files = [];
  }
  const corpus = corpusOf(process.cwd());
  const answer = decide(files, process.env.GITHUB_EVENT_NAME ?? '', namedIn(corpus));
  const text = `code=${answer.code}\nhost=${answer.host}\n`;
  process.stdout.write(text);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, text);
}
