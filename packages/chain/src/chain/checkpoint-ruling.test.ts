// @plants-damage
/**
 * WHAT A READ PROVES OF A TAIL BY ITS CHECKPOINTS (ADR-557 to ADR-562): the events a holding
 * checkpoint covers are proven, the range of a line that does not hold is withheld, one write's
 * window at the end is served and governs nothing, and anything else unsigned is withheld. And the
 * read names a line's first failure in `verify`'s own words, because both ask `ruleOnCheckpoint`.
 */

import {
  appendFileSync,
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { identityFounded, taskCreated } from '../events/build.js';
import { canonicalStringify } from '../events/canonical.js';
import type { CatalogEvent } from '../events/catalog.js';
import { catalogUpcasters } from '../events/registry.js';
import { verify } from './chain.js';
import {
  type Checkpoint,
  checkpointHash,
  serializeCheckpoint,
  signCheckpoint,
} from './checkpoint.js';
import { foldCheckpoints, ruleOnCheckpoint, type TailSigned } from './checkpoint-ruling.js';
import { entryHash, writtenAsBuilt } from './hash.js';
import type { WrittenHead } from './kept-head.js';
import { deriveAnchor, generateKeyPair, type KeyPair, publicKeyToPem } from './keys.js';
import { checkpointsPath, publicKeyPath, segmentPath, tailDir, tailProofPath } from './layout.js';
import {
  committedKeys,
  keysTheDiskRefuses,
  readTail,
  readTailCheckpoints,
  readTailCheckpointsMarked,
  readTailCheckpointsSince,
} from './store.js';
import { serializeTailProof, signTailProof } from './tailproof.js';

let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'mnema-checkpoint-ruling-'));
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

const WINDOW = 64;

interface Line {
  readonly event: CatalogEvent;
  readonly seq: number;
  readonly prev: string | null;
  readonly hash: string;
}

/** A tail on disk: its lines as written, and what a checkpoint over a run of them would be. */
class Tail {
  readonly id: string;
  readonly lines: Line[] = [];
  readonly checkpoints: Checkpoint[] = [];
  private stamp = 0;

  constructor(
    readonly key: KeyPair,
    suffix = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  ) {
    this.id = `${key.fingerprint}-${suffix}`;
    mkdirSync(join(root, 'keys'), { recursive: true });
    writeFileSync(publicKeyPath({ root }, key.fingerprint), publicKeyToPem(key.publicKey));
    mkdirSync(tailDir({ root }, this.id), { recursive: true });
    writeFileSync(
      tailProofPath({ root }, this.id),
      `${serializeTailProof(signTailProof(this.id, key))}\n`,
    );
  }

  event(title: string): CatalogEvent {
    const anchor = deriveAnchor(this.key.fingerprint);
    this.stamp += 1;
    const at = new Date(Date.UTC(2026, 10, 18, 0, 0, this.stamp)).toISOString();
    if (this.lines.length === 0 && title === 'founding') {
      return identityFounded(
        { at, who: anchor, signerFp: this.key.fingerprint, subject: anchor },
        { foundingFp: this.key.fingerprint },
      );
    }
    return taskCreated(
      { at, who: anchor, signerFp: this.key.fingerprint, subject: title },
      { title },
    );
  }

  /** Appends events chained from `onto` (the last line by default). */
  append(titles: readonly string[], onto?: Line | null): Line[] {
    let prev = onto === undefined ? (this.lines.at(-1) ?? null) : onto;
    const added: Line[] = [];
    for (const title of titles) {
      const event = this.event(title);
      const seq = prev === null ? 0 : prev.seq + 1;
      const hash = entryHash({
        event: writtenAsBuilt(event),
        tail: this.id,
        seq,
        prev: prev?.hash ?? null,
      });
      const line = { event, seq, prev: prev?.hash ?? null, hash };
      this.lines.push(line);
      added.push(line);
      prev = line;
    }
    return added;
  }

  /** Signs the run of lines from `fromSeq` to the end with `by`, chained onto the last checkpoint. */
  sign(fromSeq: number, toSeq = (this.lines.at(-1) as Line).seq, by = this.key): Checkpoint {
    const run = this.lines.filter((line) => line.seq >= fromSeq && line.seq <= toSeq);
    const last = this.checkpoints.at(-1);
    const checkpoint = signCheckpoint({
      tail: this.id,
      fromSeq,
      events: run.map((line) => writtenAsBuilt(line.event)),
      prev: last === undefined ? null : checkpointHash(last),
      keyPair: by,
    });
    this.checkpoints.push(checkpoint);
    return checkpoint;
  }

