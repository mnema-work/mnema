/**
 * A PULL REQUEST PAYS ONLY FOR WHAT IT TOUCHES, AND A RUNNER THE POOL TOOK AWAY IS RERUN ONCE.
 *
 * Three things, each held at its own seam. `decide` says which of the test matrix and the host
 * contract a list of changed files needs; `jobsToRerun` says which cancelled jobs of a finished run
 * were the runner's loss; and the two workflows are read to see that a job which skips does it by
 * skipping every STEP and never the job, because the branch requires each job by the name it
 * publishes and a matrix job skipped whole publishes the name unexpanded.
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { jobsToRerun } from '../../../.github/rerun-a-cancelled-runner/select.mjs';
import { corpusOf, decide, namedIn } from '../../../.github/what-a-pr-touches/decide.mjs';

const read = (path: string): string =>
  readFileSync(fileURLToPath(new URL(`../../../${path}`, import.meta.url)), 'utf-8');

describe('decide', () => {
  it('skips the test matrix for a pull request of pages under docs/ and changelog/ alone', () => {
    expect(
      decide(['docs/install.md', 'changelog/unreleased/a.md'], 'pull_request', () => false).code,
    ).toBe(false);
  });

  it('runs the test matrix as soon as one file is not such a page', () => {
    expect(decide(['docs/install.md', 'docs/a.json'], 'pull_request').code).toBe(true);
    expect(decide(['docs/install.md', 'README.md'], 'pull_request').code).toBe(true);
    expect(decide(['packages/code/src/cli.ts'], 'pull_request').code).toBe(true);
  });

  it('runs the host contract for what it starts, and not for pages or for other packages', () => {
    for (const file of [
      'plugin/hooks/session-start.mjs',
      'packages/code/src/mcp/instructions.ts',
      'packages/core/src/index.ts',
      'packages/code/tests/host-contract/the-shell-goes-round.test.ts',
      '.github/workflows/host-contract.yml',
    ]) {
      expect(decide([file], 'pull_request').host, file).toBe(true);
    }
    for (const file of [
      'docs/install.md',
      'CHANGELOG.md',
      'packages/vscode/src/extension.ts',
      'packages/code/src/cli.test.ts',
      '.github/workflows/ci.yml',
    ]) {
      expect(decide([file], 'pull_request').host, file).toBe(false);
    }
  });

  it('runs everything for a push, for a run on a schedule and for a list nobody could read', () => {
    expect(decide(['docs/install.md'], 'push')).toEqual({ code: true, host: true });
    expect(decide(['docs/install.md'], 'schedule')).toEqual({ code: true, host: true });
    expect(decide([], 'pull_request')).toEqual({ code: true, host: true });
  });
});

describe('jobsToRerun', () => {
  const lost = {
    id: 1,
    name: 'windows and macos (macos-latest, node 24)',
    conclusion: 'cancelled',
    steps: [],
  };
  const base = { attempt: 1, runId: 9, newestRunId: 9 };

  it('reruns a cancelled job of windows and macos that ran no step of ours', () => {
    const cancelledAtCheckout = {
      ...lost,
      id: 2,
      steps: [
        { name: 'Set up job', conclusion: 'success' },
        { name: 'Run actions/checkout@abc', conclusion: 'cancelled' },
        { name: 'Build', conclusion: 'skipped' },
        { name: 'Complete job', conclusion: 'success' },
      ],
    };
    expect(jobsToRerun({ ...base, jobs: [lost, cancelledAtCheckout] })).toEqual([1, 2]);
  });

  it('never reruns a job whose own step ran to a result', () => {
    const ran = {
      ...lost,
      steps: [
        { name: 'Set up job', conclusion: 'success' },
        { name: 'Install dependencies', conclusion: 'success' },
      ],
    };
    expect(jobsToRerun({ ...base, jobs: [ran] })).toEqual([]);
  });

  it('never reruns a failure, a second attempt or a run that is no longer the newest', () => {
    expect(jobsToRerun({ ...base, jobs: [{ ...lost, conclusion: 'failure' }] })).toEqual([]);
    expect(jobsToRerun({ ...base, attempt: 2, jobs: [lost] })).toEqual([]);
    expect(jobsToRerun({ ...base, newestRunId: 10, jobs: [lost] })).toEqual([]);
  });

  it('leaves a run alone in which another kind of job was cancelled: a newer push did it', () => {
    const other = { id: 3, name: 'test (node 24, shard 1/3)', conclusion: 'cancelled', steps: [] };
    expect(jobsToRerun({ ...base, jobs: [lost, other] })).toEqual([]);
  });
});

/** The steps of a job, each as the text of its block. */
function stepsOf(workflow: string, job: string): string[] {
  const body = workflow.split(new RegExp(`^  ${job}:\\n`, 'm'))[1]?.split(/^ {2}[a-z0-9-]+:\n/m)[0];
  const steps = (body ?? '').split(/^ {4}steps:\n/m)[1] ?? '';
  return steps.split(/^ {6}- /m).slice(1);
}

