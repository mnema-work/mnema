/**
 * `mnema prove`: THE PROOF OF ONE DECISION, IN ONE FILE (FORMAT.md section 9).
 *
 * A decision this product recorded and moved is proven from the project's record and the file is
 * checked by this product and by the second reader beside FORMAT.md, which imports nothing of it;
 * one word changed in the file is refused by both; and a decision of this machine's private tree
 * is refused unless `--private` asks for it, because no clone carries that tree and the file hands
 * its lines to whoever receives it.
 */

import { spawnSync } from 'node:child_process';
import {
  appendFileSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DiscoveryEnv } from '@mnema/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runDecision } from '../src/commands/decision.js';
import { runDecisionTransition } from '../src/commands/decision-transition.js';
import { runInit } from '../src/commands/init.js';
import { runProve, runProveCheck, writeProofFile } from '../src/commands/prove.js';
import { type CliIo, run } from '../src/program.js';

const VERIFIER = fileURLToPath(new URL('../../chain/verifier/mnema_verify.py', import.meta.url));

let sandbox: string;
let repo: string;
let env: DiscoveryEnv;

beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), 'mnema-prove-'));
  repo = join(sandbox, 'repo');
  mkdirSync(repo, { recursive: true });
  env = { home: join(sandbox, 'home') };
  runInit({ cwd: repo, env });
});

afterEach(() => {
  rmSync(sandbox, { recursive: true, force: true });
});

function decide(title: string, scope?: 'public' | 'private'): string {
  const recorded = runDecision(
    { cwd: repo, env },
    {
      title,
      rationale: 'A stranger receives a file, not a repository.',
      ...(scope !== undefined ? { scope } : {}),
    },
  );
  if (!recorded.ok) throw new Error('setup: decision refused');
  return recorded.id;
}

function secondReader(file: string): string {
  const said = spawnSync('python3', [VERIFIER, '--json', 'proof', file], { encoding: 'utf-8' });
  if (said.error !== undefined) throw new Error(`python3 could not be run: ${said.error.message}`);
  return (JSON.parse(said.stdout) as { verdict: string }).verdict;
}

async function mnema(...argv: string[]): Promise<{ out: string; err: string; failed: boolean }> {
  const out: string[] = [];
  const err: string[] = [];
  let failed = false;
  const io: CliIo = {
    out: (line) => out.push(line),
    err: (line) => err.push(line),
    fail: () => {
      failed = true;
    },
  };
  await run(argv, io);
  return { out: out.join('\n'), err: err.join('\n'), failed };
}

describe('a decision of the committed record', () => {
  it('is proven in one file that this product and the second reader both accept', async () => {
    const id = decide('Prove one decision in one file');
    const moved = runDecisionTransition(
      { cwd: repo, env },
      { id, action: 'accept', proof: { note: 'agreed in review' } },
    );
    expect(moved).toMatchObject({ ok: true });

    const proved = runProve({ cwd: repo, env }, { decision: 'ADR-1', private: false });
    expect(proved).toMatchObject({ ok: true, scope: 'public' });
    if (!proved.ok) return;
    expect(proved.manifest).toMatchObject({
      decision: id,
      adr: 'ADR-1',
      title: 'Prove one decision in one file',
      state: 'accepted',
    });
    expect(proved.manifest.moves.map((move) => move.action)).toEqual(['create', 'accept']);

    const file = join(sandbox, 'adr-1.proof.json');
    writeFileSync(file, proved.text);
    const checked = runProveCheck(file);
    expect(checked).toMatchObject({ ok: true, verdict: { proven: true } });
    expect(secondReader(file)).toBe('VERIFIED');

    const said = await mnema('prove', '--check', file);
    expect(said.failed).toBe(false);
    expect(said.out).toContain(`proven: ADR-1 ${id}: "Prove one decision in one file"`);
    expect(said.out).toContain('state: accepted, after 2 move(s)');
    expect(said.out).toContain('what it does not prove:');
  });

  it('is refused by both readers with one word of its title changed', async () => {
    const id = decide('Prove one decision in one file');
    const proved = runProve({ cwd: repo, env }, { decision: id, private: false });
    if (!proved.ok) throw new Error('setup: not proven');
    const file = join(sandbox, 'changed.proof.json');
    writeFileSync(
      file,
      proved.text.replaceAll('one decision in one file', 'one decision in two files'),
    );
    expect(readFileSync(file, 'utf-8')).not.toBe(proved.text);

    expect(runProveCheck(file)).toMatchObject({ ok: true, verdict: { proven: false } });
    expect(secondReader(file)).toBe('REFUSED');
    const said = await mnema('prove', '--check', file);
    expect(said.failed).toBe(true);
    expect(said.err).toContain('PROOF_REFUSED');
  });
});

describe('a decision of the private tree', () => {
  it('is refused unless --private asks for it, and proven when it does', () => {
    const id = decide('Kept on this machine', 'private');
    expect(runProve({ cwd: repo, env }, { decision: id, private: false })).toEqual({
      ok: false,
      reason: 'PRIVATE_DECISION',
      id,
    });
    const proved = runProve({ cwd: repo, env }, { decision: id, private: true });
    expect(proved).toMatchObject({ ok: true, scope: 'private', manifest: { decision: id } });
  });
});

describe('a decision no tree holds', () => {
  it('is refused by name', () => {
    expect(runProve({ cwd: repo, env }, { decision: 'not-a-decision', private: true })).toEqual({
      ok: false,
      reason: 'NO_SUCH_DECISION',
      typed: 'not-a-decision',
    });
  });
});

describe('what is refused before any proof is checked or built', () => {
  it('a record that does not verify is not proven from', () => {
    const id = decide('Prove one decision in one file');
    const tails = join(repo, '.mnema', 'tails');
    const [tail] = readdirSync(tails);
    appendFileSync(join(tails, tail as string, '000001.jsonl'), '{"event":{},"link":{}}\n');
    expect(runProve({ cwd: repo, env }, { decision: id, private: false })).toEqual({
      ok: false,
      reason: 'RECORD_BROKEN',
      scope: 'public',
    });
  });

  it('a file that is not there, or not UTF-8, is no proof to check', () => {
    expect(runProveCheck(join(sandbox, 'nowhere.json'))).toMatchObject({
      ok: false,
      reason: 'UNREADABLE_PROOF',
    });
    const file = join(sandbox, 'latin1.json');
    writeFileSync(file, Buffer.from([0x7b, 0xe9, 0x7d, 0x0a]));
    expect(runProveCheck(file)).toMatchObject({ ok: false, reason: 'UNREADABLE_PROOF' });
  });

  it('a proof is never written over a file that is there', () => {
    const file = join(sandbox, 'there.json');
    writeFileSync(file, 'kept');
    expect(writeProofFile(file, 'a proof\n')).toMatchObject({
      ok: false,
      reason: 'PROOF_NOT_WRITTEN',
    });
    expect(readFileSync(file, 'utf-8')).toBe('kept');
    expect(writeProofFile(join(sandbox, 'new.json'), 'a proof\n')).toEqual({ ok: true });
  });

  it('the verb asks for a decision or a file, and not both', async () => {
    const neither = await mnema('prove');
    expect(neither.failed).toBe(true);
    expect(neither.err).toContain('Name a decision to prove, or give --check <file>.');
    const both = await mnema('prove', 'ADR-1', '--check', join(sandbox, 'any.json'));
    expect(both.failed).toBe(true);
    expect(both.err).toContain('--check takes a file and nothing else.');
  });
});
