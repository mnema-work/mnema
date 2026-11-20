/**
 * A PROOF OF ONE DECISION (FORMAT.md section 9), built and checked by this product and checked by
 * the second reader, from the file alone.
 *
 * The published proof (`proof-vector.json`) is what the code builds from the vector record, byte
 * for byte, and both readers accept it; a proof built from a record this product's writer wrote is
 * accepted by both; one word changed in a signed line or in the manifest is refused by both; and a
 * decision whose events no checkpoint signs yet is not proven.
 */

import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  decisionBirth,
  decisionTransitioned,
  identityFounded,
  taskCreated,
} from '../events/build.js';
import { type CanonicalValue, canonicalStringify } from '../events/canonical.js';
import { openChainForWriting } from './chain.js';
import { checkProof, proveDecision, recordToProve, WHAT_A_PROOF_DOES_NOT_COVER } from './proof.js';
import { proofVector, VECTOR_DECISION } from './proof-vector.js';
import type { ChainWriter } from './writer.js';

const VERIFIER = fileURLToPath(new URL('../../verifier/mnema_verify.py', import.meta.url));
const PUBLISHED = fileURLToPath(new URL('../../proof-vector.json', import.meta.url));

let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'mnema-proof-'));
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

/** What the second reader says of a proof: its verdict and the first refusal, if any. */
function secondReader(text: string): { verdict: string; refused: readonly string[] } {
  const file = join(root, `proof-${Math.random().toString(16).slice(2)}.json`);
  writeFileSync(file, text);
  const run = spawnSync('python3', [VERIFIER, '--json', 'proof', file], { encoding: 'utf-8' });
  if (run.error !== undefined) throw new Error(`python3 could not be run: ${run.error.message}`);
  const said = JSON.parse(run.stdout) as {
    verdict: string;
    findings: readonly { level: string; what: string }[];
  };
  return {
    verdict: said.verdict,
    refused: said.findings.filter((f) => f.level === 'FAIL').map((f) => f.what),
  };
}

/** The proof with one of its values changed, written back in its canonical form. */
function changed(text: string, change: (proof: Record<string, unknown>) => void): string {
  const proof = JSON.parse(text) as Record<string, unknown>;
  change(proof);
  return `${canonicalStringify(proof as CanonicalValue)}\n`;
}

const ONE_WORD = ['clone carries', 'copy carries'] as const;

describe('the published proof of one decision', () => {
  it('is what the code builds from the vector record, byte for byte', () => {
    expect(readFileSync(PUBLISHED, 'utf-8')).toBe(proofVector());
  });

  it('is accepted by both readers, and says what it proves', () => {
    const text = readFileSync(PUBLISHED, 'utf-8');
    const checked = checkProof(text);
    expect(checked.proven).toBe(true);
    if (!checked.proven) return;
    expect(checked.manifest.decision).toBe(VECTOR_DECISION);
    expect(checked.manifest.title).toBe('Keep the record in the repository');
    expect(checked.manifest.state).toBe('superseded');
    expect(checked.manifest.moves.map((move) => move.action)).toEqual([
      'create',
      'accept',
      'supersede',
    ]);
    // The task's range (seq 3) is not carried: a range travels only for what the decision needs.
    expect(checked.covers).toEqual([
      {
        tail: expect.any(String),
        ranges: [
          [0, 0],
          [1, 2],
          [4, 4],
          [5, 6],
          [7, 7],
        ],
      },
    ]);
    expect(secondReader(text)).toEqual({ verdict: 'VERIFIED', refused: [] });
  });

  it('is refused by both readers with one word changed in a signed line', () => {
    const text = changed(readFileSync(PUBLISHED, 'utf-8'), (proof) => {
      const [tail] = proof.tails as { ranges: { entries: string[] }[] }[];
      const range = tail?.ranges[1] as { entries: string[] };
      range.entries[0] = (range.entries[0] as string).replace(...ONE_WORD);
    });
    expect(text).toContain(ONE_WORD[1]);
    const checked = checkProof(text);
    expect(checked).toMatchObject({ proven: false });
    if (checked.proven) return;
    expect(checked.refusal).toMatch(/entry hash does not hold/);
    const second = secondReader(text);
    expect(second.verdict).toBe('REFUSED');
    expect(second.refused.join('\n')).toMatch(/entry hash does not hold/);
  });

  it('is refused by both readers with one word changed in the manifest', () => {
    const text = changed(readFileSync(PUBLISHED, 'utf-8'), (proof) => {
      const manifest = proof.manifest as { rationale: string };
      manifest.rationale = manifest.rationale.replace(...ONE_WORD);
    });
    expect(checkProof(text)).toEqual({
      proven: false,
      refusal: "the manifest's rationale is not what the signed lines say",
    });
    expect(secondReader(text)).toEqual({
      verdict: 'REFUSED',
      refused: ["the manifest's rationale is not what the signed lines say"],
    });
  });

  it('is refused by both readers when a state is claimed that the moves do not reach', () => {
    const text = changed(readFileSync(PUBLISHED, 'utf-8'), (proof) => {
      (proof.manifest as { state: string }).state = 'accepted';
    });
    expect(checkProof(text)).toMatchObject({ proven: false });
    expect(secondReader(text).verdict).toBe('REFUSED');
  });

  it('is refused by both readers when a range it needs is taken out', () => {
    // Without the range of the successor's birth, the supersede names a decision whose birth the
    // file does not hold, so section 6.7 does not apply it and the decision reads accepted.
    const text = changed(readFileSync(PUBLISHED, 'utf-8'), (proof) => {
      const [tail] = proof.tails as { ranges: unknown[] }[];
      tail?.ranges.splice(3, 1);
    });
    expect(checkProof(text)).toMatchObject({ proven: false });
    expect(secondReader(text).verdict).toBe('REFUSED');
  });
});

