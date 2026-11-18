/**
 * A LINE OF A PUBLIC TAIL THAT DOES NOT READ, OR WHOSE HASH DOES NOT HOLD, IS PUT BACK FROM GIT, AND NOTHING ELSE IS WRITTEN
 * (ADR-398, ADR-399), by the binary a user runs.
 *
 *   - a NUL in the middle of a committed line, and a committed line altered with its hash untouched: `mnema tail repair`
 *     puts the committed line back, `mnema verify` and the second reader pass, a write goes on after it, the lines
 *     appended after the commit are as they were, and the repair answers the same warm, cold and with a connection open;
 *   - a line git holds that does not chain (somebody committed the damage, or a different line): refused, the file
 *     byte for byte, and `--from` with an older revision is what mends it;
 *   - a line that is the same bytes in the revision and does not read is a newer mnema's: "update mnema", never repaired;
 *   - the private tree, a conflict marker, a revision without the file, a revision that is not one, a link, and a tail
 *     another process is writing are each refused with nothing written;
 *   - with nothing damaged it says so and exits 0; and what the refusals of a write say names the verb.
 */
// @plants-damage

import { spawnSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveTrees } from '@mnema/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { inEveryCacheState, type Planted, type TheCase } from './support/every-cache-state.js';
import { GIT_WITHOUT_MAINTENANCE } from './support/git-without-maintenance.js';
import { MNEMA_CLI } from './support/the-cli.js';

const SECOND_READER = fileURLToPath(
  new URL('../../chain/verifier/mnema_verify.py', import.meta.url),
);

let sandbox: string;
let template: string;

interface Here extends Planted {
  readonly tail: string;
}

const envOf = (home: string): NodeJS.ProcessEnv => ({
  PATH: process.env.PATH ?? '',
  HOME: home,
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_CONFIG_GLOBAL: GIT_WITHOUT_MAINTENANCE,
  GIT_AUTHOR_NAME: 'T',
  GIT_AUTHOR_EMAIL: 't@example.com',
  GIT_COMMITTER_NAME: 'T',
  GIT_COMMITTER_EMAIL: 't@example.com',
});

const mnema = (here: Planted, ...args: string[]) =>
  spawnSync(process.execPath, [MNEMA_CLI, ...args], {
    cwd: here.repo,
    encoding: 'utf-8',
    env: envOf(here.home),
  });

const git = (here: Planted, ...args: string[]) => {
  const ran = spawnSync('git', args, {
    cwd: here.repo,
    encoding: 'utf-8',
    env: { ...envOf(here.home), GIT_CONFIG_GLOBAL: GIT_WITHOUT_MAINTENANCE },
  });
  expect(ran.status, `git ${args.join(' ')}: ${ran.stderr}`).toBe(0);
  return ran.stdout.trim();
};

const said = (ran: { stdout: string; stderr: string }): string => `${ran.stdout}${ran.stderr}`;

const tailsDir = (here: Planted) => join(here.repo, '.mnema', 'tails');
const segmentOf = (here: Here) => join(tailsDir(here), here.tail, '000001.jsonl');

/** The place of the tail's lock and notes, which every worktree of the repository shares. */
const notesOf = (here: Here) =>
  join(
    (resolveTrees(here.repo, { home: here.home }).projectPublicMachinery as { shared: string })
      .shared,
    'locks',
  );

/** Every file of the record's tails, with its bytes: what a repair that wrote nothing leaves as it was. */
function theTails(here: Planted): Record<string, string> {
  const held: Record<string, string> = {};
  for (const tail of readdirSync(tailsDir(here)).sort()) {
    for (const file of readdirSync(join(tailsDir(here), tail)).sort()) {
      held[`${tail}/${file}`] = readFileSync(join(tailsDir(here), tail, file)).toString('latin1');
    }
  }
  return held;
}

const linesOf = (file: string): string[] => readFileSync(file, 'latin1').split('\n');
const lineOfTheLockfile = (here: Here): number =>
  linesOf(segmentOf(here)).findIndex((line) => line.includes('Because the lockfile'));

