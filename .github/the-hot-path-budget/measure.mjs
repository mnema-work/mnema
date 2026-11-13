/**
 * THE HOT PATH, MEASURED: the commands the plugin's `hooks/hooks.json` runs at every edit and when
 * a session opens, started as processes against records of 1,000 and 3,000 decisions, cold and
 * warm, and judged against `budget.json` (`verdict.mjs` says how).
 *
 * WHICH COMMANDS. They are READ from `hooks.json`, not written here, so a hook that changes is a
 * hook that is measured:
 * - the edit: the command of the PreToolUse group for `Write|Edit` that runs the gate for the host
 *   that pushes the rules of the path beside the write (`--host qwen`). Claude Code reaches the same
 *   function through a call into the long-lived server, which is not a process the hook starts; the
 *   command is what a host whose hooks are processes pays at every edit, the same read of the same
 *   record, plus a process;
 * - the opening: the two SessionStart commands every session runs, the document (`session-start`)
 *   and the notes (`session-recall`).
 * A command that is not there is an instrument that measures nothing, so it is refused (exit 2).
 *
 * COLD AND WARM. Warm is the cache the CLI keeps in the tree already built; cold is the same
 * record with that file deleted before the run, which is a clone's first read.
 *
 * THE SANDBOX. The records are written by `generate.mjs` under the machine's temporary folder with
 * a home of their own, and every command runs with an empty environment but that home, a PATH and
 * what the hook needs: never the real HOME, never this clone's `.mnema/`.
 *
 * IT IS NOT A GATE. A verdict that says "over" opens one issue under a title that never changes (or
 * comments on the open one) and blocks nothing: that is the point of putting the signal there.
 *
 * Usage:
 *   node measure.mjs scan --out reading.json [--runs 5] [--sizes 1000,3000]
 *   node measure.mjs table reading.json     (the markdown table and the verdict, on stdout)
 *   node measure.mjs tell reading.json      (opens the issue, or comments on it, when over)
 *
 * Exit: 0 it measured, 2 it could not.
 */

import { execFileSync, spawnSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { generate, THE_FILE_TO_EDIT } from './generate.mjs';
import { cellKey, judge, median } from './verdict.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');

/** The title of the one issue, stable on purpose: the next run looks for an open issue by it and comments there. */
export const THE_TITLE = 'The hot path is over its budget';

/**
 * @typedef {{ matcher?: string, type?: string, command?: string }} Hook
 * @typedef {{ name: string, command: string, edit?: true }} Spec
 * @typedef {{ runs: number, sizes: number[], generatedInSeconds: number, writes: number, cells: import('./verdict.mjs').Cell[] }} Reading
 */

/**
 * Reads the three commands out of the hooks file, and refuses one that is not there.
 *
 * @param {{ hooks?: Record<string, { matcher?: string, hooks?: Hook[] }[]> }} hooks
 * @returns {Spec[]}
 */
export function theCommandsOf(hooks) {
  /** @type {(event: string) => Hook[]} */
  const commandsOf = (event) =>
    (hooks.hooks?.[event] ?? []).flatMap((group) =>
      (group.hooks ?? []).map((hook) => ({
        ...hook,
        ...(group.matcher !== undefined ? { matcher: group.matcher } : {}),
      })),
    );
  /** @type {(event: string, label: string, wanted: (hook: Hook & { command: string }) => boolean) => string} */
  const find = (event, label, wanted) => {
    for (const hook of commandsOf(event)) {
      if (hook.type === 'command' && typeof hook.command === 'string') {
        if (wanted({ ...hook, command: hook.command })) return hook.command;
      }
    }
    throw new Error(`hooks.json runs no ${label} command at ${event}`);
  };
  return [
    {
      name: 'before an edit',
      command: find(
        'PreToolUse',
        'gate for the host that pushes the rules of a path',
        (hook) =>
          hook.matcher === 'Write|Edit|NotebookEdit' && hook.command.includes('--host qwen'),
      ),
      edit: true,
    },
    {
      name: 'session start, the document',
      command: find('SessionStart', 'session-start', (hook) =>
        hook.command.includes('session-start.mjs'),
      ),
    },
    {
      name: 'session start, the notes',
      command: find('SessionStart', 'session-recall', (hook) =>
        hook.command.includes('session-recall.mjs'),
      ),
    },
  ];
}

/**
 * A directory with a `mnema` that runs the CLI this clone built, first on the PATH of every command.
 *
 * @param {string} into
 * @returns {string}
 */
function shimOf(into) {
  const cli = join(ROOT, 'packages', 'code', 'dist', 'bundle', 'cli.js');
  if (!existsSync(cli)) throw new Error(`the CLI is not built (${cli}): run pnpm build first`);
  const bin = join(into, 'bin');
  mkdirSync(bin, { recursive: true });
  writeFileSync(join(bin, 'mnema'), `#!/bin/sh\nexec "${process.execPath}" "${cli}" "$@"\n`);
  chmodSync(join(bin, 'mnema'), 0o755);
  return bin;
}

