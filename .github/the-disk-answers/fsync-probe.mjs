/**
 * HOW LONG AN FSYNC TAKES WHERE THE SUITE WRITES, SAMPLED WHILE THE SUITE RUNS.
 *
 * WHY. Cases that normally take 0.03 s were seen stopped for 5 to 10 s inside a CI run with the
 * machine reporting one runnable thread. The suspect is the disk: the record's appends are
 * fsynced (`packages/chain/src/chain/durable.ts`) and the suite writes thousands of them. This
 * measures the suspect and nothing else: one small file written, fsynced with its directory, and
 * removed, every `--every` milliseconds, in `os.tmpdir()` (what `TMPDIR` names, which is where
 * the suite's own temporary trees go). A stall of the disk shows as a worst sample far above the
 * median, with the instant it happened, to be laid beside the ledger's cases.
 *
 * WHAT IT COSTS. One 4 KiB write every 250 ms by default: nothing the suite would notice.
 *
 * WHAT IT DOES NOT SAY. It says how long the disk took to answer THIS probe at those instants. It
 * does not say that a case that stopped was waiting on the disk; it can only make that
 * hypothesis cheaper to confirm or to drop. A run with no worst sample over a second is the
 * evidence that the stalls are not the disk.
 *
 * USE. `node fsync-probe.mjs --out probe.json [--summary page.md] [--every 250]` runs until it is
 * sent SIGTERM or SIGINT, then writes the JSON, appends the page to the summary if one is named and
 * exits 0. `--render probe.json` prints the page of a JSON already written, for a later step to
 * append to its own job summary (a summary belongs to the step that writes it).
 */

import {
  appendFileSync,
  closeSync,
  fsyncSync,
  mkdtempSync,
  openSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
  writeSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** @typedef {{ at: number, ms: number }} Sample */

/** How many of the slowest samples are written beside the percentiles. */
export const WORST = 5;

/**
 * The value at a percentile, by the nearest rank over the sorted values.
 *
 * @param {readonly number[]} sorted ascending
 * @param {number} percent 0 to 100
 * @returns {number}
 */
export function percentile(sorted, percent) {
  if (sorted.length === 0) return 0;
  const rank = Math.max(1, Math.ceil((percent / 100) * sorted.length));
  return sorted[rank - 1] ?? 0;
}

/**
 * What a run of samples says.
 *
 * @param {readonly Sample[]} samples
 * @returns {{ count: number, p50: number, p99: number, max: number, worst: Sample[] }}
 */
export function summarize(samples) {
  const ordered = samples.map((one) => one.ms).sort((a, b) => a - b);
  const worst = [...samples].sort((a, b) => b.ms - a.ms).slice(0, WORST);
  return {
    count: samples.length,
    p50: percentile(ordered, 50),
    p99: percentile(ordered, 99),
    max: ordered.at(-1) ?? 0,
    worst,
  };
}

/**
 * The page the job summary gets.
 *
 * @param {ReturnType<typeof summarize>} said
 * @param {string} where the directory the probe wrote in
 * @returns {string}
 */
export function render(said, where) {
  const out = ['## How long an fsync took on this runner, while the suite ran', ''];
  if (said.count === 0) {
    out.push('The probe took no sample, so it says nothing about the disk.');
    return `${out.join('\n')}\n`;
  }
  out.push(
    `${said.count} samples of one 4 KiB file written, fsynced with its directory and removed, in \`${where}\`: median **${said.p50} ms**, p99 **${said.p99} ms**, worst **${said.max} ms**.`,
    '',
    '| the slowest | when (epoch ms) | fsync |',
    '|---:|---:|---:|',
  );
  said.worst.forEach((one, index) => {
    out.push(`| ${index + 1} | ${one.at} | ${one.ms} ms |`);
  });
  out.push(
    '',
    'The instants are epoch milliseconds, the clock the why-it-went-red ledger writes its `startTime` in, so a stopped case can be laid beside them. A worst sample under a second says the disk was not what stopped the case.',
  );
  return `${out.join('\n')}\n`;
}

/**
 * One sample: the file, then its directory, as an append that creates a file does.
 *
 * @param {string} dir
 * @returns {Sample}
 */
function once(dir) {
  const at = Date.now();
  const began = process.hrtime.bigint();
  const path = join(dir, 'probe');
  const fd = openSync(path, 'w');
  writeSync(fd, Buffer.alloc(4096, 1));
  fsyncSync(fd);
  closeSync(fd);
  const directory = openSync(dir, 'r');
  fsyncSync(directory);
  closeSync(directory);
  unlinkSync(path);
  return { at, ms: Math.round(Number(process.hrtime.bigint() - began) / 1e4) / 100 };
}

/**
 * @param {readonly string[]} argv
 * @returns {{ every: number, out: string, summary: string }}
 */
export function readArgs(argv) {
  const args = { every: 250, out: '', summary: '' };
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (value === undefined) throw new Error(`argument ${flag} was given no value`);
    if (flag === '--every') args.every = Number(value);
    else if (flag === '--out') args.out = value;
    else if (flag === '--summary') args.summary = value;
    else throw new Error(`unknown argument: ${flag}`);
  }
  if (!(args.every > 0)) throw new Error('--every must be a positive number of milliseconds');
  if (args.out === '') throw new Error('--out names where the samples are written');
  return args;
}

if (process.argv[1] === fileURLToPath(import.meta.url) && process.argv[2] === '--render') {
  // `--render <json>`: the page for a probe's own output, printed for a later step to append to
  // its own job summary.
  const written = JSON.parse(readFileSync(process.argv[3] ?? '', 'utf-8'));
  process.stdout.write(render(written, written.tmpdir ?? ''));
} else if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = readArgs(process.argv.slice(2));
  const dir = mkdtempSync(join(tmpdir(), 'fsync-probe-'));
  /** @type {Sample[]} */
  const samples = [];
  const timer = setInterval(() => samples.push(once(dir)), args.every);
  const stop = () => {
    clearInterval(timer);
    const said = summarize(samples);
    writeFileSync(args.out, `${JSON.stringify({ tmpdir: tmpdir(), ...said }, null, 2)}\n`);
    const page = render(said, tmpdir());
    process.stdout.write(page);
    if (args.summary !== '') appendFileSync(args.summary, page);
    rmSync(dir, { recursive: true, force: true });
    process.exit(0);
  };
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
}
