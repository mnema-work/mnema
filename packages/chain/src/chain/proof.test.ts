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
import { serializeCheckpoint } from './checkpoint.js';
import { serializeEntry } from './entry.js';
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
    // The task's range (seq 3) is carried too: it sits between two ranges the decision needs, and
    // a proof leaves no gap on a tail, so nothing between them can be left out.
    expect(checked.covers).toEqual([
      {
        tail: expect.any(String),
        ranges: [
          [0, 0],
          [1, 2],
          [3, 3],
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

  it('is refused by both readers when the successor\u2019s birth is taken out, the manifest said again', () => {
    // The omission the no-gap rule closes: without the range of the successor's birth, section 6.7
    // does not apply the supersede, and a manifest recomputed honestly over what is left says the
    // decision is accepted, which the record does not. Both readers refuse the gap by its seqs.
    const text = changed(readFileSync(PUBLISHED, 'utf-8'), (proof) => {
      const [tail] = proof.tails as { ranges: { checkpoint: string }[] }[];
      const at = tail?.ranges.findIndex((range) => range.checkpoint.includes('"fromSeq":5,')) ?? -1;
      tail?.ranges.splice(at, 1);
      const manifest = proof.manifest as { state: string; moves: unknown[] };
      manifest.state = 'accepted';
      manifest.moves = manifest.moves.slice(0, 2);
    });
    const checked = checkProof(text);
    expect(checked).toMatchObject({ proven: false });
    if (checked.proven) return;
    expect(checked.refusal).toMatch(/seq 5\.\.6 is not carried/);
    const second = secondReader(text);
    expect(second.verdict).toBe('REFUSED');
    expect(second.refused.join('\n')).toMatch(/seq 5\.\.6 is not carried/);
  });
});

/** One way to break the published proof, and what the product's checker names first. */
interface Broken {
  readonly name: string;
  readonly text: (published: string) => string;
  readonly refusal: RegExp;
}

type Proof = Record<string, unknown>;
type Tail = {
  tail: string;
  tailproof: string;
  ranges: { checkpoint: string; entries: unknown[] }[];
};
const tailOf = (proof: Proof): Tail => (proof.tails as Tail[])[0] as Tail;
const withSig = (line: string): string =>
  line.replace(/"sig":"([0-9a-f])/, (_, c: string) => `"sig":"${c === '0' ? '1' : '0'}`);

const BROKEN: readonly Broken[] = [
  { name: 'two line feeds at the end', text: (t) => `${t}\n`, refusal: /exactly one line feed/ },
  {
    name: 'laid out with spaces',
    text: (t) => `${JSON.stringify(JSON.parse(t), null, 1)}\n`,
    refusal: /not the canonical serialization/,
  },
  {
    name: 'a scheme no reader knows',
    text: (t) =>
      changed(t, (p) => {
        p.scheme = 'mnema-proof/9';
      }),
    refusal: /scheme this reader does not know/,
  },
  {
    name: 'a key beside the four',
    text: (t) =>
      changed(t, (p) => {
        p.forged = true;
      }),
    refusal: /proof keys are/,
  },
  {
    name: 'no key',
    text: (t) =>
      changed(t, (p) => {
        p.keys = [];
      }),
    refusal: /not a list of keys/,
  },
  {
    name: 'a key twice',
    text: (t) =>
      changed(t, (p) => {
        p.keys = [...(p.keys as string[]), ...(p.keys as string[])];
      }),
    refusal: /ascending order of their fingerprints/,
  },
  {
    name: 'a key that is not one',
    text: (t) =>
      changed(t, (p) => {
        p.keys = ['no key here'];
      }),
    refusal: /a key/,
  },
  {
    name: 'no tail',
    text: (t) =>
      changed(t, (p) => {
        p.tails = [];
      }),
    refusal: /not a list of tails/,
  },
  {
    name: 'a tail of a key the proof does not carry',
    text: (t) =>
      changed(t, (p) => {
        tailOf(p).tail = `${'0'.repeat(64)}-${'cd'.repeat(16)}`;
      }),
    refusal: /names a key the proof does not carry/,
  },
  {
    name: 'a tail proof whose signature was changed',
    text: (t) =>
      changed(t, (p) => {
        tailOf(p).tailproof = withSig(tailOf(p).tailproof);
      }),
    refusal: /tail proof of .* does not verify/,
  },
  {
    name: 'a checkpoint whose signature was changed',
    text: (t) =>
      changed(t, (p) => {
        const range = tailOf(p).ranges[1] as { checkpoint: string };
        range.checkpoint = withSig(range.checkpoint);
      }),
    refusal: /does not verify: bad-signature/,
  },
  {
    name: 'a range with a line taken out',
    text: (t) =>
      changed(t, (p) => {
        tailOf(p).ranges[1]?.entries.pop();
      }),
    refusal: /signs 2 line\(s\), and the range carries 1/,
  },
  {
    name: 'a range carried twice',
    text: (t) =>
      changed(t, (p) => {
        const { ranges } = tailOf(p);
        ranges.splice(2, 0, ranges[1] as Tail['ranges'][number]);
      }),
    refusal: /does not begin after the range before it/,
  },
  {
    name: 'the ranges in reverse order',
    text: (t) =>
      changed(t, (p) => {
        tailOf(p).ranges.reverse();
      }),
    refusal: /the first range it carries begins at seq 7/,
  },
  {
    name: 'a line that is not a string',
    text: (t) =>
      changed(t, (p) => {
        (tailOf(p).ranges[0] as { entries: unknown[] }).entries[0] = 7;
      }),
    refusal: /a line that is not a string/,
  },
  {
    name: 'a manifest that names no decision',
    text: (t) =>
      changed(t, (p) => {
        delete (p.manifest as Proof).decision;
      }),
    refusal: /names no decision/,
  },
  {
    name: 'a manifest about another decision',
    text: (t) =>
      changed(t, (p) => {
        (p.manifest as Proof).decision = 'another';
      }),
    refusal: /carries no writing of the decision/,
  },
  {
    name: 'a middle range dropped',
    text: (t) =>
      changed(t, (p) => {
        tailOf(p).ranges.splice(2, 1);
      }),
    refusal: /seq 3\.\.3 is not carried/,
  },
  {
    name: 'a tail with a key beside its three',
    text: (t) =>
      changed(t, (p) => {
        (tailOf(p) as unknown as Proof).forged = true;
      }),
    refusal: /a tail whose keys are not/,
  },
  {
    name: 'a tail id that is not a string',
    text: (t) =>
      changed(t, (p) => {
        (tailOf(p) as unknown as Proof).tail = 7;
      }),
    refusal: /not of its type/,
  },
  {
    name: 'a range with a key beside its two',
    text: (t) =>
      changed(t, (p) => {
        (tailOf(p).ranges[0] as unknown as Proof).forged = true;
      }),
    refusal: /a range of .* whose keys are not/,
  },
  {
    name: 'a range whose lines are not a list',
    text: (t) =>
      changed(t, (p) => {
        (tailOf(p).ranges[0] as unknown as Proof).entries = 'none';
      }),
    refusal: /whose checkpoint or entries is not of its type/,
  },
  {
    name: 'the lines of a range in another order',
    text: (t) =>
      changed(t, (p) => {
        tailOf(p).ranges[1]?.entries.reverse();
      }),
    refusal: /seq 2 where 1 was due/,
  },
];

describe('every way the published proof is broken here, refused by both readers', () => {
  it.each(BROKEN)('$name', ({ text, refusal }) => {
    const broken = text(readFileSync(PUBLISHED, 'utf-8'));
    const checked = checkProof(broken);
    expect(checked).toMatchObject({ proven: false });
    if (checked.proven) return;
    expect(checked.refusal).toMatch(refusal);
    expect(secondReader(broken).verdict).toBe('REFUSED');
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
      [3, 3],
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

describe('a proof over two tails, one machine each', () => {
  /** Two installations of one key: tail A founds the identity and accepts d-1; tail B supersedes it. */
  function twoTails() {
    const a = open();
    const b = openChainForWriting(root, {
      keyRoot: root,
      installationRoot: mkdtempSync(join(root, 'second-machine-')),
      maxUnsignedEvents: NEVER,
    });
    const on = (w: ChainWriter, subject: string, minute: number) => ({
      at: `2026-11-20T00:0${minute}:00.000Z`,
      who: w.anchor,
      signerFp: w.signerFingerprint,
      subject,
    });
    const text = { rationale: 'Two machines, one record.', initial: 'proposed' };
    a.append(identityFounded(on(a, a.anchor, 0), { foundingFp: a.signerFingerprint }));
    a.checkpoint();
    a.appendAll(decisionBirth(on(a, 'd-1', 1), { ...text, title: 'The first', adr: 'ADR-1' }));
    a.checkpoint();
    a.append(
      decisionTransitioned(on(a, 'd-1', 2), {
        from: 'proposed',
        to: 'accepted',
        action: 'accept',
        fields: { note: 'agreed' },
      }),
    );
    a.checkpoint();
    b.append(taskCreated(on(b, 't-1', 3), { title: 'before' }));
    b.checkpoint();
    b.appendAll(decisionBirth(on(b, 'd-2', 4), { ...text, title: 'The second', adr: 'ADR-2' }));
    b.checkpoint();
    b.append(taskCreated(on(b, 't-2', 5), { title: 'between' }));
    b.checkpoint();
    b.append(
      decisionTransitioned(on(b, 'd-1', 6), {
        from: 'accepted',
        to: 'superseded',
        action: 'supersede',
        by: 'd-2',
        fields: { reason: 'the second says it better' },
      }),
    );
    b.checkpoint();
    b.append(taskCreated(on(b, 't-3', 7), { title: 'after' }));
    b.checkpoint();
    const record = recordToProve({ root });
    const tailA = [...record.tails].find(([, held]) =>
      held.entries.some(({ event }) => event.kind === 'identity.founded'),
    )?.[0] as string;
    const tailB = [...record.tails.keys()].find((tail) => tail !== tailA) as string;
    return { record, tailA, tailB };
  }

  type Carried = { tail: string; ranges: { checkpoint: string; entries: string[] }[] };

  it('is accepted by both readers, each tail carried from seq 0', () => {
    const { record, tailA, tailB } = twoTails();
    const proved = proveDecision(record, 'd-1');
    expect(proved).toMatchObject({ ok: true, manifest: { state: 'superseded' } });
    if (!proved.ok) return;
    const checked = checkProof(proved.text);
    expect(checked.proven).toBe(true);
    if (!checked.proven) return;
    const ranges = new Map(checked.covers.map(({ tail, ranges }) => [tail, ranges]));
    expect(ranges.get(tailA)).toEqual([
      [0, 0],
      [1, 2],
      [3, 3],
    ]);
    // B is carried from its first line to the supersede, the task before the successor included;
    // the task after the supersede is not needed and not carried.
    expect(ranges.get(tailB)).toEqual([
      [0, 0],
      [1, 2],
      [3, 3],
      [4, 4],
    ]);
    expect(secondReader(proved.text)).toEqual({ verdict: 'VERIFIED', refused: [] });
  });

  it('is refused by both readers when the second tail is carried only after the supersede', () => {
    // The prefix omission: tail B carried from a range after its supersede of d-1, with the manifest
    // said again over what is left, reads d-1 as accepted. Every carried tail starts at seq 0.
    const { record, tailA, tailB } = twoTails();
    const proved = proveDecision(record, 'd-1');
    if (!proved.ok) throw new Error('setup: not proven');
    const held = record.tails.get(tailB);
    const after = held?.checkpoints.find((checkpoint) => checkpoint.fromSeq === 5);
    const line = held?.entries.find((entry) => entry.link.seq === 5);
    if (after === undefined || line === undefined) throw new Error('setup: no range after');
    const text = changed(proved.text, (proof) => {
      const tails = proof.tails as Carried[];
      const b = tails.find((tail) => tail.tail === tailB) as Carried;
      b.ranges = [{ checkpoint: serializeCheckpoint(after), entries: [serializeEntry(line)] }];
      const manifest = proof.manifest as { state: string; moves: { action: string }[] };
      manifest.state = 'accepted';
      manifest.moves = manifest.moves.filter((move) => move.action !== 'supersede');
    });
    expect(tailA).not.toBe(tailB);
    const checked = checkProof(text);
    expect(checked).toMatchObject({ proven: false });
    if (checked.proven) return;
    expect(checked.refusal).toMatch(/the first range it carries begins at seq 5/);
    const second = secondReader(text);
    expect(second.verdict).toBe('REFUSED');
    expect(second.refused.join('\n')).toMatch(/the first range it carries begins at seq 5/);
  });

  it('is refused by both readers with a gap on the second tail', () => {
    const { record, tailB } = twoTails();
    const proved = proveDecision(record, 'd-1');
    if (!proved.ok) throw new Error('setup: not proven');
    const text = changed(proved.text, (proof) => {
      const b = (proof.tails as Carried[]).find((tail) => tail.tail === tailB) as Carried;
      b.ranges.splice(2, 1);
    });
    const checked = checkProof(text);
    expect(checked).toMatchObject({ proven: false });
    if (checked.proven) return;
    expect(checked.refusal).toMatch(/seq 3\.\.3 is not carried/);
    expect(secondReader(text).refused.join('\n')).toMatch(/seq 3\.\.3 is not carried/);
  });
});