/**
 * Removes the cache the CLI keeps in a tree, so the next read is a clone's first.
 *
 * @param {string} repo
 */
function goCold(repo) {
  const locks = join(repo, '.mnema', 'locks');
  for (const name of readdirSync(locks)) {
    if (/^projection\.db(-wal|-shm|-journal)?$/.test(name)) rmSync(join(locks, name));
  }
}

/**
 * One start of one command, in milliseconds; refuses a start that did not say what that command says.
 *
 * @param {Spec} spec
 * @param {{ repo: string, home: string }} where
 * @param {string} bin
 * @returns {number}
 */
function runOnce(spec, where, bin) {
  const env = {
    HOME: where.home,
    PATH: `${bin}:${dirname(process.execPath)}:/usr/bin:/bin`,
    GIT_CONFIG_NOSYSTEM: '1',
    CLAUDE_PLUGIN_ROOT: join(ROOT, 'plugin'),
    CLAUDE_PROJECT_DIR: where.repo,
    ...(spec.edit ? { QWEN_PROJECT_DIR: where.repo } : {}),
  };
  const input = spec.edit
    ? JSON.stringify({
        session_id: 'the-hot-path-budget',
        tool_name: 'write_file',
        tool_input: { file_path: join(where.repo, THE_FILE_TO_EDIT), content: 'x' },
      })
    : JSON.stringify({ session_id: 'the-hot-path-budget', hook_event_name: 'SessionStart' });
  const started = process.hrtime.bigint();
  const ran = spawnSync('sh', ['-c', spec.command], {
    cwd: where.repo,
    env,
    input,
    encoding: 'utf-8',
    timeout: 120_000,
  });
  const ms = Number(process.hrtime.bigint() - started) / 1e6;
  if (ran.status !== 0)
    throw new Error(`${spec.name}: exit ${ran.status}: ${ran.stderr.slice(0, 300)}`);
  // A command that printed nothing measured the muteness, not the work: the rules are there to be read.
  if (spec.edit && !ran.stdout.includes('additionalContext')) {
    throw new Error(
      `${spec.name}: the gate pushed no rule for ${THE_FILE_TO_EDIT}, so it read nothing worth timing: ${ran.stdout.slice(0, 200)}`,
    );
  }
  if (!spec.edit && ran.stdout.trim() === '' && spec.name.includes('document')) {
    throw new Error(`${spec.name}: the hook handed no document`);
  }
  return ms;
}

/**
 * The whole reading: every size, command and state, `runs` samples each.
 *
 * @param {{ sizes: number[], runs: number }} what
 * @returns {Promise<Reading>}
 */
export async function scan({ sizes, runs }) {
  const specs = theCommandsOf(
    JSON.parse(readFileSync(join(ROOT, 'plugin', 'hooks', 'hooks.json'), 'utf-8')),
  );
  const base = mkdtempSync(join(tmpdir(), 'mnema-hot-path-'));
  const bin = shimOf(base);
  const generating = process.hrtime.bigint();
  const written = await generate(sizes, join(base, 'records'));
  const generated = Number(process.hrtime.bigint() - generating) / 1e9;
  /** @type {import('./verdict.mjs').Cell[]} */
  const cells = [];
  for (const size of sizes) {
    const where = written.sizes[size];
    if (where === undefined) throw new Error(`the generator kept no record of ${size} decisions`);
    for (const spec of specs) {
      // A first start, not counted: it builds the cache and records the service the edit hook records once per session.
      runOnce(spec, where, bin);
      const warm = Array.from({ length: runs }, () => runOnce(spec, where, bin));
      const cold = Array.from({ length: runs }, () => {
        goCold(where.repo);
        return runOnce(spec, where, bin);
      });
      cells.push({ command: spec.name, state: 'cold', size, samples: cold, median: median(cold) });
      cells.push({ command: spec.name, state: 'warm', size, samples: warm, median: median(warm) });
    }
  }
  rmSync(base, { recursive: true, force: true });
  return { runs, sizes, generatedInSeconds: generated, writes: written.writes, cells };
}

/**
 * The budget as it applies to a reading: its ratio is between the smallest and the largest size that was read.
 *
 * @param {Reading} reading
 * @param {import('./verdict.mjs').Budget} budget
 * @returns {import('./verdict.mjs').Budget}
 */
export function budgetFor(reading, budget) {
  return { ...budget, small: Math.min(...reading.sizes), large: Math.max(...reading.sizes) };
}

/**
 * The markdown table (size, command, cold or warm, median) and the verdict.
 *
 * @param {Reading} reading
 * @param {import('./verdict.mjs').Budget} written
 * @returns {string}
 */
