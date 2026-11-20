/**
 * The rules in force a person did not accept themselves, and has not been shown (ADR-545, ADR-623).
 *
 * WHAT IS ON THE LIST. Every decision in force (the reading {@link decisionsInForce} gives, so a
 * decision two machines moved apart is not here either) that has an accept no showing of THIS
 * identity covers. An accept an agent declared and an accept that declared none are listed alike:
 * an accept with no `which` is "no agent declared" (ADR-608), not a person, because the seat it was
 * made at is not recorded. A person's own accept at a terminal is off the list because the product
 * writes a showing beside it, not because the accept says who made it.
 *
 * WHAT COVERS AN ACCEPT. A `decision.seen` of the decision, signed by this identity with no agent
 * declared, whose `moves` name the accept's entry hash. A decision is off the list only when EVERY
 * accept of it is covered: two machines that accepted one decision without seeing each other leave
 * two accepts, and a showing that saw one of them leaves the decision listed. A showing with an
 * agent on it, by another identity, or naming a hash that is no accept of the decision covers
 * nothing, and is not refused: it is well formed, and this is a reading.
 *
 * WHAT IT IS NOT. Proof that a person read a rule. A showing says that this identity's key signed,
 * with no agent declared, at a terminal; a process an agent opens under a pseudo-terminal passes the
 * same test. The list is a convenience for a person, and nothing here is offered as more.
 *
 * Showings are read from every tree handed in (they land in the private tree, the decisions mostly
 * in the public one), so the caller hands every tree of the project.
 */

import { type AcceptMove, newestFirst, type ProjectionCache } from '@mnema/core';
import { decisionsInForce } from './decisions.js';

/** One rule in force on the list. */
export interface RuleNotSeen {
  readonly id: string;
  readonly adr: string;
  readonly title: string;
  /** The newest accept of it: when it last entered force, by whom, and whether an agent was declared. */
  readonly accepted: AcceptMove;
  /** Every accept of it the fold applied: what a showing of it covers. */
  readonly accepts: readonly AcceptMove[];
}

/** The list for one identity, and when that identity last marked a rule shown. */
export interface NotSeen {
  /** Newest accept first. */
  readonly rules: readonly RuleNotSeen[];
  /**
   * The `at` of the newest showing this identity signed with no agent declared, whatever it
   * covered: absent before the first. It is the cut bare `mnema` lists from.
   */
  readonly lastShown?: string;
}

/** The rules in force `identity` did not accept themselves and has not been shown, across `caches`. */
export function rulesNotSeenBy(caches: readonly ProjectionCache[], identity: string): NotSeen {
  const covered = new Set<string>();
  let lastShown: string | undefined;
  for (const cache of caches) {
    for (const showing of cache.showings()) {
      if (showing.who !== identity || showing.which !== undefined) continue;
      for (const move of showing.moves) covered.add(`${showing.decision}\u0000${move}`);
      if (lastShown === undefined || showing.at > lastShown) lastShown = showing.at;
    }
  }
  const rules: RuleNotSeen[] = [];
  for (const ref of decisionsInForce(caches)) {
    for (const cache of caches) {
      const decision = cache.getDecision(ref.id);
      if (decision === null) continue;
      const accepts = decision.accepts ?? [];
      const unseen = accepts.some(
        (move) => move.hash === undefined || !covered.has(`${decision.id}\u0000${move.hash}`),
      );
      const newest = accepts.reduce<AcceptMove | undefined>(
        (last, move) => (last === undefined || move.at >= last.at ? move : last),
        undefined,
      );
      if (unseen && newest !== undefined) {
        rules.push({
          id: decision.id,
          adr: decision.adr,
          title: decision.title,
          accepted: newest,
          accepts,
        });
      }
      break;
    }
  }
  rules.sort(byNewestAccept);
  return { rules, ...(lastShown !== undefined ? { lastShown } : {}) };
}

/** Newest accept first, by the core's {@link newestFirst}: this names the instant and asks nothing else. */
function byNewestAccept(a: RuleNotSeen, b: RuleNotSeen): number {
  return newestFirst({ at: a.accepted.at, id: a.id }, { at: b.accepted.at, id: b.id });
}