  write(lines = this.lines, checkpoints = this.checkpoints): void {
    writeFileSync(
      segmentPath({ root }, this.id, 1),
      `${lines
        .map((line) =>
          canonicalStringify({
            event: line.event as never,
            link: { tail: this.id, seq: line.seq, prev: line.prev, hash: line.hash },
          }),
        )
        .join('\n')}\n`,
    );
    writeFileSync(checkpointsPath({ root }, this.id), '');
    for (const checkpoint of checkpoints) {
      appendFileSync(checkpointsPath({ root }, this.id), `${serializeCheckpoint(checkpoint)}\n`);
    }
  }
}

function fold(tail: Tail, options: { note?: WrittenHead; onFold?: () => void } = {}): TailSigned {
  const read = readTail({ root }, tail.id, catalogUpcasters());
  const standing = new Set(read.retained.map((one) => one.seq));
  if (read.linkBreak !== undefined) standing.add(read.linkBreak.seq);
  return foldCheckpoints({
    tail: tail.id,
    entries: read.every,
    checkpoints: readTailCheckpoints({ root }, tail.id),
    keys: committedKeys({ root }),
    standing,
    window: WINDOW,
    ...options,
  });
}

/** `verify`'s first checkpoint issue of the tail, as `[seq, detail]`. */
function verifysFirstCheckpointIssue(): [number | undefined, string] | undefined {
  // The owner rule is `verifyTailSigner`'s, asked of the whole file after the loop.
  const issue = verify(root).issues.find(
    (one) => one.layer === 'T2/T4' && !one.detail.includes('tail-signer-mismatch'),
  );
  return issue === undefined ? undefined : [issue.seq, issue.detail];
}

const titles = (n: number, from = 0): string[] =>
  Array.from({ length: n }, (_, i) => (from + i === 0 ? 'founding' : `t${from + i}`));

describe('a holding checkpoint proves its range', () => {
  it('proves every event of an honest tail, one line per act', () => {
    const tail = new Tail(generateKeyPair());
    tail.append(titles(3));
    tail.sign(0);
    tail.append(titles(2, 3));
    tail.sign(3);
    tail.write();
    const signed = fold(tail);
    expect(signed.signedTo).toBe(4);
    expect(signed.withheld).toEqual([]);
    expect(signed.unproven).toBeUndefined();
    expect(signed.provenHashes.size).toBe(5);
    expect(verify(root).issues).toEqual([]);
  });

  it('serves one write left above the coverage at the end as not yet signed, and proves none of it', () => {
    const tail = new Tail(generateKeyPair());
    tail.append(titles(3));
    tail.sign(0);
    tail.append(titles(WINDOW, 3));
    tail.write();
    const signed = fold(tail);
    expect(signed.withheld).toEqual([]);
    expect(signed.unproven).toEqual({ fromSeq: 3, toSeq: 3 + WINDOW - 1, count: WINDOW });
    expect(signed.provenHashes.size).toBe(3);
  });

  it('withholds an unsigned stretch longer than one write leaves', () => {
    const tail = new Tail(generateKeyPair());
    tail.append(titles(3));
    tail.sign(0);
    tail.append(titles(WINDOW + 1, 3));
    tail.write();
    const signed = fold(tail);
    expect(signed.unproven).toBeUndefined();
    expect(signed.withheld).toEqual([
      { fromSeq: 3, toSeq: 3 + WINDOW, why: 'unproven-beyond-one-write' },
    ]);
  });

  it('withholds a tail that holds events and no checkpoint that verifies', () => {
    const tail = new Tail(generateKeyPair());
    tail.append(titles(3));
    tail.write();
    const signed = fold(tail);
    expect(signed.withheld).toEqual([{ fromSeq: 0, toSeq: 2, why: 'no-checkpoint' }]);
    expect(signed.provenHashes.size).toBe(0);
  });
});

