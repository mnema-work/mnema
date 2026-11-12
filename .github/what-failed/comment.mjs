#!/usr/bin/env node
/**
 * WHAT FAILED, SAID ON THE PULL REQUEST. This runs in the job `.github/workflows/what-failed.yml`
 * starts when CI completes for a pull request. That job holds a token that can write on pull
 * requests, and it reads a report written by the pull request's own run, which is code a stranger
 * controls. So this file is the line between the two, and it is written as one:
 *
 *   - the report is DATA. It is read with `JSON.parse` and nothing else, refused above a size, and
 *     refused whole if one field is not of the shape and the limit below (an unknown field
 *     included). A refused report is named by a reason of ours, never by a word of the report;
 *   - every text of the report goes into the comment inside a fenced block longer than any run of
 *     backticks in it, with control, zero-width and bidirectional characters taken out and every
 *     `@` followed by a zero-width space, so it renders as text, closes nothing and notifies nobody;
 *   - the pull request is found through the API by the head SHA of the run, never by a number in
 *     the report and never by `workflow_run.pull_requests`, which is empty for a fork's run. A pull
 *     request whose head has moved past the run is left for the run of its new head;
 *   - the one mention the comment makes is the welcome of a first pull request, built from the
 *     login the API gave for the pull request's author;
 *   - one comment per pull request, found by the hidden marker it opens with AND by being written
 *     by the workflow's own account, and rewritten in place on every run.
 *
 * WHAT IT DOES NOT DO. It does not judge whether the report is TRUE: the pull request's run can say
 * anything about itself, and the checks on the pull request are the authority. It says only what
 * that run reported, as text, beside the link to the run.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** The first line of every comment this writes, and how its own comment is found again. */
export const MARKER =
  '<!-- what-failed: one comment per pull request, rewritten after each run -->';

/** The account a workflow's `GITHUB_TOKEN` writes as. */
const OUR_ACCOUNT = 'github-actions[bot]';

/** How large anything of the report may be. The collector stays inside these; the reader refuses past them. */
export const LIMITS = Object.freeze({
  bytes: 256 * 1024,
  checks: 30,
  steps: 10,
  name: 500,
  verdicts: 10,
  reds: 30,
  tests: 30,
  message: 2000,
  files: 50,
  path: 300,
  diff: 30_000,
});

/** GitHub's own ceiling is 65536 characters; this leaves room for what it adds. */
const MAX_COMMENT = 60_000;

/** How much of one failure message the comment shows. */
const SHOWN_MESSAGE = 1000;

const FIRST_TIME = new Set(['FIRST_TIME_CONTRIBUTOR', 'FIRST_TIMER']);

/** A login as GitHub hands them out: letters, digits and single hyphens, at most 39. */
const LOGIN = /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/;
const HEX_SHA = /^[0-9a-f]{40}$/;
const REPOSITORY = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

/**
 * @typedef {{ name: string, steps: string[] }} Check
 * @typedef {{ file: string, name: string, says: string }} Red
 * @typedef {{ cell: string, verdict: string, reds: Red[] }} Verdict
 * @typedef {{ file: string, name: string, message: string }} FailedTest
 * @typedef {{ files: string[], diff: string, diffCut: boolean }} Lint
 * @typedef {{
 *   version: 1,
 *   checks: Check[],
 *   verdicts: Verdict[],
 *   tests: FailedTest[],
 *   testsLeftOut: number,
 *   lint: Lint | null,
 * }} Report
 */

/**
 * A path of this repository as a command may take it: no leading dash, no `..`, nothing a shell
 * reads as more than a word.
 *
 * @param {unknown} value
 * @returns {value is string}
 */
export function isPath(value) {
  return (
    typeof value === 'string' &&
    value.length <= LIMITS.path &&
    /^[A-Za-z0-9_][A-Za-z0-9_./-]*$/.test(value) &&
    !value.split('/').some((part) => part === '..' || part === '')
  );
}

/**
 * @param {unknown} value
 * @param {number} max
 * @returns {value is string}
 */
const isText = (value, max) => typeof value === 'string' && value.length <= max;

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * An object with exactly these keys, no more and no fewer.
 *
 * @param {unknown} value
 * @param {readonly string[]} keys
 * @returns {value is Record<string, unknown>}
 */
