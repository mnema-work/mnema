/**
 * `sinceBase`: the rule `mnema verify --since` applies, on its own, over a repository whose
 * record files are written byte by byte so each case is exactly one change.
 *
 * The files carry bytes and not events on purpose: the rule is about bytes (presence, and a
 * prefix for the files that only grow), and the record's own reading is not part of it. The
 * end-to-end cases (a real record, the four forgeries, the binary and the flag) are in
 * `tests/the-ci-recipe-catches-what-verify-cannot.test.ts`.
 */

import { spawnSync } from 'node:child_process';
import {
  appendFileSync,
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GIT_WITHOUT_MAINTENANCE } from '../../tests/support/git-without-maintenance.js';
import { sinceBase } from './verify-since.js';

let repo: string;
let record: string;
const TAIL = 'tails/ab-cd';

/** `git <args>` in `dir`, as every git a test writes a repository with runs. */
function git(dir: string, ...args: string[]): string {
  const ran = spawnSync(
    'git',
    [
      '-c',
      'user.name=mnema test',
      '-c',
      'user.email=test@example.invalid',
      '-c',
      'commit.gpgsign=false',
      '-c',
      'init.defaultBranch=main',
      ...args,
    ],
    {
      cwd: dir,
      encoding: 'utf-8',
      env: { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: GIT_WITHOUT_MAINTENANCE },
    },
  );
  if (ran.status !== 0) throw new Error(`git ${args.join(' ')}: ${ran.stderr}`);
  return ran.stdout;
}

function write(path: string, text: string): void {
  writeFileSync(join(record, path), text);
}

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), 'mnema-since-'));
  record = join(repo, '.mnema');
  mkdirSync(join(record, TAIL, 'witness'), { recursive: true });
  mkdirSync(join(record, 'keys'));
  write(`${TAIL}/000001.jsonl`, 'one\ntwo\n');
  write(`${TAIL}/checkpoints.jsonl`, 'cp1\n');
  write(`${TAIL}/tailproof.json`, 'proof\n');
  write(`${TAIL}/witness/aa.ots`, 'pending');
  write('keys/ab.pub', 'key');
  git(repo, 'init', '-q');
  git(repo, 'add', '-A');
  git(repo, 'commit', '-q', '-m', 'base');
});

afterEach(() => {
  rmSync(repo, { recursive: true, force: true });
});

function findings() {
  const said = sinceBase({ recordRoot: record, rev: 'HEAD' });
  if (said.kind !== 'read') throw new Error(`refused: ${said.why}`);
  return said;
}

describe('sinceBase', () => {
  it('passes a record that only grew, and counts every file it compared', () => {
    appendFileSync(join(record, TAIL, '000001.jsonl'), 'three\n');
    appendFileSync(join(record, TAIL, 'checkpoints.jsonl'), 'cp2\n');
    write(`${TAIL}/000002.jsonl`, 'four\n');
    const said = findings();
    expect(said.findings).toEqual([]);
    expect(said.held).toBe(5);
  });

  it('passes a witness proof rewritten in place, which an upgrade does', () => {
    write(`${TAIL}/witness/aa.ots`, 'complete, and longer');
    expect(findings().findings).toEqual([]);
  });

  it('names a segment cut at the end, and a checkpoints file that lost its last line', () => {
    write(`${TAIL}/000001.jsonl`, 'one\n');
    write(`${TAIL}/checkpoints.jsonl`, '');
    expect(findings().findings).toEqual([
      { file: `.mnema/${TAIL}/000001.jsonl`, what: 'rewritten' },
      { file: `.mnema/${TAIL}/checkpoints.jsonl`, what: 'rewritten' },
    ]);
  });

  it('names a segment rewritten in the middle, even when it grew', () => {
    write(`${TAIL}/000001.jsonl`, 'one\nTWO\nthree\n');
    expect(findings().findings).toEqual([
      { file: `.mnema/${TAIL}/000001.jsonl`, what: 'rewritten' },
    ]);
  });

  it('names every file the base held that is gone: a tail, its proof, a key', () => {
    rmSync(join(record, 'tails'), { recursive: true });
    rmSync(join(record, 'keys', 'ab.pub'));
    expect(
      findings()
        .findings.filter((one) => one.what === 'gone')
        .map((one) => one.file),
    ).toEqual([
      `.mnema/keys/ab.pub`,
      `.mnema/${TAIL}/000001.jsonl`,
      `.mnema/${TAIL}/checkpoints.jsonl`,
      `.mnema/${TAIL}/tailproof.json`,
      `.mnema/${TAIL}/witness/aa.ots`,
    ]);
  });

  it('refuses, by name, a revision the clone does not hold and a record outside git', () => {
    const missing = sinceBase({ recordRoot: record, rev: 'no-such-revision' });
    expect(missing).toMatchObject({ kind: 'refused', rev: 'no-such-revision' });
    rmSync(join(repo, '.git'), { recursive: true });
    expect(sinceBase({ recordRoot: record, rev: 'HEAD' })).toMatchObject({
      kind: 'refused',
      why: 'the record is not inside a git repository',
    });
  });

  it('takes each base file out of git once, and writes it down before it asks for the next', () => {
    // A git that says, at every blob it is asked for, how many files the base directory already
    // holds: a change that kept every buffer until the end would write none until the last one.
    for (const n of [2, 3, 4, 5]) write(`${TAIL}/00000${n}.jsonl`, `segment ${n}\n`);
    git(repo, 'add', '-A');
    git(repo, 'commit', '-q', '-m', 'more segments');
    const real = spawnSync('sh', ['-c', 'command -v git'], { encoding: 'utf-8' }).stdout.trim();
    const bin = mkdtempSync(join(tmpdir(), 'mnema-since-bin-'));
    const scratch = mkdtempSync(join(tmpdir(), 'mnema-since-scratch-'));
    const log = join(bin, 'asked.log');
    writeFileSync(
      join(bin, 'git'),
      [
        '#!/bin/sh',
        'for a in "$@"; do',
        '  if [ "$a" = cat-file ]; then',
        `    echo "$* $(find "$TMPDIR" -type f | wc -l)" >> '${log}'`,
        '  fi',
        'done',
        `exec '${real}' "$@"`,
        '',
      ].join('\n'),
    );
    chmodSync(join(bin, 'git'), 0o755);
    vi.stubEnv('PATH', `${bin}:${process.env.PATH ?? ''}`);
    vi.stubEnv('TMPDIR', scratch);
    try {
      expect(findings().findings).toEqual([]);
    } finally {
      vi.unstubAllEnvs();
    }
    const asked = readFileSync(log, 'utf-8').trim().split('\n');
    rmSync(bin, { recursive: true, force: true });
    rmSync(scratch, { recursive: true, force: true });
    // Every segment, the checkpoints, the proof and the key, each once.
    expect(asked.map((line) => line.split(' ').slice(-2, -1)[0]?.split(':')[1]).sort()).toEqual([
      '.mnema/keys/ab.pub',
      `.mnema/${TAIL}/000001.jsonl`,
      `.mnema/${TAIL}/000002.jsonl`,
      `.mnema/${TAIL}/000003.jsonl`,
      `.mnema/${TAIL}/000004.jsonl`,
      `.mnema/${TAIL}/000005.jsonl`,
      `.mnema/${TAIL}/checkpoints.jsonl`,
      `.mnema/${TAIL}/tailproof.json`,
    ]);
    // The Nth blob is asked for with the N-1 before it already written down.
    expect(asked.map((line) => Number(line.split(' ').at(-1)))).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });
});
