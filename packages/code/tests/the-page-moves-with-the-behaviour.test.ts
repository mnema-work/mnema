// @reads-the-tree
/**
 * THE PAGE MOVES WITH THE BEHAVIOUR: a golden of the surface that changes takes a page written by
 * hand and a changelog entry with it, and the pages generated from the golden do not count.
 *
 * `.github/the-page-moves-with-the-behaviour/check.mjs` is pure over the list of changed files, so
 * these cases hand it lists. The case that matters is the one a generated page alone does not
 * satisfy: `docs/reference/cli/` changes every time `cli.help.golden.txt` does, and counting it would
 * make the check pass always. The command is run on `MNEMA_CHANGED` for the exit code and the
 * words, and the last cases read the tree: every golden file is either a golden of the surface or
 * named as not one with a reason, and the job in `ci.yml` is a pull request job that is not a
 * required check and that `what failed` waits for.
 */

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  NOT_SURFACE_GOLDENS,
  SURFACE_GOLDENS,
  say,
  whatIsMissing,
} from '../../../.github/the-page-moves-with-the-behaviour/check.mjs';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const CHECK = '.github/the-page-moves-with-the-behaviour/check.mjs';
const HELP = 'packages/code/src/cli.help.golden.txt';
const GENERATED = 'docs/reference/cli/brief.md';
const PAGE = 'docs/guides/brief.md';
const ENTRY = 'changelog/unreleased/the-brief-says-more.md';

const run = (files: string[]) =>
  spawnSync('node', [join(ROOT, CHECK)], {
    cwd: ROOT,
    encoding: 'utf-8',
    env: { ...process.env, MNEMA_CHANGED: files.join('\n') },
  });

describe('the page moves with the behaviour', () => {
  it('owes nothing when no golden of the surface moved', () => {
    expect(whatIsMissing(['packages/code/src/cli.ts', 'docs/install.md'])).toEqual({
      goldens: [],
      page: false,
      entry: false,
    });
    expect(whatIsMissing([])).toEqual({ goldens: [], page: false, entry: false });
  });

  it('owes both when the help changed with only its generated page', () => {
    expect(whatIsMissing([HELP, GENERATED, 'docs/reference/commands.md'])).toEqual({
      goldens: [HELP],
      page: true,
      entry: true,
    });
  });

  it('owes the entry when there is a page, and the page when there is an entry', () => {
    expect(whatIsMissing([HELP, GENERATED, PAGE])).toMatchObject({ page: false, entry: true });
    expect(whatIsMissing([HELP, GENERATED, ENTRY])).toMatchObject({ page: true, entry: false });
  });

  it('is satisfied by a page, the package README or plugin/README.md, with an entry', () => {
    for (const page of [PAGE, 'packages/code/README.md', 'plugin/README.md']) {
      expect(whatIsMissing([HELP, GENERATED, page, ENTRY]), page).toEqual({
        goldens: [HELP],
        page: false,
        entry: false,
      });
    }
  });

  it('counts neither a README of another package nor the folder of the entries', () => {
    expect(
      whatIsMissing([HELP, 'packages/core/README.md', 'changelog/unreleased/.gitkeep']),
    ).toEqual({ goldens: [HELP], page: true, entry: true });
    expect(whatIsMissing([HELP, 'docs/reference/mcp-tools.md', ENTRY])).toMatchObject({
      page: true,
    });
  });

  it('sees a golden that was deleted or born, and every one that moved', () => {
    // A delete and an add are both the name in the list; two goldens need a page for each package.
    const both = [HELP, 'packages/code/tests/completion.zsh.golden.txt', PAGE, ENTRY];
    expect(whatIsMissing(both).goldens).toEqual([
      HELP,
      'packages/code/tests/completion.zsh.golden.txt',
    ]);
  });

  it('names the golden and what is missing, and exits 1', () => {
    const red = run([HELP, GENERATED]);
    expect(red.status).toBe(1);
    expect(red.stderr).toContain(HELP);
    expect(red.stderr).toContain('a page written by hand');
    expect(red.stderr).toContain('changelog/unreleased/');
    const half = run([HELP, GENERATED, ENTRY]);
    expect(half.status).toBe(1);
    expect(half.stderr).toContain('a page written by hand');
    expect(half.stderr).not.toContain('an entry in changelog');
    expect(say(whatIsMissing([HELP, PAGE, ENTRY]))).toBe('');
  });

  it('is green with both, and with no golden', () => {
    expect(run([HELP, GENERATED, PAGE, ENTRY]).status).toBe(0);
    expect(run(['packages/code/src/cli.ts']).status).toBe(0);
  });

  it('classifies every golden file of the tree', () => {
    const tracked = spawnSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], {
      cwd: ROOT,
      encoding: 'utf-8',
    })
      .stdout.split('\n')
      .filter((file) => /\.golden\.txt$/.test(file));
    const known = new Set([...SURFACE_GOLDENS, ...Object.keys(NOT_SURFACE_GOLDENS)]);
    expect(tracked.filter((file) => !known.has(file))).toEqual([]);
    expect([...known].filter((file) => !tracked.includes(file))).toEqual([]);
    expect(Object.values(NOT_SURFACE_GOLDENS).every((why) => why.length > 0)).toBe(true);
  });

  it('is a job of pull requests that waits for no one and that the comment waits for', () => {
    const ci = readFileSync(join(ROOT, '.github/workflows/ci.yml'), 'utf-8');
    const job = /^ {2}the-page-moves-with-the-behaviour:\n([\s\S]*?)(?=^ {2}\S|\n {2}# )/m.exec(
      ci,
    )?.[1];
    expect(job).toBeDefined();
    expect(job).toMatch(/if: \$\{\{ github\.event_name == 'pull_request' \}\}/);
    expect(job).toContain('node .github/the-page-moves-with-the-behaviour/check.mjs');
    expect(job).not.toMatch(/continue-on-error|workflow_dispatch/);
    const needs = /^ {2}what-failed:[\s\S]*?needs:\n((?: {6}- .*\n)+)/m.exec(ci)?.[1] ?? '';
    expect(needs).toContain('- the-page-moves-with-the-behaviour');
  });
});