/** Builds the record once: a project in git, two decisions committed, one more written after the commit. */
function build(dir: string): Here {
  const here = { repo: join(dir, 'repo'), home: join(dir, 'home') };
  for (const path of [here.repo, here.home]) mkdirSync(path, { recursive: true });
  git(here, 'init', '-q', '-b', 'main');
  writeFileSync(join(here.repo, 'README'), 'x\n');
  git(here, 'add', 'README');
  git(here, 'commit', '-q', '-m', 'first');
  expect(mnema(here, 'init', '--yes', '--hosts', 'none').status).toBe(0);
  expect(mnema(here, 'decision', 'record', 'Use biome', 'Because it lints').status).toBe(0);
  expect(mnema(here, 'decision', 'record', 'Use pnpm', 'Because the lockfile').status).toBe(0);
  expect(mnema(here, 'memory', 'a private note', '--scope', 'private').status).toBe(0);
  git(here, 'add', '.mnema');
  git(here, 'commit', '-q', '-m', 'the record');
  expect(mnema(here, 'decision', 'record', 'Use vitest', 'Because it is fast').status).toBe(0);
  const [tail] = readdirSync(tailsDir(here));
  return { ...here, tail: tail as string };
}

/** A copy of the built record in a directory of its own, so a case damages nothing another reads. */
function aCopy(): Here {
  const dir = mkdtempSync(join(sandbox, 'case-'));
  cpSync(template, dir, { recursive: true });
  const here = { repo: join(dir, 'repo'), home: join(dir, 'home') };
  const [tail] = readdirSync(tailsDir(here));
  return { ...here, tail: tail as string };
}

/** The line at `index` with the byte at its middle made NUL: it no longer reads, and is the same size. */
const withANul = (line: string): string =>
  `${line.slice(0, Math.floor(line.length / 2))}\0${line.slice(Math.floor(line.length / 2) + 1)}`;

/** The same line with a word of its text swapped for another of the same size: it reads, and its hash does not hold. */
const altered = (line: string): string =>
  line.replace('Because the lockfile', 'Because the Lockfile');

function replaceLine(here: Here, index: number, change: (line: string) => string): void {
  const lines = linesOf(segmentOf(here));
  lines[index] = change(lines[index] as string);
  writeFileSync(segmentOf(here), lines.join('\n'), 'latin1');
}

function secondReading(here: Planted): { verdict: string } {
  const ran = spawnSync(
    'python3',
    ['-I', SECOND_READER, '--json', 'record', join(here.repo, '.mnema')],
    { encoding: 'utf-8' },
  );
  if (ran.stdout === '') throw new Error(`the second reader said nothing: ${ran.stderr}`);
  return JSON.parse(ran.stdout);
}

beforeAll(() => {
  sandbox = mkdtempSync(join(tmpdir(), 'mnema-repair-'));
  template = join(sandbox, 'template');
  mkdirSync(template);
  build(template);
}, 120_000);

afterAll(() => rmSync(sandbox, { recursive: true, force: true }));

