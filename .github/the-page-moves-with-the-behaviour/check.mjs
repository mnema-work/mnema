// THE PAGE MOVES WITH THE BEHAVIOUR: a pull request that changes a golden of the surface (what a
// person sees of the program) changes a page written by hand and adds a changelog entry as well.
//
// `whatIsMissing` is pure, over the list of the files a pull request changes (added, modified,
// deleted, and both names of a rename). Run as a command it reads that list from git:
//
//   node .github/the-page-moves-with-the-behaviour/check.mjs <base>
//
// compares the working tree with the merge base of <base> and HEAD, and exits 1 saying the goldens
// that moved and what is missing. `MNEMA_CHANGED` (newline-separated paths) stands for the list,
// for the test. There is no way to say in the text of a pull request that it needs none: the list
// of files is the only input, and the pages that count are fixed here.
//
// WHAT COUNTS AS A PAGE: `docs/**/*.md` outside `docs/reference/`, the README of the package the
// golden lives in, and `plugin/README.md`. The pages of `docs/reference/cli/` are
// generated from the help golden and change every time it does, so counting them would make the check
// pass always; `docs/reference/` as a whole stays out (`mcp/` comes from the server's `tools/list`).
// TWO SLACKS, since only names are read: a deleted page counts as a page, and a changed old
// changelog entry counts as an entry. WHAT IT DOES NOT SAY: that the page says the right
// thing, or that the entry describes the change; it holds that a person had to touch both.
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

/** The goldens of the surface: the program's help and transcripts, its completions, its init screens. */
export const SURFACE_GOLDENS = [
  'packages/code/src/cli.help.golden.txt',
  'packages/code/src/cli.reads.golden.txt',
  'packages/code/src/cli.writes.golden.txt',
  'packages/code/tests/completion.bash.golden.txt',
  'packages/code/tests/completion.fish.golden.txt',
  'packages/code/tests/completion.zsh.golden.txt',
  'packages/code/tests/the-init-draws-its-frames.golden.txt',
];

/** A golden that is not the surface, with why: a measurement of what the model reads, not a screen. */
export const NOT_SURFACE_GOLDENS = {
  'packages/code/tests/the-channels-have-a-budget.golden.txt':
    'sizes in bytes and tokens of what an agent is handed, measured over a fixture',
};

/** @param {string} file */
const isChangelogEntry = (file) =>
  /^changelog\/unreleased\/[^/]+\.md$/.test(file) && !file.endsWith('/README.md');

/**
 * Whether a file is a page written by hand that the golden's package answers to.
 *
 * @param {string} file
 * @param {string} golden
 */
function isHandWrittenPageFor(file, golden) {
  if (file.startsWith('docs/reference/')) return false;
  if (/^docs\/.+\.md$/.test(file)) return true;
  if (file === 'plugin/README.md') return true;
  const pkg = /^packages\/([^/]+)\//.exec(golden)?.[1];
  return pkg !== undefined && file === `packages/${pkg}/README.md`;
}

/**
 * What a pull request that changes these files still owes.
 *
 * @param {readonly string[]} files
 * @returns {{ goldens: string[], page: boolean, entry: boolean }} `page` and `entry` say what is
 *   missing, and are false when no golden moved.
 */
export function whatIsMissing(files) {
  const goldens = SURFACE_GOLDENS.filter((golden) => files.includes(golden));
  if (goldens.length === 0) return { goldens, page: false, entry: false };
  const page = !goldens.every((golden) => files.some((file) => isHandWrittenPageFor(file, golden)));
  return { goldens, page, entry: !files.some(isChangelogEntry) };
}

/**
 * The sentence that names the goldens and what is missing, or '' when nothing is.
 *
 * @param {{ goldens: string[], page: boolean, entry: boolean }} what
 */
export function say({ goldens, page, entry }) {
  if (!page && !entry) return '';
  const missing = [];
  if (page) {
    missing.push(
      "a page written by hand (docs/**/*.md outside docs/reference/, the README of the golden's package, or plugin/README.md; the generated pages of docs/reference/ do not count)",
    );
  }
  if (entry) missing.push('an entry in changelog/unreleased/ (one .md file)');
  return `This pull request changes ${goldens.join(', ')}, which is what a person sees of the program, and it lacks ${missing.join(' and ')}.`;
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  /** @param {...string} args */
  const git = (...args) => spawnSync('git', args, { encoding: 'utf-8' });
  let files;
  if (process.env.MNEMA_CHANGED !== undefined) {
    files = process.env.MNEMA_CHANGED.split('\n');
  } else {
    const base = process.argv[2];
    if (base === undefined) {
      console.error(
        'Usage: node check.mjs <base>: the commit or ref the pull request is compared with.',
      );
      process.exit(2);
    }
    const diff = git('diff', '--name-only', '--no-renames', `${base}...HEAD`);
    if (diff.status !== 0) {
      console.error(`git diff ${base}...HEAD failed: ${String(diff.stderr).trim()}`);
      process.exit(2);
    }
    files = diff.stdout.split('\n');
    // The files of a checkout not yet committed: the check before a push reads them too.
    files.push(...git('diff', '--name-only', '--no-renames', 'HEAD').stdout.split('\n'));
    files.push(...git('ls-files', '--others', '--exclude-standard').stdout.split('\n'));
  }
  const sentence = say(whatIsMissing(files.filter((file) => file !== '')));
  if (sentence !== '') {
    console.error(sentence);
    process.exit(1);
  }
  console.log('The page moves with the behaviour: nothing owed.');
}