function hasKeys(value, keys) {
  if (!isObject(value)) return false;
  const own = Object.keys(value);
  return own.length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

/**
 * @param {unknown} value
 * @param {number} max
 * @param {(one: unknown) => boolean} each
 */
const isList = (value, max, each) =>
  Array.isArray(value) && value.length <= max && value.every(each);

/**
 * @param {unknown} report
 * @returns {report is Report}
 */
function isReport(report) {
  if (!hasKeys(report, ['version', 'checks', 'verdicts', 'tests', 'testsLeftOut', 'lint'])) {
    return false;
  }
  const shape = [
    report.version === 1,
    isList(
      report.checks,
      LIMITS.checks,
      (one) =>
        hasKeys(one, ['name', 'steps']) &&
        isText(one.name, LIMITS.name) &&
        isList(one.steps, LIMITS.steps, (step) => isText(step, LIMITS.name)),
    ),
    isList(
      report.verdicts,
      LIMITS.verdicts,
      (one) =>
        hasKeys(one, ['cell', 'verdict', 'reds']) &&
        isText(one.cell, 100) &&
        isText(one.verdict, 60) &&
        isList(
          one.reds,
          LIMITS.reds,
          (red) =>
            hasKeys(red, ['file', 'name', 'says']) &&
            isPath(red.file) &&
            isText(red.name, LIMITS.name) &&
            isText(red.says, 60),
        ),
    ),
    isList(
      report.tests,
      LIMITS.tests,
      (one) =>
        hasKeys(one, ['file', 'name', 'message']) &&
        isPath(one.file) &&
        isText(one.name, LIMITS.name) &&
        isText(one.message, LIMITS.message),
    ),
    Number.isSafeInteger(report.testsLeftOut) && /** @type {number} */ (report.testsLeftOut) >= 0,
    report.lint === null ||
      (hasKeys(report.lint, ['files', 'diff', 'diffCut']) &&
        isList(report.lint.files, LIMITS.files, isPath) &&
        isText(report.lint.diff, LIMITS.diff) &&
        typeof report.lint.diffCut === 'boolean'),
  ];
  return shape.every(Boolean);
}

/**
 * READ THE REPORT AS DATA. The reason of a refusal is one of a few sentences of ours.
 *
 * @param {string} text
 * @returns {{ ok: true, report: Report } | { ok: false, why: string }}
 */
export function readReport(text) {
  if (Buffer.byteLength(text, 'utf-8') > LIMITS.bytes) {
    return { ok: false, why: `the report is larger than ${LIMITS.bytes} bytes` };
  }
  /** @type {unknown} */
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, why: 'the report is not JSON' };
  }
  if (!isReport(parsed)) return { ok: false, why: 'the report does not have the expected shape' };
  return { ok: true, report: parsed };
}

/**
 * A STRANGER'S TEXT, MADE INERT: line ends made plain, control, zero-width and bidirectional
 * characters taken out, and a zero-width space after every `@`.
 *
 * @param {string} text
 */
function inert(text) {
  let out = '';
  for (const char of text.replace(/\r\n?/g, '\n')) {
    const point = char.codePointAt(0) ?? 0;
    if (!hidden(point)) out += char === '@' ? '@\u200b' : char;
  }
  return out;
}

/**
 * Control characters but the tab and the line end, the soft hyphen, the zero-width ones, the
 * bidirectional controls and the byte-order mark: what a reader cannot see or what reorders text.
 *
 * @param {number} point
 */
function hidden(point) {
  return (
    (point < 0x20 && point !== 0x09 && point !== 0x0a) ||
    (point >= 0x7f && point <= 0x9f) ||
    point === 0xad ||
    (point >= 0x200b && point <= 0x200f) ||
    (point >= 0x202a && point <= 0x202e) ||
    (point >= 0x2060 && point <= 0x2069) ||
    point === 0xfeff
  );
}

/**
 * A FENCED BLOCK NOTHING INSIDE CAN CLOSE: its fence is longer than the longest run of backticks in
 * the text, and three at least.
 *
 * @param {string} text
 * @param {'text' | 'diff' | 'sh'} info
 */
