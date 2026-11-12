#!/usr/bin/env node
/**
 * WHAT FAILED, WRITTEN DOWN BY THE RUN THAT FAILED. This runs in the last job of CI on a pull
 * request (`what-failed` in `.github/workflows/ci.yml`), with the run's read-only token and no
 * secret, and writes the small report that `comment.mjs` turns into a comment once the run is
 * over. It reads four things the run already has:
 *
 *   - the jobs of this run attempt, from the API: which failed and at which step;
 *   - the JSON report of each vitest run (`vitest-report-<cell>`): the cases that failed and the
 *     first thing each said, stack frames and colours taken out;
 *   - the verdict of `.github/why-it-went-red/` for each cell that ran the suite;
 *   - when a step named `Lint` failed, the files `biome check --write` changed and the diff.
 *
 * It keeps every field inside the limits `comment.mjs` holds a report to, so a report this wrote is
 * one that reader accepts. The reader does not rely on that: this file runs on the pull request's
 * own code, so a pull request can change it, and the reader refuses what is outside the limits.
 */

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isPath, LIMITS } from './comment.mjs';

/** @typedef {import('./comment.mjs').Report} Report */

/**
 * @typedef {{ name?: string, conclusion?: string | null, steps?: { name?: string, conclusion?: string | null }[] }} Job
 */

const FAILED = new Set(['failure', 'timed_out']);

