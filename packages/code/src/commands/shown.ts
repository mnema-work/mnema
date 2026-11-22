/**
 * The rules in force a person did not accept themselves, and the fact that one was shown to them
 * (`decision.seen`, ADR-606 and ADR-623): the read bare `mnema` and `decision review` share, and the
 * write `decision review` and an accept at a terminal make.
 *
 * WHERE A SHOWING LANDS. In the project's PRIVATE tree, never the committed one: it serves the person
 * shown and no teammate, and in the committed tree it would publish what each person read and stop
 * every older reader on every page it names. Outside a project there is one tree, the global one.
 * So a showing does not travel to another clone or machine of the same person: there the list is
 * read as if nothing had been shown.
 *
 * WHO IS SHOWN. The identity this machine writes as in the tree the showings land in, asked as
 * `status` asks it, without minting a key: a machine with no key has shown nothing to anybody.
 */

import { catalogUpcasters, listPrivateKeyFingerprints } from '@mnema/chain';
import { chainRootForScope, type ResolvedTrees, type Scope } from '@mnema/core';
import {
  authorizingAnchor,
  openTreeForWriting,
  recordDecisionSeen,
  recordedAnchorOf,
  signerFor,
} from '@mnema/core/write';

/** The tree a showing is written in: the project's private tree, or the global one outside a project. */
export function treeOfAShowing(trees: ResolvedTrees): Scope {
  return trees.projectPublic !== undefined ? 'private' : 'global';
}

/**
 * The identity THIS MACHINE writes as in the tree `scope` names, or undefined when the machine has
 * no key. A READ: a machine with no private key of its own is answered `undefined` before a signer
 * is asked for, because asking a signer for a machine without a key mints one.
 */
export function thisMachinesAnchorIn(trees: ResolvedTrees, scope: Scope): string | undefined {
  if (listPrivateKeyFingerprints({ root: trees.keyRoot }).length < 1) return undefined;
  const root = chainRootForScope(trees, scope);
  if (root === undefined) return undefined;
  const asked = {
    writer: signerFor(trees, scope),
    layout: { root },
    upcasters: catalogUpcasters(),
  };
  return recordedAnchorOf(asked)?.anchor ?? authorizingAnchor(asked);
}

/**
 * Writes that `decision` was shown, covering `moves` (the entry hashes of its accepts), in the
 * tree of a showing, signed and checkpointed at once. Refused, with nothing written, for an act
 * that is not a person's at a terminal (`SEEN_NEEDS_A_PERSON`, the core's rule).
 */
export function markShown(
  trees: ResolvedTrees,
  input: {
    readonly decision: string;
    readonly moves: readonly string[];
    readonly atATerminal: boolean;
    readonly run?: string;
  },
): { readonly ok: true } | { readonly ok: false; readonly code: string; readonly message: string } {
  const scope = treeOfAShowing(trees);
  const root = chainRootForScope(trees, scope) as string;
  const writer = openTreeForWriting(trees, scope);
  const written = writer.exclusively(() => {
    const result = recordDecisionSeen(
      { writer, layout: { root }, upcasters: catalogUpcasters() },
      input,
    );
    if (result.ok) writer.checkpoint();
    return result;
  });
  return written.ok ? { ok: true } : { ok: false, code: written.code, message: written.message };
}