describe('a line put back from git', () => {
  it('puts back a line with a NUL in it, leaves what came after the commit, and the record verifies and goes on', () => {
    const here = aCopy();
    const honest = readFileSync(segmentOf(here), 'latin1');
    const at = lineOfTheLockfile(here);
    expect(at).toBeGreaterThan(0);
    replaceLine(here, at, withANul);
    const damaged = readFileSync(segmentOf(here), 'latin1');
    expect(damaged).not.toBe(honest);
    const before = theTails(here);

    // The refusal of a write names the verb and the tail.
    const refused = mnema(here, 'decision', 'record', 'A title', 'A rationale');
    expect(refused.status).not.toBe(0);
    expect(said(refused)).toContain(`mnema tail repair ${here.tail}`);
    expect(said(refused)).toContain('update mnema if a newer one wrote the line');
    expect(theTails(here)).toEqual(before);

    const ran = mnema(here, 'tail', 'repair', here.tail);
    expect(ran.status, said(ran)).toBe(0);
    expect(ran.stdout).toContain(`Repaired tail ${here.tail}: 1 line(s) put back from HEAD.`);
    expect(ran.stdout).toContain(`put back line ${at + 1} of 000001.jsonl`);
    // The line is the one that was written, and the line written after the commit is untouched.
    expect(readFileSync(segmentOf(here), 'latin1')).toBe(honest);
    expect(Object.keys(theTails(here))).toEqual(Object.keys(before));
    for (const [file, bytes] of Object.entries(before)) {
      if (!file.endsWith('000001.jsonl')) expect(theTails(here)[file], file).toBe(bytes);
    }
    // What it replaced is kept in the place of the notes, never in the record.
    const kept = readdirSync(notesOf(here)).filter((name) => name.endsWith('.before-repair'));
    expect(kept).toHaveLength(1);
    expect(readFileSync(join(notesOf(here), kept[0] as string), 'latin1')).toBe(damaged);
    expect(readdirSync(join(tailsDir(here), here.tail)).sort()).toEqual(
      Object.keys(before)
        .map((file) => file.slice(file.indexOf('/') + 1))
        .sort(),
    );

    const verified = mnema(here, 'verify', '--require', 'signed');
    expect(verified.status, said(verified)).toBe(0);
    expect(secondReading(here).verdict).toBe('VERIFIED');
    expect(mnema(here, 'search', 'lockfile').stdout).toContain('Use pnpm');
    // A write goes on, and the record still verifies: nothing the repair left is believed wrongly.
    expect(mnema(here, 'decision', 'record', 'Use tsc', 'Because it checks').status).toBe(0);
    expect(mnema(here, 'verify', '--require', 'signed').status).toBe(0);
    expect(secondReading(here).verdict).toBe('VERIFIED');
  }, 120_000);

  it('puts back a line that reads and whose hash does not hold', () => {
    const here = aCopy();
    const honest = readFileSync(segmentOf(here), 'latin1');
    replaceLine(here, lineOfTheLockfile(here), altered);
    expect(mnema(here, 'verify').status).not.toBe(0);
    const ran = mnema(here, 'tail', 'repair', here.tail);
    expect(ran.status, said(ran)).toBe(0);
    expect(ran.stdout).toContain('did not hold its hash');
    expect(readFileSync(segmentOf(here), 'latin1')).toBe(honest);
    expect(mnema(here, 'verify', '--require', 'signed').status).toBe(0);
  }, 120_000);

  it('leaves the last line a crash cut short where it is, and mends the line before it', () => {
    const here = aCopy();
    replaceLine(here, lineOfTheLockfile(here), altered);
    const fragment = '{"event":{"at":"2026-';
    writeFileSync(segmentOf(here), fragment, { flag: 'a' });
    const ran = mnema(here, 'tail', 'repair', here.tail);
    expect(ran.status, said(ran)).toBe(0);
    expect(readFileSync(segmentOf(here), 'latin1').endsWith(fragment)).toBe(true);
    expect(linesOf(segmentOf(here))[lineOfTheLockfile(here)]).toContain('Because the lockfile');
  }, 120_000);

  it('says so and exits 0 when no line is damaged, and writes nothing', () => {
    const here = aCopy();
    const before = theTails(here);
    const ran = mnema(here, 'tail', 'repair', here.tail);
    expect(ran.status, said(ran)).toBe(0);
    expect(ran.stdout).toContain('Nothing to repair');
    expect(theTails(here)).toEqual(before);
    expect(readdirSync(notesOf(here)).some((name) => name.endsWith('.before-repair'))).toBe(false);
  }, 60_000);

  it('answers the same warm, cold and with a connection open before the damage', () => {
    const theCase: TheCase<Here> = {
      found(dir) {
        cpSync(template, dir, { recursive: true });
        const planted = { repo: join(dir, 'repo'), home: join(dir, 'home') };
        const [tail] = readdirSync(tailsDir(planted));
        return { ...planted, tail: tail as string };
      },
      damage(here) {
        replaceLine(here, lineOfTheLockfile(here), withANul);
      },
      run(here, ctx) {
        ctx.forget(here.repo);
        const repaired = mnema(here, 'tail', 'repair', here.tail);
        if (repaired.status !== 0) return repaired;
        ctx.forget(here.repo);
        const search = mnema(here, 'search', 'lockfile');
        const verified = mnema(here, 'verify', '--require', 'signed');
        return {
          status: verified.status,
          stdout: `${repaired.stdout}${search.stdout}${verified.stdout}`,
          stderr: `${repaired.stderr}${search.stderr}${verified.stderr}`,
        };
      },
      normalize: (text) =>
        text
          .replace(/\/\S*mnema-(?:warm|cold|session)-\w+/g, '<sandbox>')
          .replace(/\.\d{13}\./g, '.<ms>.'),
    };
    const seen = inEveryCacheState(theCase);
    expect(seen.cold.status).toBe(0);
    expect(seen.cold.said).toContain('1 line(s) put back from HEAD');
    expect(seen.cold.said).toContain('Use pnpm');
    expect(seen.warm.said).toBe(seen.cold.said);
    expect(seen.session.said).toBe(seen.cold.said);
  }, 240_000);
});

