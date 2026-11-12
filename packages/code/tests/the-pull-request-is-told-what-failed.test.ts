/**
 * THE PULL REQUEST IS TOLD WHAT FAILED: the comment `.github/what-failed/` writes on a pull request
 * after CI, from a report the pull request's own run wrote.
 *
 * That report is made by code the pull request controls, so everything in it is a stranger's text
 * that our token will post. The cases below hand the reader and the builder the text an attacker
 * would write (a mention, HTML, a run of backticks that closes the fence, a field larger than the
 * limit, a field nobody asked for) and assert on the comment that comes out: every stranger's line
 * sits inside a fenced block that it cannot close, no `@` from the report can notify anyone, and the
 * one mention in the comment is the welcome's, built from the login the API gave.
 *
 * The seams are the reader (`readReport`), the builder (`buildComment`), the step that finds the pull
 * request and keeps one comment on it (`tell`, with the API handed in) and the collector the
 * pull request's run uses (`collect`). Nothing here talks to GitHub.
 */

import { describe, expect, it } from 'vitest';
import { collect, lintFailed } from '../../../.github/what-failed/collect.mjs';
import { buildComment, MARKER, readReport, tell } from '../../../.github/what-failed/comment.mjs';

const SHA = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678';
const RUN = 'https://github.com/mnema-work/mnema/actions/runs/42';
const REPO = 'mnema-work/mnema';

/** A report as the collector writes it, with nothing hostile in it. */
function plainReport(): Record<string, unknown> {
  return {
    version: 1,
    checks: [{ name: 'lint + build + test (node 24)', steps: ['Lint'] }],
    verdicts: [
      {
        cell: 'node24',
        verdict: 'SOMETHING TO READ',
        reds: [{ file: 'packages/code/tests/a.test.ts', name: 'a case', says: 'THE GUARD CAUGHT' }],
      },
    ],
    tests: [
      { file: 'packages/code/tests/a.test.ts', name: 'a case', message: 'expected 1 to be 2' },
    ],
    testsLeftOut: 0,
    lint: {
      files: ['packages/code/src/a.ts'],
      diff: '--- a/packages/code/src/a.ts\n+++ b/packages/code/src/a.ts\n-const a=1\n+const a = 1;\n',
      diffCut: false,
    },
  };
}

/**
 * THE TEXT OF A COMMENT OUTSIDE ITS FENCED BLOCKS, read with CommonMark's rule: a fence of N backticks
 * is closed only by a line of N or more backticks and nothing else. This is the part GitHub renders
 * as Markdown, so it is the part a stranger must never reach.
 */