describe('a line that does not hold withholds its range, named in verify’s words', () => {
  it('a rewritten and re-chained range, its checkpoint kept', () => {
    const tail = new Tail(generateKeyPair());
    tail.append(titles(3));
    tail.sign(0);
    tail.append(titles(2, 3));
    tail.sign(3);
    // Rewrite seq 1 and re-chain everything after it: every link holds, the root does not.
    const forged = new Tail(tail.key);
    forged.append(['founding', 'forged', 't2', 't3', 't4']);
    forged.write(forged.lines, tail.checkpoints);
    const signed = fold(forged);
    expect(signed.withheld).toEqual([
      expect.objectContaining({ fromSeq: 0, toSeq: 2, why: 'checkpoint', line: 1 }),
    ]);
    const [first] = signed.withheld;
    expect([first?.fromSeq, first?.detail]).toEqual(verifysFirstCheckpointIssue());
    // The next line is measured against the stored hash of the failed one: it holds.
    expect(signed.proven).toEqual([{ fromSeq: 3, toSeq: 4, by: 'checkpoint' }]);
  });

  it('a last line whose root was replaced: its signature does not hold', () => {
    const tail = new Tail(generateKeyPair());
    tail.append(titles(3));
    tail.sign(0);
    const last = tail.checkpoints.pop() as Checkpoint;
    tail.checkpoints.push({ ...last, contentRoot: '0'.repeat(64) });
    tail.write();
    const signed = fold(tail);
    expect(signed.withheld[0]).toMatchObject({ fault: 'content-root-mismatch' });
    expect([signed.withheld[0]?.fromSeq, signed.withheld[0]?.detail]).toEqual(
      verifysFirstCheckpointIssue(),
    );
  });

  it('a forged fact and a checkpoint signed by a key the record does not hold', () => {
    const tail = new Tail(generateKeyPair());
    tail.append(titles(3));
    tail.sign(0);
    tail.append(['forged']);
    tail.sign(3, 3, generateKeyPair());
    tail.write();
    const signed = fold(tail);
    expect(signed.withheld).toEqual([
      expect.objectContaining({ fromSeq: 3, toSeq: 3, fault: 'no-key', why: 'checkpoint' }),
    ]);
    expect(signed.provenHashes.size).toBe(3);
    expect([signed.withheld[0]?.fromSeq, signed.withheld[0]?.detail]).toEqual(
      verifysFirstCheckpointIssue(),
    );
  });

  it('an earlier line whose signature alone was forged is named, the last one binding it', () => {
    const tail = new Tail(generateKeyPair());
    tail.append(titles(2));
    tail.sign(0);
    const first = tail.checkpoints[0] as Checkpoint;
    tail.checkpoints[0] = { ...first, sig: '0'.repeat(128) };
    tail.write();
    expect(fold(tail).withheld[0]).toMatchObject({ fault: 'bad-signature', line: 1 });
  });

  it('a signed event that is gone: the line proves it stood, and the tail lacks it', () => {
    const tail = new Tail(generateKeyPair());
    tail.append(titles(4));
    tail.sign(0);
    tail.write(tail.lines.filter((line) => line.seq !== 2));
    const signed = fold(tail);
    expect(signed.withheld).toEqual([
      expect.objectContaining({ fromSeq: 0, toSeq: 3, why: 'missing-signed', missing: 2 }),
    ]);
  });
});

describe('a range is the branch its checkpoint chains to', () => {
  it('proves the honest branch of a fork forged at seq 1 and withholds the other', () => {
    const tail = new Tail(generateKeyPair());
    const [founding] = tail.append(titles(3));
    tail.sign(0);
    tail.append(['forged'], founding as Line);
    tail.write();
    const signed = fold(tail);
    expect(signed.signedTo).toBe(2);
    expect(signed.provenHashes.size).toBe(3);
    expect(signed.withheld).toEqual([{ fromSeq: 1, toSeq: 1, why: 'unproven-beyond-one-write' }]);
  });

  it('folds each entry a bounded number of times under a thousand forged lines at seq 1', () => {
    const tail = new Tail(generateKeyPair());
    const [founding] = tail.append(titles(3));
    tail.sign(0);
    for (let i = 0; i < 1000; i += 1) tail.append([`forged${i}`], founding as Line);
    tail.write();
    let folded = 0;
    const signed = fold(tail, { onFold: () => (folded += 1) });
    expect(signed.provenHashes.size).toBe(3);
    // The cold pass with one signature, then every signature on the failure: each entry at most
    // once per pass.
    expect(folded).toBeLessThanOrEqual(2 * tail.lines.length);
  });

  it('reads the same line stored twice as one entry, and withholds nothing', () => {
    const tail = new Tail(generateKeyPair());
    tail.append(titles(3));
    tail.sign(0);
    tail.write([...tail.lines.slice(0, 2), tail.lines[1] as Line, tail.lines[2] as Line]);
    const signed = fold(tail);
    expect(signed.withheld).toEqual([]);
    expect(signed.signedTo).toBe(2);
  });
});