describe('a line that is not put back', () => {
  it('refuses a committed line that does not chain, byte for byte, and mends it from an older revision', () => {
    const here = aCopy();
    const lines = linesOf(segmentOf(here));
    const at = lineOfTheLockfile(here);
    // The record as git holds it has two lines swapped: each reads and holds its hash, and neither chains.
    const swapped = [...lines];
    [swapped[at], swapped[at + 1]] = [lines[at + 1] as string, lines[at] as string];
    writeFileSync(segmentOf(here), swapped.join('\n'), 'latin1');
    git(here, 'add', '.mnema');
    git(here, 'commit', '-q', '-m', 'somebody committed the damage');
    // Here the file is as it was written, but for one line that no longer reads.
    writeFileSync(segmentOf(here), lines.join('\n'), 'latin1');
    replaceLine(here, at, withANul);
    const before = theTails(here);

    const ran = mnema(here, 'tail', 'repair', here.tail);
    expect(ran.status).toBe(1);
    expect(said(ran)).toContain('does not chain');
    expect(said(ran)).toContain('--from');
    expect(theTails(here)).toEqual(before);

    // The commit before it holds the line as it was written.
    const older = mnema(here, 'tail', 'repair', here.tail, '--from', 'HEAD~1');
    expect(older.status, said(older)).toBe(0);
    expect(older.stdout).toContain('from HEAD~1');
  }, 120_000);

  it('refuses a committed line that is damaged in the revision too', () => {
    const here = aCopy();
    replaceLine(here, lineOfTheLockfile(here), altered);
    git(here, 'add', '.mnema');
    git(here, 'commit', '-q', '-m', 'somebody committed the damage');
    const before = theTails(here);
    const ran = mnema(here, 'tail', 'repair', here.tail);
    expect(ran.status).toBe(1);
    expect(said(ran)).toContain('damaged in HEAD too');
    expect(said(ran)).toContain('--from');
    expect(theTails(here)).toEqual(before);
  }, 120_000);

  it('tells a line a newer mnema wrote, the same in the revision, to update mnema, and does not repair it', () => {
    const here = aCopy();
    // A key no writer puts on a line: this reader refuses the line, and so would the one that wrote it be newer.
    replaceLine(here, lineOfTheLockfile(here), (line) => line.replace(/^\{/, '{"future":1,'));
    git(here, 'add', '.mnema');
    git(here, 'commit', '-q', '-m', 'a newer mnema wrote it');
    const before = theTails(here);
    const ran = mnema(here, 'tail', 'repair', here.tail);
    expect(ran.status).toBe(1);
    expect(said(ran)).toContain('a newer mnema wrote it. Update mnema.');
    expect(said(ran)).not.toContain('--from');
    expect(theTails(here)).toEqual(before);
  }, 120_000);

  it('refuses a tail of the private tree, with nothing written and without naming the verb as the way out', () => {
    const here = aCopy();
    const priv = resolveTrees(here.repo, { home: here.home }).projectPrivate as string;
    const [tail] = readdirSync(join(priv, 'tails'));
    const segment = join(priv, 'tails', tail as string, '000001.jsonl');
    const lines = readFileSync(segment, 'latin1').split('\n');
    lines[0] = withANul(lines[0] as string);
    writeFileSync(segment, lines.join('\n'), 'latin1');
    const damaged = readFileSync(segment, 'latin1');
    const ran = mnema(here, 'tail', 'repair', tail as string);
    expect(ran.status).toBe(1);
    expect(said(ran)).toContain('private record, which git does not keep');
    expect(said(ran)).not.toContain('mnema tail repair');
    expect(readFileSync(segment, 'latin1')).toBe(damaged);
  }, 120_000);

  it('refuses a conflict marker, and names the way to redo the merge', () => {
    const here = aCopy();
    const lines = linesOf(segmentOf(here));
    lines.splice(lineOfTheLockfile(here), 0, '<<<<<<< HEAD');
    writeFileSync(segmentOf(here), lines.join('\n'), 'latin1');
    const before = theTails(here);
    const ran = mnema(here, 'tail', 'repair', here.tail);
    expect(ran.status).toBe(1);
    expect(said(ran)).toContain('conflict marker');
    expect(said(ran)).toContain('mnema doctor --fix merge-driver');
    expect(theTails(here)).toEqual(before);
  }, 120_000);

  it('refuses a revision that does not hold the file, and one that is not a revision', () => {
    const here = aCopy();
    replaceLine(here, lineOfTheLockfile(here), withANul);
    const before = theTails(here);
    // The first commit holds a README and no record.
    const without = mnema(here, 'tail', 'repair', here.tail, '--from', 'HEAD~1');
    expect(without.status).toBe(1);
    expect(said(without)).toContain('holds no line');
    const none = mnema(here, 'tail', 'repair', here.tail, '--from', 'no-such-revision');
    expect(none.status).toBe(1);
    expect(said(none)).toContain('not a revision');
    const flag = mnema(here, 'tail', 'repair', here.tail, '--from', '--output=x');
    expect(flag.status).toBe(1);
    expect(theTails(here)).toEqual(before);
    expect(existsSync(join(here.repo, 'x'))).toBe(false);
  }, 120_000);

  it('refuses a record that is not in git, with nothing written', () => {
    const dir = mkdtempSync(join(sandbox, 'case-'));
    cpSync(template, dir, { recursive: true });
    const here = { repo: join(dir, 'repo'), home: join(dir, 'home') };
    rmSync(join(here.repo, '.git'), { recursive: true, force: true });
    const [tail] = readdirSync(tailsDir(here));
    const segment = join(tailsDir(here), tail as string, '000001.jsonl');
    const lines = readFileSync(segment, 'latin1').split('\n');
    lines[1] = withANul(lines[1] as string);
    writeFileSync(segment, lines.join('\n'), 'latin1');
    const before = theTails(here);
    const ran = mnema(here, 'tail', 'repair', tail as string);
    expect(ran.status).toBe(1);
    expect(said(ran)).toContain('not in a git repository');
    expect(theTails(here)).toEqual(before);
  }, 60_000);

  it('refuses a tail that is a link, writing nothing through it', () => {
    const here = aCopy();
    replaceLine(here, lineOfTheLockfile(here), withANul);
    const segment = segmentOf(here);
    const elsewhere = join(dirname(here.repo), 'elsewhere.jsonl');
    renameSync(segment, elsewhere);
    symlinkSync(elsewhere, segment);
    const before = readFileSync(elsewhere, 'latin1');
    const ran = mnema(here, 'tail', 'repair', here.tail);
    expect(ran.status).toBe(1);
    expect(said(ran)).toContain('RECORD_LINKED');
    expect(readFileSync(elsewhere, 'latin1')).toBe(before);
  }, 60_000);

  it('refuses while another process holds the tail, and goes on once it lets it go', () => {
    const here = aCopy();
    replaceLine(here, lineOfTheLockfile(here), withANul);
    const before = theTails(here);
    const lock = join(notesOf(here), `${here.tail}.lock`);
    mkdirSync(dirname(lock), { recursive: true });
    // Held by a live process: this one.
    writeFileSync(lock, `${process.pid} ${Date.now()}\n`);
    const busy = mnema(here, 'tail', 'repair', here.tail);
    expect(busy.status).toBe(1);
    expect(said(busy)).toContain('TAIL_BUSY');
    expect(theTails(here)).toEqual(before);
    rmSync(lock);
    const ran = mnema(here, 'tail', 'repair', here.tail);
    expect(ran.status, said(ran)).toBe(0);
    expect(existsSync(lock)).toBe(false);
  }, 120_000);

  it('says no such tail for a name no tree holds', () => {
    const here = aCopy();
    const ran = mnema(here, 'tail', 'repair', 'nothing-here');
    expect(ran.status).toBe(1);
    expect(said(ran)).toContain('No tail nothing-here');
  }, 60_000);
});