function fenced(text, info) {
  const body = inert(text).replace(/\n+$/, '');
  const longest = Math.max(0, ...[...body.matchAll(/`+/g)].map((run) => run[0].length));
  const fence = '`'.repeat(Math.max(3, longest + 1));
  return `${fence}${info}\n${body}\n${fence}`;
}

/**
 * @param {string} text
 * @param {number} max
 */
const shorter = (text, max) => (text.length <= max ? text : `${text.slice(0, max)}\n[cut]`);

/**
 * @typedef {{
 *   conclusion: string,
 *   report: Report | null,
 *   why?: string,
 *   sha: string,
 *   run: string,
 *   contributor: { login: string, firstTime: boolean },
 *   repository: string,
 * }} CommentInput
 */

/**
 * THE COMMENT. Every sentence outside a fence is ours; every text of the report is in a fence.
 *
 * @param {CommentInput} input
 * @returns {string}
 */
export function buildComment(input) {
  const full = compose(input, { diff: true, tests: LIMITS.tests });
  if (full.length <= MAX_COMMENT) return full;
  let tests = input.report?.tests.length ?? 0;
  let body = compose(input, { diff: false, tests });
  while (body.length > MAX_COMMENT && tests > 0) {
    tests = Math.floor(tests / 2);
    body = compose(input, { diff: false, tests });
  }
  return body;
}

/**
 * @param {CommentInput} input
 * @param {{ diff: boolean, tests: number }} room
 */
function compose(input, room) {
  const sha = HEX_SHA.test(input.sha) ? input.sha.slice(0, 7) : 'this commit';
  const run =
    input.run.startsWith('https://github.com/') && !/[\s()<>]/.test(input.run) ? input.run : '';
  const theRun = run === '' ? 'The run' : `[The run](${run})`;
  const out = [MARKER];

  if (input.contributor.firstTime) {
    const login = input.contributor.login;
    out.push(
      LOGIN.test(login)
        ? `Welcome, @${login}, and thank you for your first pull request here.`
        : 'Welcome, and thank you for your first pull request here.',
    );
    const contributing = REPOSITORY.test(input.repository)
      ? `[CONTRIBUTING.md](https://github.com/${input.repository}/blob/main/CONTRIBUTING.md)`
      : 'CONTRIBUTING.md';
    out.push(
      `${contributing} says how a change is made here, and \`pnpm check:contribution\`, described there, runs on your machine the checks a contribution is held to.`,
      '',
    );
  }

  if (input.conclusion === 'success') {
    out.push(`**Every check of CI passed on \`${sha}\`.** ${theRun}.`);
    return out.join('\n');
  }

  out.push(`**CI failed on \`${sha}\`.**`);
  const report = input.report;
  if (report === null) {
    const why = input.why === undefined ? '' : ` (${input.why})`;
    out.push(
      `${theRun} says what failed. Its report could not be read${why}, so this comment says only that.`,
    );
    return out.join('\n');
  }
  out.push(
    `${theRun}. What follows is what that run reported about itself, shown as text; this comment is rewritten after every run.`,
  );

  if (report.checks.length > 0) {
    out.push('', '**The checks that failed**, with the steps that failed in each:');
    const lines = report.checks.map((check) =>
      check.steps.length === 0 ? check.name : `${check.name}: ${check.steps.join(', ')}`,
    );
    out.push(fenced(lines.join('\n'), 'text'));
  }

  if (report.verdicts.length > 0) {
    out.push(
      '',
      '**Why it went red.** Each red case was run again on its own: THE GUARD CAUGHT means it fails alone too, a defect at this commit; IT DID NOT REPRODUCE ALONE means it passed alone, so running the job again is the first thing to try. `.github/why-it-went-red/README.md` says the rest.',
    );
    const lines = report.verdicts.flatMap((one) => [
      `${one.cell}: ${one.verdict}`,
      ...one.reds.map((red) => `  ${red.says}  ${red.file} > ${red.name}`),
    ]);
    out.push(fenced(lines.join('\n'), 'text'));
  }

  const tests = report.tests.slice(0, room.tests);
  if (tests.length > 0) {
    const left = report.testsLeftOut + report.tests.length - tests.length;
    out.push(
      '',
      `**The tests that failed**, with what each one said${left > 0 ? ` (${left} more are not shown)` : ''}:`,
    );
    const lines = tests.flatMap((test) => [
      `${test.file} > ${test.name}`,
      ...shorter(test.message, SHOWN_MESSAGE)
        .split('\n')
        .map((line) => `  ${line}`),
      '',
    ]);
    out.push(fenced(lines.join('\n').trimEnd(), 'text'));
    const files = [...new Set(tests.map((test) => test.file))].filter(isPath);
    out.push('To run them on your machine:', fenced(`pnpm vitest run ${files.join(' ')}`, 'sh'));
  }

  if (report.lint !== null) {
    out.push('');
    if (report.lint.files.length === 0) {
      out.push(
        '**Lint failed, and biome has no fix of its own for it.** Run `pnpm lint` and read what it says.',
      );
    } else {
      out.push(
        '**Lint failed.** This applies the fixes biome can make:',
        fenced(`pnpm exec biome check --write ${report.lint.files.join(' ')}`, 'sh'),
      );
      if (room.diff && report.lint.diff !== '') {
        const cut = report.lint.diffCut ? ' (cut at its size limit)' : '';
        out.push(`It changes this${cut}:`, fenced(report.lint.diff, 'diff'));
      } else if (report.lint.diff !== '') {
        out.push('The change it makes is too long for this comment; the command above shows it.');
      }
    }
  }
  return out.join('\n');
}

/**
 * @typedef {{
 *   list: (path: string) => Promise<unknown[]>,
 *   post: (path: string, body: string) => Promise<void>,
 *   patch: (path: string, body: string) => Promise<void>,
 * }} Api
 */

/**
 * FIND THE PULL REQUEST AND KEEP ONE COMMENT ON IT.
 *
 * @param {{ event: unknown, report: Report | null, why?: string, api: Api, repository: string }} given
 * @returns {Promise<string[]>} what was done, one line per pull request
 */
export async function tell({ event, report, why, api, repository }) {
  const run = isObject(event) && isObject(event.workflow_run) ? event.workflow_run : {};
  const conclusion = run.conclusion;
  const sha = run.head_sha;
  if (run.event !== 'pull_request') return ['not a pull request run'];
  if (conclusion !== 'success' && conclusion !== 'failure')
    return [`concluded ${String(conclusion)}`];
  if (typeof sha !== 'string' || !HEX_SHA.test(sha)) return ['no head SHA'];
  if (!REPOSITORY.test(repository)) return ['no repository'];

  const pulls = (await api.list(`repos/${repository}/pulls?state=open&per_page=100`)).filter(
    (one) =>
      isObject(one) &&
      isObject(one.head) &&
      one.head.sha === sha &&
      isObject(one.base) &&
      isObject(one.base.repo) &&
      one.base.repo.full_name === repository &&
      Number.isSafeInteger(one.number) &&
      /** @type {number} */ (one.number) > 0,
  );

  const done = [];
  for (const pull of /** @type {Record<string, any>[]} */ (pulls)) {
    const firstTime = FIRST_TIME.has(pull.author_association);
    const login = isObject(pull.user) && typeof pull.user.login === 'string' ? pull.user.login : '';
    const comments = await api.list(
      `repos/${repository}/issues/${pull.number}/comments?per_page=100`,
    );
    const ours = comments.find(
      (one) =>
        isObject(one) &&
        isObject(one.user) &&
        one.user.login === OUR_ACCOUNT &&
        typeof one.body === 'string' &&
        one.body.startsWith(MARKER) &&
        Number.isSafeInteger(one.id),
    );
    if (conclusion === 'success' && ours === undefined && !firstTime) {
      done.push(`#${pull.number}: green, nothing to say`);
      continue;
    }
    const body = buildComment({
      conclusion,
      report,
      ...(why === undefined ? {} : { why }),
      sha,
      run: typeof run.html_url === 'string' ? run.html_url : '',
      contributor: { login, firstTime },
      repository,
    });
    if (ours === undefined) {
      await api.post(`repos/${repository}/issues/${pull.number}/comments`, body);
      done.push(`#${pull.number}: commented`);
    } else {
      await api.patch(
        `repos/${repository}/issues/comments/${/** @type {{ id: number }} */ (ours).id}`,
        body,
      );
      done.push(`#${pull.number}: rewrote its comment`);
    }
  }
  return done;
}

/**
 * THE REAL API, through `gh` with arguments and never a shell. The body goes on standard input.
 *
 * @returns {Api}
 */
export function githubThroughGh() {
  /**
   * @param {string[]} args
   * @param {string} [input]
   */
  const gh = (args, input) =>
    execFileSync('gh', args, { encoding: 'utf-8', input, maxBuffer: 64 * 1024 * 1024 });
  return {
    async list(path) {
      return JSON.parse(gh(['api', '--paginate', '--slurp', path])).flat();
    },
    async post(path, body) {
      gh(['api', '--method', 'POST', path, '--input', '-'], JSON.stringify({ body }));
    },
    async patch(path, body) {
      gh(['api', '--method', 'PATCH', path, '--input', '-'], JSON.stringify({ body }));
    },
  };
}

/**
 * comment.mjs <event.json> <report.json>
 *
 * The event is the one GitHub wrote for this run; the report may be absent (no artifact).
 */
async function main() {
  const [eventPath = '', reportPath = ''] = process.argv.slice(2);
  const event = JSON.parse(readFileSync(eventPath, 'utf-8'));
  /** @type {Report | null} */
  let report = null;
  /** @type {string | undefined} */
  let why;
  let size = -1;
  try {
    size = statSync(reportPath).size;
  } catch {
    why = 'no report was uploaded';
  }
  if (size > LIMITS.bytes) {
    why = `the report is larger than ${LIMITS.bytes} bytes`;
  } else if (size >= 0) {
    const read = readReport(readFileSync(reportPath, 'utf-8'));
    if (read.ok) report = read.report;
    else why = read.why;
  }
  const done = await tell({
    event,
    report,
    ...(why === undefined ? {} : { why }),
    api: githubThroughGh(),
    repository: process.env.GITHUB_REPOSITORY ?? '',
  });
  process.stdout.write(`${done.join('\n') || 'no open pull request has this head'}\n`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
