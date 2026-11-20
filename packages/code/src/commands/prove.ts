/**
 * `mnema prove <decision> [--out <file>] [--private]` and `mnema prove --check <file>`: the proof of
 * one decision, as one file a stranger checks offline (FORMAT.md section 9).
 *
 * THE PROOF IS THE CHAIN'S. What goes in the file, in what order, and what a checker refuses are
 * `@mnema/chain`'s (`proveDecision`, `checkProof`), and the second reader beside FORMAT.md checks
 * the same file from the format alone. This verb only finds the decision, says which tree it is
 * in, refuses a record the product calls broken, and hands the file over.
 *
 * A PRIVATE DECISION IS REFUSED UNLESS IT IS ASKED FOR. The private tree is this machine's and no
 * clone carries it; a proof of one of its decisions hands its lines, and the lines beside them in
 * the same signed ranges, to whoever receives the file. So a decision found only there is refused,
 * by name, until the caller says `--private`.
 *
 * Read-only: it reads the tails of one tree, opens no writer and appends nothing. `--check` reads
 * nothing but the file it is given, and needs no project.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import {
  catalogUpcasters,
  checkProof,
  holdsRecord,
  type ProofManifest,
  type ProofVerdict,
  proveDecision,
  recordToProve,
  verifyChain,
  WHAT_A_PROOF_DOES_NOT_COVER,
} from '@mnema/chain';
import { chainRootForScope, type DiscoveryEnv, resolveTrees } from '@mnema/core';
import { resolveAddress } from '../label-as-address.js';

/** What the prove command needs: injected so it is testable. */
export interface ProveContext {
  readonly cwd: string;
  readonly env: DiscoveryEnv;
}

/** A proof built: its text, the claim it carries, and the tree it came from. */
export interface ProveDone {
  readonly ok: true;
  readonly text: string;
  readonly manifest: ProofManifest;
  readonly scope: 'public' | 'private';
}

/** Why no proof was built. */
export type ProveRefused =
  | { readonly ok: false; readonly reason: 'NO_PROJECT' }
  | { readonly ok: false; readonly reason: 'NO_SUCH_DECISION'; readonly typed: string }
  | { readonly ok: false; readonly reason: 'AMBIGUOUS_LABEL'; readonly message: string }
  | { readonly ok: false; readonly reason: 'PRIVATE_DECISION'; readonly id: string }
  | { readonly ok: false; readonly reason: 'RECORD_BROKEN'; readonly scope: string }
  | {
      readonly ok: false;
      readonly reason: 'NOT_YET_SIGNED';
      readonly tail: string;
      readonly seq: number;
    }
  | { readonly ok: false; readonly reason: 'NO_TAIL_PROOF'; readonly tail: string }
  | { readonly ok: false; readonly reason: 'READS_OTHERWISE' };

/** Builds the proof of one decision of this project's record. */
export function runProve(
  ctx: ProveContext,
  input: { readonly decision: string; readonly private: boolean },
): ProveDone | ProveRefused {
  const trees = resolveTrees(ctx.cwd, ctx.env);
  if (trees.projectPublic === undefined) return { ok: false, reason: 'NO_PROJECT' };
  const named = resolveAddress(ctx, input.decision);
  if (!named.ok) return { ok: false, reason: 'AMBIGUOUS_LABEL', message: named.message };
  const upcasters = catalogUpcasters();

  for (const scope of ['public', 'private'] as const) {
    const root = chainRootForScope(trees, scope);
    if (root === undefined || !holdsRecord({ root })) continue;
    const record = recordToProve({ root }, upcasters);
    const holds = [...record.tails.values()].some(({ entries }) =>
      entries.some(
        ({ event }) =>
          event.subject === named.id &&
          (event.kind === 'decision.recorded' || event.kind === 'decision.transitioned'),
      ),
    );
    if (!holds) continue;
    if (scope === 'private' && !input.private) {
      return { ok: false, reason: 'PRIVATE_DECISION', id: named.id };
    }
    // A proof is handed out as the record's word: none is built from a record this product
    // calls broken, whatever the lines the proof would carry say on their own.
    if (!verifyChain({ root }, upcasters, { keyRoot: trees.keyRoot }).ok) {
      return { ok: false, reason: 'RECORD_BROKEN', scope };
    }
    const proved = proveDecision(record, named.id, upcasters);
    if (!proved.ok) {
      if (proved.reason === 'NO_SUCH_DECISION') {
        return { ok: false, reason: 'NO_SUCH_DECISION', typed: input.decision };
      }
      return proved;
    }
    return { ok: true, text: proved.text, manifest: proved.manifest, scope };
  }
  return { ok: false, reason: 'NO_SUCH_DECISION', typed: input.decision };
}

/** What checking a proof file found: the verdict, or why the file could not be read. */
export type ProveChecked =
  | {
      readonly ok: true;
      readonly verdict: ProofVerdict;
      /** What a proof does not prove, in the chain's words: said beside every proof accepted. */
      readonly notCovered: readonly string[];
    }
  | { readonly ok: false; readonly reason: 'UNREADABLE_PROOF'; readonly message: string };

/** Checks the proof in `file`, reading nothing else. */
export function runProveCheck(file: string): ProveChecked {
  let text: string;
  try {
    // Strict UTF-8: a byte that is not one is refused, never read as U+FFFD (FORMAT.md section 4).
    text = new TextDecoder('utf-8', { fatal: true }).decode(readFileSync(file));
  } catch (error) {
    return { ok: false, reason: 'UNREADABLE_PROOF', message: (error as Error).message };
  }
  return { ok: true, verdict: checkProof(text), notCovered: WHAT_A_PROOF_DOES_NOT_COVER };
}

/** Writes a proof to `file`, refusing a file that is already there rather than replacing it. */
export function writeProofFile(
  file: string,
  text: string,
):
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: 'PROOF_NOT_WRITTEN'; readonly message: string } {
  try {
    writeFileSync(file, text, { flag: 'wx' });
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: 'PROOF_NOT_WRITTEN', message: (error as Error).message };
  }
}