describe('this machine’s signed note proves what it wrote', () => {
  it('proves the events of a write whose checkpoint did not land', () => {
    const tail = new Tail(generateKeyPair());
    tail.append(titles(3));
    tail.sign(0);
    const [, last] = tail.append(['t3', 't4']);
    tail.write();
    const note: WrittenHead = {
      seq: (last as Line).seq,
      hash: (last as Line).hash,
      prev: (last as Line).prev,
      coveredThrough: 2,
      checkpoint: checkpointHash(tail.checkpoints[0] as Checkpoint),
      next: null,
    };
    const signed = fold(tail, { note });
    expect(signed.unproven).toBeUndefined();
    expect(signed.proven.at(-1)).toEqual({ fromSeq: 3, toSeq: 4, by: 'note' });
    expect(signed.withheld).toEqual([]);
  });

  it('withholds what the checkpoints it names covered when the tail no longer holds it', () => {
    const tail = new Tail(generateKeyPair());
    tail.append(titles(3));
    tail.sign(0);
    const [, honest] = tail.append(['t3', 't4']);
    tail.sign(3);
    const note: WrittenHead = {
      seq: (honest as Line).seq,
      hash: (honest as Line).hash,
      prev: (honest as Line).prev,
      coveredThrough: 4,
      checkpoint: checkpointHash(tail.checkpoints[1] as Checkpoint),
      next: null,
    };
    // Rewrite the last two events and drop the line that signed them.
    const forged = new Tail(tail.key);
    forged.append(['founding', 't1', 't2', 'forged3', 'forged4']);
    forged.lines.splice(0, 3, ...tail.lines.slice(0, 3));
    forged.lines.length = 3;
    forged.append(['forged3', 'forged4']);
    forged.write(forged.lines, tail.checkpoints.slice(0, 1));
    const signed = fold(forged, { note });
    expect(signed.withheld).toEqual([
      expect.objectContaining({ fromSeq: 3, toSeq: 4, why: 'checkpoints-removed' }),
    ]);
    // Elsewhere, with no note, the same bytes are one write's window, served and not governing.
    expect(fold(forged).unproven).toEqual({ fromSeq: 3, toSeq: 4, count: 2 });
  });
});

describe('a range that does not hold where the tail already holds a fact', () => {
  it('is said with the break: an entry altered under its own hash', () => {
    const tail = new Tail(generateKeyPair());
    tail.append(titles(3));
    tail.sign(0);
    tail.write();
    const file = segmentPath({ root }, tail.id, 1);
    writeFileSync(file, readFileSync(file, 'utf-8').replace('"t1"', '"tX"'));
    expect(fold(tail).withheld).toEqual([
      expect.objectContaining({ fromSeq: 0, toSeq: 2, why: 'with-a-break' }),
    ]);
  });

  it('finds the branch its root names when the forged one is stored first', () => {
    const tail = new Tail(generateKeyPair());
    const [founding, one, two] = tail.append(titles(3));
    tail.sign(0);
    const [f1, f2] = tail.append(['forged1', 'forged2'], founding as Line);
    tail.write([founding, f1, f2, one, two] as Line[]);
    const signed = fold(tail);
    expect(signed.proven).toEqual([{ fromSeq: 0, toSeq: 2, by: 'checkpoint' }]);
    expect(signed.provenHashes.has((two as Line).hash)).toBe(true);
    expect(signed.provenHashes.has((f2 as Line).hash)).toBe(false);
  });
});