function outsideFences(body: string): string {
  const out: string[] = [];
  let open = 0;
  for (const line of body.split('\n')) {
    if (open === 0) {
      const start = /^(`{3,})[^`]*$/.exec(line);
      if (start?.[1] !== undefined) {
        open = start[1].length;
        continue;
      }
      out.push(line);
    } else {
      const close = /^(`{3,})\s*$/.exec(line);
      if (close?.[1] !== undefined && close[1].length >= open) open = 0;
    }
  }
  expect(open, 'a fence was left open').toBe(0);
  return out.join('\n');
}

const read = (report: unknown) => readReport(JSON.stringify(report));

describe('the report is read as data', () => {
  it('reads the report the collector writes', () => {
    const got = read(plainReport());
    expect(got.ok).toBe(true);
  });

  it('refuses text that is not JSON, a report over the size limit, and a field it does not know', () => {
    expect(readReport('{"version": 1,')).toEqual({ ok: false, why: 'the report is not JSON' });
    expect(readReport(' '.repeat(300 * 1024))).toEqual({
      ok: false,
      why: 'the report is larger than 262144 bytes',
    });
    const extra = { ...plainReport(), '<b>@everyone</b>': 1 };
    const got = read(extra);
    expect(got.ok).toBe(false);
    // The reason is ours: the stranger's key is not repeated in it.
    expect(JSON.stringify(got)).not.toContain('everyone');
  });

  it('refuses a message over its limit, a path that climbs out, and a wrong version', () => {
    const long = plainReport();
    (long.tests as { message: string }[])[0] = {
      file: 'packages/code/tests/a.test.ts',
      name: 'a case',
      message: 'x'.repeat(2001),
    } as never;
    expect(read(long)).toEqual({ ok: false, why: 'the report does not have the expected shape' });

    const climbs = plainReport();
    (climbs.lint as { files: string[] }).files = ['../../etc/passwd'];
    expect(read(climbs).ok).toBe(false);

    const dashed = plainReport();
    (dashed.lint as { files: string[] }).files = ['--config-path=/tmp/x'];
    expect(read(dashed).ok).toBe(false);

    expect(read({ ...plainReport(), version: 2 }).ok).toBe(false);
  });
});

describe('the comment a stranger cannot write into', () => {
  const HOSTILE = {
    version: 1,
    checks: [{ name: 'lint @everyone <img src=x onerror=alert(1)>', steps: ['```\n# Pwned'] }],
    verdicts: [],
    tests: [
      {
        file: 'packages/code/tests/a.test.ts',
        name: 'cc @felipesauer and @mnema-work/maintainers',
        message: [
          'before',
          '``````',
          '</details><script>alert(1)</script>',
          '## A heading of the attacker',
          '[click](https://evil.example) @someone',
          `${MARKER}`,
          '``````',
          'after',
          // Tag characters (hidden text for an agent), the Arabic letter mark and a line separator.
          `tag${String.fromCodePoint(0xe0041, 0xe0042)} mark${String.fromCodePoint(0x061c)} line${String.fromCodePoint(0x2028)}end`,
        ].join('\n'),
      },
    ],
    testsLeftOut: 0,
    lint: {
      files: ['packages/code/src/a.ts'],
      diff: '+// @octocat <a href="x">x</a>\n+````````````\n+# out\n',
      diffCut: false,
    },
  };

  const report = read(HOSTILE);
  if (!report.ok) throw new Error(`the hostile report was refused: ${report.why}`);
  const body = buildComment({
    conclusion: 'failure',
    report: report.report,
    sha: SHA,
    run: RUN,
    contributor: { login: 'new-person', firstTime: true },
    repository: REPO,
  });

  it('keeps every line of the report inside a fenced block it cannot close', () => {
    const outside = outsideFences(body);
    for (const theirs of [
      'everyone',
      'onerror',
      'Pwned',
      'script',
      'A heading of the attacker',
      'evil.example',
      'octocat',
      'felipesauer',
      'href',
      '# out',
    ]) {
      expect(outside, theirs).not.toContain(theirs);
    }
    // The fence is longer than the longest run of backticks inside it (twelve in the diff).
    expect(body).toMatch(/^`{13,}diff$/m);
  });

  it('lets no @ of the report notify anybody: the only mention is the welcome, from the API', () => {
    const mentions = [...body.matchAll(/@(?!\u200b)[A-Za-z0-9-]/g)].map((m) => m.index);
    expect(mentions).toHaveLength(1);
    expect(body).toContain('Welcome, @new-person');
    expect(body).toContain('@\u200beveryone');
  });

  it('takes out the tag characters, the Arabic letter mark and the line separator', () => {
    expect(body).toContain('tag mark lineend');
    for (const point of [0xe0041, 0xe0042, 0x061c, 0x2028, 0x2029, 0x202e, 0xfeff]) {
      expect(body, point.toString(16)).not.toContain(String.fromCodePoint(point));
    }
  });

  it('carries no HTML outside a fence but the hidden marker it opens with', () => {
    expect(body.startsWith(`${MARKER}\n`)).toBe(true);
    const outside = outsideFences(body).replace(MARKER, '');
    expect(outside).not.toMatch(/[<>]/);
  });

  it('says what failed and the command that fixes the lint', () => {
    expect(body).toContain('lint @\u200beveryone');
    expect(body).toContain('pnpm exec biome check --write packages/code/src/a.ts');
    expect(body).toContain(RUN);
    expect(body).toContain('a1b2c3d');
  });

  it('cuts a comment that would pass the size GitHub takes, dropping the diff first', () => {
    const big = plainReport();
    big.tests = Array.from({ length: 30 }, (_, n) => ({
      file: 'packages/code/tests/a.test.ts',
      name: `case ${n} ${'n'.repeat(480)}`,
      message: 'm'.repeat(2000),
    }));
    (big.lint as { diff: string }).diff = 'd'.repeat(30_000);
    const got = read(big);
    if (!got.ok) throw new Error(got.why);
    const long = buildComment({
      conclusion: 'failure',
      report: got.report,
      sha: SHA,
      run: RUN,
      contributor: { login: 'x', firstTime: false },
      repository: REPO,
    });
    expect(long.length).toBeLessThanOrEqual(60_000);
    expect(long).not.toContain('d'.repeat(100));
    expect(long).toContain('pnpm exec biome check --write packages/code/src/a.ts');
    outsideFences(long);
  });
});

describe('what the comment says', () => {
  it('welcomes a first pull request by the login the API gave, and points at CONTRIBUTING.md', () => {
    const body = buildComment({
      conclusion: 'success',
      report: null,
      sha: SHA,
      run: RUN,
      contributor: { login: 'new-person', firstTime: true },
      repository: REPO,
    });
    expect(body).toContain('Welcome, @new-person');
    expect(body).toContain('https://github.com/mnema-work/mnema/blob/main/CONTRIBUTING.md');
    expect(body).toContain('pnpm check:contribution');
    expect(body).toContain('Every check of CI passed on `a1b2c3d`');
  });

  it('names nobody when the login is not one GitHub could have given', () => {
    const body = buildComment({
      conclusion: 'success',
      report: null,
      sha: SHA,
      run: RUN,
      contributor: { login: 'a b <x>', firstTime: true },
      repository: REPO,
    });
    expect(body).not.toContain('@');
    expect(body).toContain('Welcome, and thank you');
  });

  it('says so when the report could not be read, without a word of it', () => {
    const body = buildComment({
      conclusion: 'failure',
      report: null,
      why: 'the report is not JSON',
      sha: SHA,
      run: RUN,
      contributor: { login: 'x', firstTime: false },
      repository: REPO,
    });
    expect(body).toContain('CI failed on `a1b2c3d`');
    expect(body).toContain('could not be read (the report is not JSON)');
  });

  it('says that biome cannot fix a lint it has no fix for', () => {
    const report = plainReport();
    report.lint = { files: [], diff: '', diffCut: false };
    const got = read(report);
    if (!got.ok) throw new Error(got.why);
    const body = buildComment({
      conclusion: 'failure',
      report: got.report,
      sha: SHA,
      run: RUN,
      contributor: { login: 'x', firstTime: false },
      repository: REPO,
    });
    expect(body).not.toContain('biome check --write');
    expect(body).toContain('pnpm lint');
  });
});

/** An API that answers from a table and writes down what was asked of it. */
function github(pulls: unknown[], comments: Record<number, unknown[]>) {
  const done: string[] = [];
  return {
    done,
    api: {
      list: async (path: string): Promise<unknown[]> => {
        if (path === `repos/${REPO}/pulls?state=open&per_page=100`) return pulls;
        const m = /^repos\/mnema-work\/mnema\/issues\/(\d+)\/comments\?per_page=100$/.exec(path);
        if (m?.[1] !== undefined) return comments[Number(m[1])] ?? [];
        throw new Error(`unexpected path ${path}`);
      },
      post: async (path: string, body: string) => {
        done.push(`POST ${path} ${body.split('\n')[1] ?? ''}`);
      },
      patch: async (path: string, body: string) => {
        done.push(`PATCH ${path} ${body.split('\n')[1] ?? ''}`);
      },
    },
  };
}

const pull = (
  number: number,
  sha: string,
  association = 'CONTRIBUTOR',
  from: { repo: string; ref: string } = { repo: 'someone/mnema', ref: 'fix-it' },
) => ({
  number,
  head: { sha, ref: from.ref, repo: { full_name: from.repo } },
  base: { repo: { full_name: REPO } },
  user: { login: 'someone' },
  author_association: association,
});

const event = (conclusion: string) => ({
  workflow_run: {
    event: 'pull_request',
    conclusion,
    head_sha: SHA,
    html_url: RUN,
    head_repository: { full_name: 'someone/mnema' },
    head_branch: 'fix-it',
    // A fork's run carries no pull request here: the one to comment on is found by the head.
    pull_requests: [],
  },
});

const ours = (id: number) => ({
  id,
  user: { login: 'github-actions[bot]' },
  body: `${MARKER}\nold`,
});

describe('one comment per pull request, on the pull request whose head ran', () => {
  const report = read(plainReport());
  const fromReport = report.ok ? report.report : null;

  it('finds the pull request by the head of the run and writes one comment on it', async () => {
    const { api, done } = github([pull(7, SHA), pull(8, 'f'.repeat(40))], {});
    await tell({ event: event('failure'), report: fromReport, api, repository: REPO });
    expect(done).toEqual([`POST repos/${REPO}/issues/7/comments **CI failed on \`a1b2c3d\`.**`]);
  });

  it('tells only the pull request of the repository and branch that ran, when two share the head', async () => {
    const { api, done } = github(
      [
        pull(6, SHA, 'CONTRIBUTOR', { repo: REPO, ref: 'fix-it' }),
        pull(7, SHA),
        pull(8, SHA, 'CONTRIBUTOR', { repo: 'someone/mnema', ref: 'other-branch' }),
      ],
      {},
    );
    await tell({ event: event('failure'), report: fromReport, api, repository: REPO });
    expect(done).toEqual([`POST repos/${REPO}/issues/7/comments **CI failed on \`a1b2c3d\`.**`]);
  });

  it('rewrites its own comment in place, and never one somebody else wrote with the marker', async () => {
    const forged = { id: 5, user: { login: 'mallory' }, body: `${MARKER}\nforged` };
    const { api, done } = github([pull(7, SHA)], { 7: [forged, ours(9)] });
    await tell({ event: event('failure'), report: fromReport, api, repository: REPO });
    expect(done).toEqual([`PATCH repos/${REPO}/issues/comments/9 **CI failed on \`a1b2c3d\`.**`]);
  });

  it('says a green run passed on the comment that is there, and opens none for it', async () => {
    const there = github([pull(7, SHA)], { 7: [ours(9)] });
    await tell({ event: event('success'), report: null, api: there.api, repository: REPO });
    expect(there.done).toEqual([
      `PATCH repos/${REPO}/issues/comments/9 **Every check of CI passed on \`a1b2c3d\`.** [The run](${RUN}).`,
    ]);

    const none = github([pull(7, SHA)], {});
    await tell({ event: event('success'), report: null, api: none.api, repository: REPO });
    expect(none.done).toEqual([]);
  });

  it('opens one for a green first pull request, to welcome it', async () => {
    const { api, done } = github([pull(7, SHA, 'FIRST_TIME_CONTRIBUTOR')], {});
    await tell({ event: event('success'), report: null, api, repository: REPO });
    expect(done).toEqual([
      `POST repos/${REPO}/issues/7/comments Welcome, @someone, and thank you for your first pull request here.`,
    ]);
  });

  it('writes nothing when the pull request has moved past the run, or the run was cancelled', async () => {
    const moved = github([pull(7, 'f'.repeat(40))], {});
    await tell({ event: event('failure'), report: fromReport, api: moved.api, repository: REPO });
    expect(moved.done).toEqual([]);

    const cancelled = github([pull(7, SHA)], {});
    await tell({
      event: event('cancelled'),
      report: fromReport,
      api: cancelled.api,
      repository: REPO,
    });
    expect(cancelled.done).toEqual([]);
  });
});