const NEVER = 10_000;

function open(): ChainWriter {
  return openChainForWriting(root, { keyRoot: root, maxUnsignedEvents: NEVER });
}

const at = '2026-11-20T00:00:00.000Z';
const env = (w: ChainWriter, subject: string) => ({
  at,
  who: w.anchor,
  signerFp: w.signerFingerprint,
  subject,
});

describe('a proof of a decision this product wrote', () => {
  it('is built from the record on disk and checked by both readers', () => {
    const w = open();
    w.append(identityFounded(env(w, w.anchor), { foundingFp: w.signerFingerprint }));
    w.checkpoint();
    w.appendAll(
      decisionBirth(
        { ...env(w, 'd-1'), which: 'claude-code' },
        {
          title: 'Use one file for a proof',
          rationale: 'A stranger receives a file, not a repository.',
          adr: 'ADR-1',
          initial: 'proposed',
        },
      ),
    );
    w.checkpoint();
    w.append(taskCreated(env(w, 't-1'), { title: 'unrelated' }));
    w.checkpoint();
    w.append(
      decisionTransitioned(env(w, 'd-1'), {
        from: 'proposed',
        to: 'accepted',
        action: 'accept',
        fields: { note: 'The person said "go".' },
      }),
    );
    w.checkpoint();

    const proved = proveDecision(recordToProve({ root }), 'd-1');
    expect(proved.ok).toBe(true);
    if (!proved.ok) return;
    expect(proved.manifest).toMatchObject({
      decision: 'd-1',
      title: 'Use one file for a proof',
      state: 'accepted',
    });
    expect(proved.manifest.moves.map(({ action, which }) => ({ action, which }))).toEqual([
      { action: 'create', which: 'claude-code' },
      { action: 'accept' },
    ]);
    expect(proved.manifest.record).toMatch(/^[0-9a-f]{64}$/);
    const checked = checkProof(proved.text);
    expect(checked.proven).toBe(true);
    if (!checked.proven) return;
    expect(checked.covers[0]?.ranges).toEqual([
      [0, 0],
      [1, 2],
      [4, 4],
    ]);
    expect(secondReader(proved.text)).toEqual({ verdict: 'VERIFIED', refused: [] });
    expect(WHAT_A_PROOF_DOES_NOT_COVER).toHaveLength(4);
  });

  it('is not built while an event of the decision is above the last checkpoint', () => {
    const w = open();
    w.append(identityFounded(env(w, w.anchor), { foundingFp: w.signerFingerprint }));
    w.checkpoint();
    w.appendAll(
      decisionBirth(env(w, 'd-2'), {
        title: 'Not yet signed',
        rationale: 'No checkpoint covers it.',
        adr: 'ADR-2',
        initial: 'proposed',
      }),
    );
    expect(proveDecision(recordToProve({ root }), 'd-2')).toMatchObject({
      ok: false,
      reason: 'NOT_YET_SIGNED',
    });
  });

  it('is not built for a decision the record does not hold', () => {
    const w = open();
    w.append(identityFounded(env(w, w.anchor), { foundingFp: w.signerFingerprint }));
    w.checkpoint();
    expect(proveDecision(recordToProve({ root }), 'd-nowhere')).toMatchObject({
      ok: false,
      reason: 'NO_SUCH_DECISION',
    });
  });
});