describe('the lines of checkpoints.jsonl a catch-up reads', () => {
  it('reads only what was appended after the mark, and the line at the mark again', () => {
    const tail = new Tail(generateKeyPair());
    tail.append(titles(2));
    tail.sign(0);
    tail.write();
    const first = readTailCheckpointsMarked({ root }, tail.id);
    expect(first.checkpoints).toHaveLength(1);
    const prev = checkpointHash(first.checkpoints[0] as Checkpoint);
    expect(readTailCheckpointsSince({ root }, tail.id, first.mark, prev, checkpointHash)).toEqual({
      checkpoints: [],
      mark: first.mark,
    });
    tail.append(['t2']);
    const added = tail.sign(2);
    tail.write();
    const since = readTailCheckpointsSince({ root }, tail.id, first.mark, prev, checkpointHash);
    expect(since?.checkpoints).toEqual([added]);
    // A file that holds the same lines read whole gives the same mark.
    expect(since?.mark.bytes).toBe(readTailCheckpointsMarked({ root }, tail.id).mark.bytes);
  });

  it('answers undefined for a file that is not the one the mark was taken of', () => {
    const tail = new Tail(generateKeyPair());
    tail.append(titles(2));
    tail.sign(0);
    tail.append(['t2']);
    tail.sign(2);
    tail.write();
    const { checkpoints, mark } = readTailCheckpointsMarked({ root }, tail.id);
    const prev = checkpointHash(checkpoints[1] as Checkpoint);
    const file = checkpointsPath({ root }, tail.id);
    // The same size, another time: rewritten in place.
    utimesSync(file, new Date(2000, 0, 1), new Date(2000, 0, 1));
    expect(readTailCheckpointsSince({ root }, tail.id, mark, prev, checkpointHash)).toBeUndefined();
    // Shorter: a line taken out.
    tail.write(tail.lines, tail.checkpoints.slice(0, 1));
    expect(readTailCheckpointsSince({ root }, tail.id, mark, prev, checkpointHash)).toBeUndefined();
    // Longer, with the line at the mark not the one it was: old lines rewritten under an append.
    const other = new Tail(tail.key);
    other.append(titles(2));
    other.sign(0);
    other.sign(0, 1);
    other.sign(0, 1);
    other.write(tail.lines, other.checkpoints);
    expect(readTailCheckpointsSince({ root }, tail.id, mark, prev, checkpointHash)).toBeUndefined();
  });

  it('takes every line of a file that a mark of nothing meets', () => {
    const tail = new Tail(generateKeyPair());
    tail.append(titles(2));
    tail.sign(0);
    tail.write();
    const since = readTailCheckpointsSince(
      { root },
      tail.id,
      { bytes: 0, lastLineAt: 0, mtimeNs: '' },
      null,
      checkpointHash,
    );
    expect(since?.checkpoints).toHaveLength(1);
  });

  it('names a key folder the disk will not open, and lets one it opens be', () => {
    const tail = new Tail(generateKeyPair());
    tail.write();
    const refused: string[] = [];
    expect(keysTheDiskRefuses({ root }, (error) => refused.push(error.message))).toBe(false);
    if (process.getuid?.() === 0) return;
    chmodSync(join(root, 'keys'), 0o000);
    try {
      expect(keysTheDiskRefuses({ root }, (error) => refused.push(error.message))).toBe(true);
      expect(refused).toEqual([expect.stringContaining('cannot be opened')]);
    } finally {
      chmodSync(join(root, 'keys'), 0o755);
    }
  });
});

describe('a tail cut with its checkpoints, events and all', () => {
  it('withholds nothing, here or elsewhere: a checkout of an earlier commit leaves the same bytes', () => {
    const tail = new Tail(generateKeyPair());
    tail.append(titles(3));
    tail.sign(0);
    const [, end] = tail.append(['t3', 't4']);
    tail.sign(3);
    const note: WrittenHead = {
      seq: (end as Line).seq,
      hash: (end as Line).hash,
      prev: (end as Line).prev,
      coveredThrough: 4,
      checkpoint: checkpointHash(tail.checkpoints[1] as Checkpoint),
      next: null,
    };
    tail.write(tail.lines.slice(0, 3), tail.checkpoints.slice(0, 1));
    expect(fold(tail).withheld).toEqual([]);
    expect(fold(tail, { note }).withheld).toEqual([]);
  });
});

describe('ruleOnCheckpoint', () => {
  it('says the line holds and gives its hash', () => {
    const tail = new Tail(generateKeyPair());
    tail.append(titles(2));
    const checkpoint = tail.sign(0);
    tail.write();
    const read = readTail({ root }, tail.id, catalogUpcasters());
    const ruling = ruleOnCheckpoint({
      tail: tail.id,
      checkpoint,
      prev: null,
      from: 0,
      range: read.entries,
      keys: committedKeys({ root }),
      signature: 'checked',
    });
    expect(ruling).toEqual({ holds: true, hash: checkpointHash(checkpoint) });
  });

  it('refuses a line that does not link to the one before', () => {
    const tail = new Tail(generateKeyPair());
    tail.append(titles(2));
    const checkpoint = tail.sign(0);
    tail.write();
    const ruling = ruleOnCheckpoint({
      tail: tail.id,
      checkpoint,
      prev: 'f'.repeat(64),
      from: 0,
      range: [],
      keys: committedKeys({ root }),
      signature: 'checked',
    });
    expect(ruling).toMatchObject({
      holds: false,
      fault: 'prev',
      detail: 'checkpoint chain break: prev does not link to the previous checkpoint',
    });
  });
});
