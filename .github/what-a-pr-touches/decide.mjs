// WHAT A PULL REQUEST PAYS FOR. `ci.yml` and `host-contract.yml` start with a job named `changes`
// that hands this script the list of files the pull request changes and writes two answers to the
// job's outputs:
//
//   code  false only for a pull request that changes nothing but Markdown pages under `docs/` and
//         `changelog/`. Then the test matrix and the coverage gate skip their steps. The guards
//         that read every page (`the-guards`) are a job of their own and always run, and the whole
//         suite runs on every push to the trunk.
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

import { appendFileSync } from 'node:fs';

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
 * @param {readonly string[]} files the paths the pull request changes
 * @param {string} event the name of the event that started the run
 * @returns {{ code: boolean, host: boolean }}
 */
export function decide(files, event) {
  if (event !== 'pull_request' || files.length === 0) return { code: true, host: true };
  return {
    code: !files.every((file) => A_PAGE.test(file)),
    host: files.some((file) => THE_HOST_CONTRACT_READS.some((reads) => reads.test(file))),
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { readFileSync } = await import('node:fs');
  /** @type {string[]} */
  let files = [];
  try {
    files = readFileSync(0, 'utf-8').split('\n').filter(Boolean);
  } catch {
    files = [];
  }
  const answer = decide(files, process.env.GITHUB_EVENT_NAME ?? '');
  const text = `code=${answer.code}\nhost=${answer.host}\n`;
  process.stdout.write(text);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, text);
}