export function tableOf(reading, written) {
  const budget = budgetFor(reading, written);
  const verdict = judge(reading.cells, budget);
  const rows = reading.cells
    .map((c) => {
      const first = budget.first[cellKey(c)];
      return `| ${c.size} | ${c.command} | ${c.state} | ${c.median.toFixed(0)} ms | ${Math.min(...c.samples).toFixed(0)} to ${Math.max(...c.samples).toFixed(0)} ms | ${typeof first === 'number' ? `${first} ms` : 'not written'} |`;
    })
    .join('\n');
  const ratios = verdict.ratios
    .map((r) => `| ${r.command} | ${r.state} | ${r.ratio.toFixed(2)} | ${budget.ratio} |`)
    .join('\n');
  return [
    `Medians of ${reading.runs} runs per cell; the record of ${reading.sizes.join(' and ')} decisions was written in ${reading.generatedInSeconds.toFixed(0)} s (${reading.writes} writes).`,
    '',
    '| Decisions | Command | Cache | Median | Range | First measurement |',
    '|---:|---|---|---:|---|---:|',
    rows,
    '',
    `| Command | Cache | ${budget.large}/${budget.small} ratio | Allowed |`,
    '|---|---|---:|---:|',
    ratios,
    '',
    verdict.ok
      ? 'Verdict: within the budget.'
      : `Verdict: OVER the budget.\n\n${verdict.failures.map((f) => `- ${f}`).join('\n')}`,
  ].join('\n');
}

/** @returns {import('./verdict.mjs').Budget} */
const readBudget = () => JSON.parse(readFileSync(join(HERE, 'budget.json'), 'utf-8'));

/**
 * Tells somebody when the reading is over the budget: ONE issue under {@link THE_TITLE}, or a
 * comment on the one that is open. Within the budget it does nothing. The issue book is handed in,
 * so the case that holds this can say what was asked of it without a network.
 *
 * @param {Reading} reading
 * @param {import('./verdict.mjs').Budget} budget
 * @param {{ findOpen: (title: string) => string | undefined, comment: (number: string, body: string) => void, open: (title: string, body: string) => void }} book
 * @param {string} run The address of the run, for whoever reads the issue.
 * @returns {'nothing' | 'commented' | 'opened'}
 */
export function tellSomebody(reading, budget, book, run) {
  if (judge(reading.cells, budgetFor(reading, budget)).ok) return 'nothing';
  const body = `${tableOf(reading, budget)}\n\nRun: ${run}`;
  const open = book.findOpen(THE_TITLE);
  if (open !== undefined) {
    book.comment(open, body);
    return 'commented';
  }
  book.open(THE_TITLE, body);
  return 'opened';
}

/** The issue book of this repository, through the `gh` of the runner. */
function theIssuesOfThisRepository() {
  const repo = process.env.GITHUB_REPOSITORY ?? '';
  /** @type {(...args: string[]) => string} */
  const gh = (...args) => execFileSync('gh', args, { encoding: 'utf-8' }).trim();
  /** @type {{ findOpen: (title: string) => string | undefined, comment: (number: string, body: string) => void, open: (title: string, body: string) => void }} */
  const book = {
    findOpen: (title) =>
      gh(
        'issue',
        'list',
        '--repo',
        repo,
        '--state',
        'open',
        '--search',
        `in:title "${title}"`,
        '--json',
        'number',
        '--jq',
        '.[0].number // empty',
      ) || undefined,
    comment: (number, body) => gh('issue', 'comment', number, '--repo', repo, '--body', body),
    open: (title, body) => gh('issue', 'create', '--repo', repo, '--title', title, '--body', body),
  };
  return book;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const [verb, ...rest] = process.argv.slice(2);
  /** @type {(name: string, fallback: string) => string} */
  const option = (name, fallback) =>
    rest.includes(name) ? (rest[rest.indexOf(name) + 1] ?? fallback) : fallback;
  const reading = () => JSON.parse(readFileSync(rest[0] ?? '', 'utf-8'));
  try {
    const budget = readBudget();
    if (verb === 'scan') {
      const sizes = option('--sizes', `${budget.small},${budget.large}`).split(',').map(Number);
      const scanned = await scan({ sizes, runs: Number(option('--runs', String(budget.runs))) });
      writeFileSync(option('--out', 'reading.json'), `${JSON.stringify(scanned, null, 2)}\n`);
      console.log(tableOf(scanned, budget));
    } else if (verb === 'table') {
      console.log(tableOf(reading(), budget));
    } else if (verb === 'tell') {
      const run = `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`;
      console.log(tellSomebody(reading(), budget, theIssuesOfThisRepository(), run));
    } else {
      console.error('usage: node measure.mjs scan|table|tell ...');
      process.exit(2);
    }
  } catch (fault) {
    console.error(`could not measure: ${fault instanceof Error ? fault.message : fault}`);
    process.exit(2);
  }
}
