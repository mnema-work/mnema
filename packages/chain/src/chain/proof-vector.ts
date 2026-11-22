/**
 * THE PUBLISHED PROOF OF ONE DECISION (FORMAT.md section 9): `proof-vector.json`, beside FORMAT.md,
 * is a proof built from a small record signed with RFC 8032's first test key, so an implementation
 * of section 9 has a file to check and the bytes to reproduce.
 *
 * The record is one tail of eight lines: a founding, a decision recorded and born, a task (the one
 * range the proof leaves out), the decision's acceptance, a second decision recorded and born, and
 * the supersede of the first by the second. Each act is its own checkpoint range, as this
 * product's writer signs them. Ed25519 is deterministic and every time is fixed, so the file is
 * the same every time this runs, and the test beside it requires the published file to be it.
 */

import {
  decisionBirth,
  decisionTransitioned,
  identityFounded,
  taskCreated,
} from '../events/build.js';
import type { CatalogEvent } from '../events/catalog.js';
import { type Checkpoint, checkpointHash, signCheckpoint } from './checkpoint.js';
import { type Entry, sealEntry } from './entry.js';
import { deriveAnchor } from './keys.js';
import { proveDecision } from './proof.js';
import { recordName } from './record-name.js';
import { vectorKeyPair } from './signed-vectors.js';
import { signTailProof } from './tailproof.js';

/** The decision the published proof is about, and the one that supersedes it. */
export const VECTOR_DECISION = '01a00000-0000-7000-8000-000000000001';
export const VECTOR_SUCCESSOR = '01a00000-0000-7000-8000-000000000002';

/** The published proof's text, built from the code that proves and checks. */
export function proofVector(): string {
  const keyPair = vectorKeyPair();
  const tail = `${keyPair.fingerprint}-${'cd'.repeat(16)}`;
  const record = recordName(tail);
  const who = deriveAnchor(keyPair.fingerprint);
  const at = (minute: number) => `2026-01-01T00:0${minute}:00.000Z`;
  const envelope = (minute: number, subject: string) => ({
    at: at(minute),
    who,
    signerFp: keyPair.fingerprint,
    subject,
  });
  const acts: CatalogEvent[][] = [
    [identityFounded(envelope(0, who), { foundingFp: keyPair.fingerprint })],
    decisionBirth(envelope(1, VECTOR_DECISION), {
      title: 'Keep the record in the repository',
      rationale: 'A clone carries the decisions with the code they are about.',
      adr: 'ADR-1',
      alternatives: 'A server: one more thing to trust and to keep running.',
      initial: 'proposed',
    }),
    [taskCreated(envelope(2, '01a00000-0000-7000-8000-000000000003'), { title: 'Write it down' })],
    [
      decisionTransitioned(envelope(3, VECTOR_DECISION), {
        from: 'proposed',
        to: 'accepted',
        action: 'accept',
        fields: { note: 'Agreed in review.' },
      }),
    ],
    decisionBirth(envelope(4, VECTOR_SUCCESSOR), {
      title: 'Keep the record in the repository, signed',
      rationale: 'A record anyone can rewrite proves nothing.',
      adr: 'ADR-2',
      initial: 'proposed',
    }),
    [
      decisionTransitioned(envelope(5, VECTOR_DECISION), {
        from: 'accepted',
        to: 'superseded',
        action: 'supersede',
        by: VECTOR_SUCCESSOR,
        fields: { reason: 'ADR-2 says the same and signs it.' },
      }),
    ],
  ];
  const entries: Entry[] = [];
  const checkpoints: Checkpoint[] = [];
  for (const act of acts) {
    const fromSeq = entries.length;
    for (const event of act) {
      entries.push(
        sealEntry({
          event,
          tail,
          seq: entries.length,
          prev: entries.at(-1)?.link.hash ?? null,
        }),
      );
    }
    const last = checkpoints.at(-1);
    checkpoints.push(
      signCheckpoint({
        tail,
        fromSeq,
        events: entries.slice(fromSeq).map((entry) => entry.written),
        prev: last === undefined ? null : checkpointHash(last),
        keyPair,
        record,
      }),
    );
  }
  const proved = proveDecision(
    {
      tails: new Map([
        [tail, { entries, checkpoints, tailProof: signTailProof(tail, keyPair, record) }],
      ]),
      key: (fingerprint) => (fingerprint === keyPair.fingerprint ? keyPair.publicKey : undefined),
    },
    VECTOR_DECISION,
  );
  if (!proved.ok) throw new Error(`the vector record does not prove: ${proved.reason}`);
  return proved.text;
}
