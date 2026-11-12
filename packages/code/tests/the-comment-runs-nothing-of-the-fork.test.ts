// @reads-the-tree
/**
 * THE COMMENT RUNS NOTHING OF THE FORK. `.github/workflows/what-failed.yml` starts when CI completes
 * for a pull request and can write on pull requests; the report it reads was written by the pull
 * request's own run. That is the shape GitHub Security Lab names a "pwn request" when it goes wrong:
 * a privileged workflow that checks out or executes what the pull request brought. This reads the
 * workflow files and holds the lines that keep it from going wrong:
 *
 *   - every workflow started by `workflow_run` is started by nothing else, holds no permission at the
 *     top, and its jobs hold at most `actions: read`, `contents: read` and `pull-requests: write`;
 *   - a checkout in it names no `ref` and no `repository` (so it is this repository's default
 *     branch) and keeps no credential;
 *   - its only shell line runs `.github/what-failed/comment.mjs` on the event file and the report,
 *     with no `${{ }}` in it: nothing is installed, no package script runs, no text of the event is
 *     pasted into a shell;
 *   - the report is downloaded outside the workspace, and `comment.mjs` reads it with `JSON.parse`
 *     through `readReport` and runs no code: no `eval`, no `Function`, no dynamic `import`, and its
 *     only child process is `gh`;
 *   - every third-party action in it is pinned by a commit SHA;
 *   - the CI job that writes the report holds only read permissions and waits for every other job.
 *
 * WHAT IT DOES NOT SAY. It reads the YAML as lines, the way every guard of the workflows here does,
 * not with a YAML parser: a workflow written in a shape these readers do not know (flow mappings, a
 * `uses:` built by an anchor) is not read, and the last case is what shows the readers see the
 * shapes the files use. That the comment is safe against a hostile report is
 * `the-pull-request-is-told-what-failed.test.ts`, which hands the builder one.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));

const WORKFLOWS: readonly string[] = execFileSync(
  'git',
  ['ls-files', '--cached', '--others', '--exclude-standard', '.github/workflows'],
  { cwd: ROOT, encoding: 'utf-8' },
)
  .split('\n')
  .filter((where) => /\.ya?ml$/.test(where));

const text = (where: string): string => readFileSync(join(ROOT, where), 'utf-8');

/** The text without its comment lines, so a sentence about a key is not the key. */
const code = (all: string): string =>
  all
    .split('\n')
    .filter((line) => !/^\s*#/.test(line))
    .join('\n');

/** The lines under a top-level key, up to the next top-level key. */
function topBlock(all: string, key: string): string {
  const lines = code(all).split('\n');
  const from = lines.findIndex((line) => line.startsWith(`${key}:`));
  if (from === -1) return '';
  const rest = lines.slice(from + 1);
  const end = rest.findIndex((line) => /^\S/.test(line));
  return [lines[from], ...(end === -1 ? rest : rest.slice(0, end))].join('\n');
}

/** Each job of the file, by its id, as the lines from its header to the next job's. */
function jobsOf(all: string): Map<string, string> {
  const block = topBlock(all, 'jobs').split('\n').slice(1);
  const jobs = new Map<string, string>();
  let id = '';
  for (const line of block) {
    const header = /^ {2}([A-Za-z0-9_-]+):\s*$/.exec(line);
    if (header?.[1] !== undefined) {
      id = header[1];
      jobs.set(id, '');
    } else if (id !== '') {
      jobs.set(id, `${jobs.get(id)}${line}\n`);
    }
  }
  return jobs;
}

/** The steps of a job, each as its own lines. */
const stepsOf = (job: string): string[] => job.split(/\n(?= {6}- )/).slice(1);

/** `permissions:` of a job (4 spaces) or of the file (0), as `scope: level`; `{}` is an empty map. */
function permissionsOf(block: string, indent: number): Map<string, string> | null {
  const lines = block.split('\n');
  const at = lines.findIndex((line) => new RegExp(`^ {${indent}}permissions:`).test(line));
  if (at === -1) return null;
  const head = lines[at] ?? '';
  const found = new Map<string, string>();
  if (/permissions:\s*\{\}\s*$/.test(head)) return found;
  for (const line of lines.slice(at + 1)) {
    const entry = new RegExp(`^ {${indent + 2}}([a-z-]+):\\s*([a-z]+)\\s*$`).exec(line);
    if (entry?.[1] === undefined || entry[2] === undefined) break;
    found.set(entry[1], entry[2]);
  }
  return found;
}

/** Every shell line of a step: a `run:` on one line, or the lines under `run: |` / `run: >-`. */
function runOf(step: string): string[] {
  const lines = step.split('\n');
  const at = lines.findIndex((line) => /^\s*(?:-\s+)?run:/.test(line));
  if (at === -1) return [];
  const head = lines[at] ?? '';
  const inline = head.replace(/^\s*(?:-\s+)?run:\s*/, '');
  if (!/^[|>]-?\s*$/.test(inline)) return [inline];
  const indent = head.search(/\S/);
  const body: string[] = [];
  for (const line of lines.slice(at + 1)) {
    if (line.trim() !== '' && line.search(/\S/) <= indent) break;
    if (line.trim() !== '') body.push(line.trim());
  }
  return body;
}

const ALLOWED = new Map([
  ['actions', 'read'],
  ['contents', 'read'],
  ['pull-requests', 'write'],
]);
const THE_ONE_RUN = 'node .github/what-failed/comment.mjs "$GITHUB_EVENT_PATH" "$REPORT"';
const PINNED = /^\s*(?:-\s+)?uses:\s*[\w.-]+\/[\w./-]+@[0-9a-f]{40}\s+# v\d+\.\d+\.\d+\s*$/;

/** Every line of a workflow started by `workflow_run` that breaks the rules above, as `file: why`. */
function offences(where: string, all: string): string[] {
  const found: string[] = [];
  const say = (why: string) => found.push(`${where}: ${why}`);
  const on = topBlock(all, 'on');
  const triggers = on
    .split('\n')
    .slice(1)
    .map((line) => /^ {2}([a-z_]+):/.exec(line)?.[1])
    .filter((one): one is string => one !== undefined);
  if (triggers.join(',') !== 'workflow_run') say(`started by ${triggers.join(', ')}`);
  if (/\bsecrets\b/.test(code(all))) say('names a secret');

  const top = permissionsOf(code(all), 0);
  if (top === null || top.size > 0) say('the file holds a permission of its own');

  for (const [id, job] of jobsOf(all)) {
    const granted = permissionsOf(job, 4);
    if (granted === null) say(`job ${id} does not say its permissions`);
    for (const [scope, level] of granted ?? []) {
      if (ALLOWED.get(scope) !== level) say(`job ${id} holds ${scope}: ${level}`);
    }
    for (const step of stepsOf(job)) {
      const uses = step.split('\n').find((line) => /^\s*(?:-\s+)?uses:/.test(line));
      if (uses !== undefined && !PINNED.test(uses)) say(`an action not pinned: ${uses.trim()}`);
      if (uses !== undefined && /actions\/checkout@/.test(uses)) {
        if (/^\s+(?:ref|repository):/m.test(step)) say(`job ${id} checks out something else`);
        if (!/^\s+persist-credentials:\s*false\s*$/m.test(step)) {
          say(`job ${id} keeps the checkout's credential`);
        }
      }
      if (uses !== undefined && /actions\/download-artifact@/.test(uses)) {
        const path = /^\s+path:\s*(.+)$/m.exec(step)?.[1] ?? '';
        if (!path.startsWith(`\${{ runner.temp }}/`)) say(`job ${id} downloads into the workspace`);
      }
      for (const line of runOf(step)) {
        if (line !== THE_ONE_RUN) say(`job ${id} runs ${line}`);
      }
    }
  }
  return found;
}

const STARTED_BY_A_RUN = WORKFLOWS.filter((where) =>
  /^ {2}workflow_run:/m.test(topBlock(text(where), 'on')),
);

describe('the workflow that comments runs nothing of the fork', () => {
  it('is the one workflow started by another run, and it breaks none of the lines', () => {
    expect(STARTED_BY_A_RUN).toEqual(['.github/workflows/what-failed.yml']);
    expect(STARTED_BY_A_RUN.flatMap((where) => offences(where, text(where)))).toEqual([]);
  });

  it('is started by CI completing, and only for a run that ended green or red', () => {
    const all = text('.github/workflows/what-failed.yml');
    expect(code(all)).toMatch(
      /^ {2}workflow_run:\n {4}workflows: \[CI\]\n {4}types: \[completed\]$/m,
    );
    // The name it waits for is the name CI has.
    expect(text('.github/workflows/ci.yml')).toMatch(/^name: CI$/m);
    expect(code(all)).toContain("github.event.workflow_run.event == 'pull_request'");
  });

  it('reads the report as data: a parse through readReport, no code run, only gh as a child', () => {
    const source = readFileSync(join(ROOT, '.github/what-failed/comment.mjs'), 'utf-8');
    expect(source).toContain("readReport(readFileSync(reportPath, 'utf-8'))");
    expect(source).toMatch(/JSON\.parse\(text\)/);
    expect(source).not.toMatch(/\beval\(|new Function\b|\bimport\(|\brequire\(/);
    const children = [...source.matchAll(/execFileSync\(\s*'([^']+)'/g)].map((m) => m[1]);
    expect(children).toEqual(['gh']);
    expect(source).not.toMatch(/\bexecSync\(|\bspawn(?:Sync)?\(|\bexec\(/);
  });
});

describe('the CI job that writes the report', () => {
  const ci = text('.github/workflows/ci.yml');
  const jobs = jobsOf(ci);
  const job = jobs.get('what-failed') ?? '';

  it('holds only read permissions and runs on pull requests only', () => {
    expect(job, 'ci.yml has no job what-failed').not.toBe('');
    expect([...(permissionsOf(job, 4) ?? new Map())]).toEqual([
      ['actions', 'read'],
      ['contents', 'read'],
    ]);
    expect(job).toContain("github.event_name == 'pull_request'");
    expect(job).not.toMatch(/\bsecrets\b/);
  });

  it('waits for every other job of the file, so the report is written after all of them', () => {
    const needs = [...job.matchAll(/^ {6}- ([a-z0-9-]+)$/gm)].map((m) => m[1]);
    const others = [...jobs.keys()].filter((id) => id !== 'what-failed');
    expect(new Set(needs)).toEqual(new Set(others));
    expect(others.length).toBeGreaterThan(5);
  });
});

describe('the readers see the defect they exist for', () => {
  const good = text('.github/workflows/what-failed.yml');

  it('refuses a checkout of the head, a write it does not need, a second trigger and a pasted expression', () => {
    const headRef = good.replace(
      '          persist-credentials: false\n          sparse-checkout',
      `          ref: \${{ github.event.workflow_run.head_sha }}\n          persist-credentials: false\n          sparse-checkout`,
    );
    expect(offences('x.yml', headRef)).toEqual(['x.yml: job comment checks out something else']);

    const contents = good.replace('      contents: read\n', '      contents: write\n');
    expect(offences('x.yml', contents)).toEqual(['x.yml: job comment holds contents: write']);

    const second = good.replace('on:\n', 'on:\n  pull_request:\n    branches: [main]\n');
    expect(offences('x.yml', second)).toEqual(['x.yml: started by pull_request, workflow_run']);

    const pasted = good.replace(
      `run: ${THE_ONE_RUN}`,
      `run: echo "\${{ github.event.workflow_run.head_branch }}"`,
    );
    expect(offences('x.yml', pasted)).toEqual([
      `x.yml: job comment runs echo "\${{ github.event.workflow_run.head_branch }}"`,
    ]);

    const installs = good.replace(
      `run: ${THE_ONE_RUN}`,
      `run: |\n          pnpm install\n          ${THE_ONE_RUN}`,
    );
    expect(offences('x.yml', installs)).toEqual(['x.yml: job comment runs pnpm install']);

    const inWorkspace = good.replace(`path: \${{ runner.temp }}/what-failed`, 'path: what-failed');
    expect(offences('x.yml', inWorkspace)).toEqual([
      'x.yml: job comment downloads into the workspace',
    ]);

    const tag = good.replace(
      /actions\/setup-node@[0-9a-f]{40} # v\d+\.\d+\.\d+/,
      'actions/setup-node@v7',
    );
    expect(offences('x.yml', tag)).toEqual([
      'x.yml: an action not pinned: - uses: actions/setup-node@v7',
    ]);
  });
});
