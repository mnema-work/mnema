/**
 * `mnema decision review`: the decisions awaiting a judgement, read for a person to go through
 * one by one.
 *
 * This file is the READ half. It lists what is proposed, in the order `mnema status` lists it
 * (most recently moved first), with the argument each one carries, and it writes nothing: the
 * moves are `runDecisionTransition`'s, called by the wiring once per verdict, so a review has
 * no way into the record that `decision move` does not have (the gate, the key, the state
 * machine and the refusal codes are the same ones).
 */

import { proposedDecisionsNewestFirst, rulesNotSeenBy } from '@mnema/context';
import { type DiscoveryEnv, resolveTrees, type Scope } from '@mnema/core';
import { type AcceptState, acceptStateHere } from '../agent-accepts.js';
import {
  caches,
  linkBreaksOf,
  type ScopedLinkBreak,
  THE_READING_THAT_OPENED_THESE,
  withScopedCaches,
} from '../tree-sources.js';
import { thisMachinesAnchorIn, treeOfAShowing } from './shown.js';

/** One proposed decision, with what a person needs to judge it. */
export interface ProposalToReview {
  readonly id: string;
  readonly adr: string;
  /** The tree that holds it, when it is not the public one: absent is public. */
  readonly scope?: Scope;
  readonly title: string;
  readonly rationale: string;
  readonly alternatives?: string;
}

/** One rule in force the person did not accept themselves, with what a showing of it covers. */
export interface RuleToShow extends ProposalToReview {
  /** The newest accept: who made it, whether an agent was declared, and when. */
  readonly accepted: { readonly who: string; readonly which?: string; readonly at: string };
  /** The entry hashes of every accept of it: what marking it shown covers. */
  readonly moves: readonly string[];
}

/** What is waiting, or why there is nothing to read. */
export type ProposalsToReview =
  | {
      readonly ok: true;
      readonly proposals: readonly ProposalToReview[];
      /**
       * The rules in force this machine's identity did not accept itself and has not been shown,
       * newest accept first (ADR-623): what the review shows after the proposals, marking each.
       */
      readonly toShow: readonly RuleToShow[];
      /** When this identity last marked a rule shown: absent before the first. */
      readonly lastShown?: string;
      /** The tails read that do not chain: what is shown came off a record whose proof is broken. */
      readonly linkBreaks: readonly ScopedLinkBreak[];
      /** Whether an agent may accept: a refusal to review must offer an accept without a terminal only where it is `on`. */
      readonly accepts: AcceptState;
    }
  | { readonly ok: false; readonly reason: 'NO_PROJECT' };

/** Every decision awaiting a judgement in the trees of the project here, newest move first. */
export function proposalsToReview(ctx: {
  readonly cwd: string;
  readonly env: DiscoveryEnv;
}): ProposalsToReview {
  const trees = resolveTrees(ctx.cwd, ctx.env);
  if (trees.projectPublic === undefined) return { ok: false, reason: 'NO_PROJECT' };
  // Asked before the caches open: it reads the key folder and the tree of a showing, never a cache.
  const identity = thisMachinesAnchorIn(trees, treeOfAShowing(trees));
  return withScopedCaches(trees, (sources) => {
    const proposals: ProposalToReview[] = [];
    for (const item of proposedDecisionsNewestFirst(caches(sources))) {
      for (const { cache, scope } of sources) {
        const decision = cache.getDecision(item.id);
        if (decision === null) continue;
        proposals.push({
          id: decision.id,
          adr: decision.adr,
          ...(scope !== 'public' ? { scope } : {}),
          title: decision.title,
          rationale: decision.rationale,
          ...(decision.alternatives !== undefined && decision.alternatives !== ''
            ? { alternatives: decision.alternatives }
            : {}),
        });
        break;
      }
    }
    const notSeen = rulesNotSeenBy(caches(sources), identity ?? '');
    const toShow: RuleToShow[] = [];
    for (const rule of notSeen.rules) {
      for (const { cache } of sources) {
        const decision = cache.getDecision(rule.id);
        if (decision === null) continue;
        toShow.push({
          id: decision.id,
          adr: decision.adr,
          title: decision.title,
          rationale: decision.rationale,
          ...(decision.alternatives !== undefined && decision.alternatives !== ''
            ? { alternatives: decision.alternatives }
            : {}),
          accepted: {
            who: rule.accepted.who,
            ...(rule.accepted.which !== undefined ? { which: rule.accepted.which } : {}),
            at: rule.accepted.at,
          },
          moves: rule.accepts.flatMap((move) => (move.hash === undefined ? [] : [move.hash])),
        });
        break;
      }
    }
    return {
      ok: true,
      proposals,
      toShow,
      ...(notSeen.lastShown !== undefined ? { lastShown: notSeen.lastShown } : {}),
      linkBreaks: linkBreaksOf(sources, THE_READING_THAT_OPENED_THESE),
      accepts: acceptStateHere(sources),
    };
  });
}