describe('the workflows skip by step, never by job', () => {
  const ci = read('.github/workflows/ci.yml');
  const hosts = read('.github/workflows/host-contract.yml');

  it('gives every step of the test cells and of the coverage gate the answer of `changes`', () => {
    for (const job of ['build', 'test', 'the-coverage-gate']) {
      const steps = stepsOf(ci, job);
      expect(steps.length, job).toBeGreaterThan(3);
      for (const step of steps)
        expect(step, `${job}: ${step.split('\n')[0]}`).toContain('needs.changes.outputs.code');
    }
  });

  it('gives every step of the seven host jobs the answer of `changes`', () => {
    for (const job of ['claude-code', 'vscode', 'codex', 'copilot', 'opencode', 'gemini', 'qwen']) {
      const steps = stepsOf(hosts, job);
      expect(steps.length, job).toBeGreaterThan(3);
      for (const step of steps)
        expect(step, `${job}: ${step.split('\n')[0]}`).toContain('needs.changes.outputs.host');
    }
  });

  it('never skips a required job as a whole, which would publish its name unexpanded', () => {
    for (const workflow of [ci, hosts]) {
      for (const block of workflow.split(/^ {2}[a-z0-9-]+:\n/m).slice(1)) {
        if (!/^ {4}strategy:/m.test(block)) continue;
        expect(block.split(/^ {4}steps:/m)[0]).not.toMatch(/^ {4}if:/m);
      }
    }
  });
});

describe('a page a test reads is something the pull request touches', () => {
  const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
  const readByATest = namedIn(corpusOf(ROOT));
  /** Built in parts, so that this file does not name it. */
  const UNNAMED = ['docs/zz', 'q.md'].join('-');

  it('runs the matrix for the pages tests read, found from the tests at run time', () => {
    for (const page of ['docs/rule-arrival.md', 'docs/evidence.md', 'docs/cli-reference.md']) {
      expect(decide([page], 'pull_request', readByATest).code, page).toBe(true);
    }
  });

  it('still skips it for a page no test names', () => {
    expect(decide([UNNAMED], 'pull_request', readByATest).code).toBe(false);
  });

  it('counts a changed page as read when it cannot tell', () => {
    expect(decide([UNNAMED], 'pull_request').code).toBe(true);
  });

  it('treats a changelog entry as read while a test names that folder', () => {
    expect(decide(['changelog/unreleased/a.md'], 'pull_request', readByATest).code).toBe(true);
    expect(namedIn('nothing here')('changelog/unreleased/a.md')).toBe(false);
  });
});

describe('a rename is read from both sides', () => {
  /** The command both workflows run, as written in them. */
  const command = /git diff (--name-only --no-renames) HEAD\^1 HEAD/;
  it('is the command of both workflows', () => {
    expect(read('.github/workflows/ci.yml')).toMatch(command);
    expect(read('.github/workflows/host-contract.yml')).toMatch(command);
  });

  /** A merge commit whose second parent renamed `from` to `to`; the files the workflows' diff lists. */
  function changedBy(from: string, to: string): string[] {
    const dir = mkdtempSync(join(tmpdir(), 'rename-'));
    const git = (...args: string[]) =>
      execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.com', ...args], {
        cwd: dir,
        encoding: 'utf-8',
        env: { PATH: process.env.PATH ?? '', HOME: dir, GIT_CONFIG_NOSYSTEM: '1' },
      });
    try {
      git('init', '-q', '-b', 'main');
      for (const path of [from]) {
        execFileSync('mkdir', ['-p', join(dir, path, '..')]);
        writeFileSync(join(dir, path), 'the same lines\n'.repeat(20));
      }
      git('add', '.');
      git('commit', '-qm', 'base');
      git('switch', '-qc', 'pr');
      execFileSync('mkdir', ['-p', join(dir, to, '..')]);
      git('mv', from, to);
      git('commit', '-qm', 'rename');
      git('switch', '-q', 'main');
      writeFileSync(join(dir, 'other.txt'), 'x');
      git('add', '.');
      git('commit', '-qm', 'moved on');
      git('merge', '-q', '--no-ff', '-m', 'merge', 'pr');
      return git('diff', '--name-only', '--no-renames', 'HEAD^1', 'HEAD')
        .split('\n')
        .filter(Boolean);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  it('runs the matrix for a file moved from code to a page', () => {
    const files = changedBy('packages/code/src/a.ts', 'docs/a-page-no-test-names.md');
    expect(files).toEqual(['docs/a-page-no-test-names.md', 'packages/code/src/a.ts']);
    expect(decide(files, 'pull_request', () => false).code).toBe(true);
  });

  it('runs the matrix for a page moved into code', () => {
    const files = changedBy('docs/a-page-no-test-names.md', 'packages/code/src/b.ts');
    expect(files).toEqual(['docs/a-page-no-test-names.md', 'packages/code/src/b.ts']);
    expect(decide(files, 'pull_request', () => false).code).toBe(true);
  });
});