describe('the report the pull request run writes', () => {
  // The jobs of the run as `gh api --paginate --slurp` writes them: one object per page.
  const jobs = [
    {
      total_count: 3,
      jobs: [
        {
          name: 'lint + build + test (node 24)',
          conclusion: 'failure',
          steps: [
            { name: 'Lint', conclusion: 'failure' },
            { name: 'Build', conclusion: 'skipped' },
          ],
        },
        { name: 'the guards', conclusion: 'success', steps: [] },
        { name: 'what failed, for the comment', conclusion: null, steps: [] },
      ],
    },
  ];

  it('knows when a lint step failed', () => {
    expect(lintFailed(jobs)).toBe(true);
    expect(lintFailed([{ jobs: [{ name: 'x', conclusion: 'success', steps: [] }] }])).toBe(false);
  });

  it('writes a report the reader accepts, with the failing tests, the verdicts and the lint', () => {
    const vitest = {
      testResults: [
        {
          name: '/runner/work/mnema/packages/code/tests/a.test.ts',
          status: 'failed',
          assertionResults: [
            {
              fullName: 'a guard says what to do',
              status: 'failed',
              failureMessages: [
                '\u001b[31mAssertionError: run pnpm vitest run x -u\u001b[39m\n    at Object.<anonymous> (a.test.ts:1:1)',
              ],
            },
            { fullName: 'a passing case', status: 'passed', failureMessages: [] },
          ],
        },
        {
          name: '/runner/work/mnema/packages/code/tests/b.test.ts',
          status: 'failed',
          message: 'Failed to load the module',
          assertionResults: [],
        },
      ],
    };
    const verdict = {
      verdict: 'SOMETHING TO READ',
      reds: [
        {
          file: 'packages/code/tests/a.test.ts',
          name: 'a guard says what to do',
          says: 'THE GUARD CAUGHT',
        },
      ],
    };
    const report = collect({
      jobs,
      reports: [{ cell: 'node24', report: vitest }],
      verdicts: [{ cell: 'node24', reading: verdict }],
      lint: { files: 'packages/code/src/a.ts\n', diff: '-a\n+b\n' },
      root: '/runner/work/mnema',
    });
    expect(report.checks).toEqual([{ name: 'lint + build + test (node 24)', steps: ['Lint'] }]);
    expect(report.tests).toEqual([
      {
        file: 'packages/code/tests/a.test.ts',
        name: 'a guard says what to do',
        message: 'AssertionError: run pnpm vitest run x -u',
      },
      {
        file: 'packages/code/tests/b.test.ts',
        name: '(the file)',
        message: 'Failed to load the module',
      },
    ]);
    expect(report.verdicts).toEqual([{ cell: 'node24', ...verdict }]);
    expect(report.lint).toEqual({
      files: ['packages/code/src/a.ts'],
      diff: '-a\n+b\n',
      diffCut: false,
    });
    expect(readReport(JSON.stringify(report))).toEqual({ ok: true, report });
  });

  it('stays inside the limits the reader holds it to, however much the run said', () => {
    const many = {
      testResults: [
        {
          name: '/r/packages/a.test.ts',
          status: 'failed',
          assertionResults: Array.from({ length: 80 }, (_, n) => ({
            fullName: `case ${n} ${'x'.repeat(900)}`,
            status: 'failed',
            failureMessages: ['y'.repeat(9000)],
          })),
        },
      ],
    };
    const report = collect({
      jobs,
      reports: [{ cell: 'node24', report: many }],
      verdicts: [],
      lint: { files: 'a.ts\n', diff: 'z'.repeat(90_000) },
      root: '/r',
    });
    expect(report.tests).toHaveLength(30);
    expect(report.testsLeftOut).toBe(50);
    expect(report.lint?.diffCut).toBe(true);
    expect(readReport(JSON.stringify(report)).ok).toBe(true);
  });
});