/** An escape sequence of a terminal: colours, mostly. */
const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*[A-Za-z]`, 'g');

/**
 * The jobs, whether the API's pages were slurped (`[{ jobs: [...] }]`) or are a list already.
 *
 * @param {unknown} pages
 * @returns {Job[]}
 */
function jobsOf(pages) {
  if (!Array.isArray(pages)) return [];
  return pages.flatMap((page) =>
    Array.isArray(page) ? page : Array.isArray(page?.jobs) ? page.jobs : [],
  );
}

/**
 * Whether a step named `Lint` failed in any job of the run.
 *
 * @param {unknown} pages
 */
export function lintFailed(pages) {
  return jobsOf(pages).some((job) =>
    (job.steps ?? []).some((step) => step.name === 'Lint' && step.conclusion === 'failure'),
  );
}

/**
 * @param {unknown} text
 * @param {number} max
 */
function cut(text, max) {
  const plain = typeof text === 'string' ? text : '';
  return plain.length <= max ? plain : `${plain.slice(0, max - 6)}\n[cut]`;
}

/**
 * The first thing a failure said: no colour, no stack frame, no trailing blank.
 *
 * @param {unknown} message
 */
function said(message) {
  const plain = typeof message === 'string' ? message.replace(ANSI, '') : '';
  const lines = plain.split('\n').filter((line) => !/^\s+at /.test(line));
  return cut(lines.join('\n').trim(), LIMITS.message);
}

/**
 * @param {unknown} file
 * @param {string} root
 */
function pathOf(file, root) {
  const raw = typeof file === 'string' ? file : '';
  const local = isAbsolute(raw) ? relative(root, raw) : raw;
  return isPath(local) ? local : 'unknown';
}

/**
 * @typedef {{
 *   jobs: unknown,
 *   reports: { cell: string, report: unknown }[],
 *   verdicts: { cell: string, reading: unknown }[],
 *   lint: { files: string, diff: string } | null,
 *   root: string,
 * }} Collected
 */

/**
 * THE REPORT, inside the limits.
 *
 * @param {Collected} given
 * @returns {Report}
 */
export function collect({ jobs, reports, verdicts, lint, root }) {
  const checks = jobsOf(jobs)
    .filter((job) => FAILED.has(job.conclusion ?? ''))
    .slice(0, LIMITS.checks)
    .map((job) => ({
      name: cut(job.name, LIMITS.name),
      steps: (job.steps ?? [])
        .filter((step) => FAILED.has(step.conclusion ?? ''))
        .slice(0, LIMITS.steps)
        .map((step) => cut(step.name, LIMITS.name)),
    }));

  /** @type {{ file: string, name: string, message: string }[]} */
  const tests = [];
  const seen = new Set();
  /** @param {{ file: string, name: string, message: string }} one */
  const add = (one) => {
    const key = `${one.file}\n${one.name}`;
    if (seen.has(key)) return;
    seen.add(key);
    tests.push(one);
  };
  for (const { report } of reports) {
    const modules = /** @type {any} */ (report)?.testResults;
    if (!Array.isArray(modules)) continue;
    for (const module of modules) {
      const file = pathOf(module?.name, root);
      const cases = Array.isArray(module?.assertionResults) ? module.assertionResults : [];
      const failed = cases.filter((/** @type {any} */ one) => one?.status === 'failed');
      for (const one of failed) {
        const name =
          typeof one.fullName === 'string'
            ? one.fullName
            : [...(one.ancestorTitles ?? []), one.title ?? ''].join(' > ');
        add({
          file,
          name: cut(name, LIMITS.name),
          message: said((one.failureMessages ?? [])[0]),
        });
      }
      if (module?.status === 'failed' && failed.length === 0) {
        add({ file, name: '(the file)', message: said(module.message) });
      }
    }
  }

  const readings = verdicts.slice(0, LIMITS.verdicts).map(({ cell, reading }) => {
    const read = /** @type {any} */ (reading) ?? {};
    const reds = Array.isArray(read.reds) ? read.reds : [];
    return {
      cell: cut(cell, 100),
      verdict: cut(read.verdict, 60),
      reds: reds.slice(0, LIMITS.reds).map((/** @type {any} */ red) => ({
        file: pathOf(red?.file, root),
        name: cut(red?.name, LIMITS.name),
        says: cut(red?.says, 60),
      })),
    };
  });

  /** @type {Report['lint']} */
  let linted = null;
  if (lint !== null) {
    const files = lint.files
      .split('\n')
      .map((line) => line.trim())
      .filter(isPath)
      .slice(0, LIMITS.files);
    const whole = lint.diff.length <= LIMITS.diff;
    const diff = whole
      ? lint.diff
      : lint.diff.slice(0, lint.diff.lastIndexOf('\n', LIMITS.diff - 1) + 1 || LIMITS.diff);
    linted = { files, diff, diffCut: !whole };
  }

  return {
    version: 1,
    checks,
    verdicts: readings,
    tests: tests.slice(0, LIMITS.tests),
    testsLeftOut: Math.max(0, tests.length - LIMITS.tests),
    lint: linted,
  };
}

/**
 * @param {string} path
 * @returns {unknown}
 */
function jsonAt(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    return null;
  }
}

/**
 * Each `<prefix><cell>/<file>` under the directory the artifacts were downloaded to.
 *
 * @param {string} dir
 * @param {string} prefix
 * @param {string} file
 */
function cells(dir, prefix, file) {
  /** @type {string[]} */
  let names = [];
  try {
    names = readdirSync(dir).filter((name) => name.startsWith(prefix));
  } catch {
    return [];
  }
  return names.sort().map((name) => ({
    cell: name.slice(prefix.length),
    value: jsonAt(join(dir, name, file)),
  }));
}

/**
 * collect.mjs lint-failed <jobs.json>
 * collect.mjs report --jobs <jobs.json> --artifacts <dir> --root <dir> --out <report.json>
 *                    [--lint-files <names.txt> --lint-diff <lint.diff>]
 *
 * @param {readonly string[]} argv
 */
function main(argv) {
  const [verb, ...rest] = argv;
  if (verb === 'lint-failed') {
    process.stdout.write(`${lintFailed(jsonAt(rest[0] ?? ''))}\n`);
    return;
  }
  if (verb !== 'report') throw new Error(`unknown verb: ${verb}`);
  /** @param {string} flag */
  const arg = (flag) => {
    const at = rest.indexOf(flag);
    return at === -1 ? '' : (rest[at + 1] ?? '');
  };
  const artifacts = arg('--artifacts');
  const lintFiles = arg('--lint-files');
  const report = collect({
    jobs: jsonAt(arg('--jobs')),
    reports: cells(artifacts, 'vitest-report-', 'vitest-report.json').map(({ cell, value }) => ({
      cell,
      report: value,
    })),
    verdicts: cells(artifacts, 'why-it-went-red-', 'why-it-went-red-verdict.json').map(
      ({ cell, value }) => ({ cell, reading: value }),
    ),
    lint:
      lintFiles === ''
        ? null
        : {
            files: readFileSync(lintFiles, 'utf-8'),
            diff: readFileSync(arg('--lint-diff'), 'utf-8'),
          },
    root: arg('--root'),
  });
  const out = arg('--out');
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, `${JSON.stringify(report)}\n`);
  process.stdout.write(
    `${report.checks.length} failed checks, ${report.tests.length + report.testsLeftOut} failed tests, lint ${report.lint === null ? 'passed or did not run' : 'failed'}\n`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
