/**
 * How a decision's `ADR-<n>` label is READ where a person sees it: the one function that says
 * which tree it is from.
 *
 * Each tree numbers its own decisions, so the public `ADR-78` and a private `ADR-78` are two
 * different decisions that read the same. The label the record froze is never touched (it is what
 * a trailer cites and what a lookup by label takes); only the reading carries the tree after it,
 * as `ADR-78 (private)` or `ADR-78 (global)`. The public tree, the one a bare label has always
 * meant, and a reading that names no tree print the label as it is.
 */

import type { Scope } from '@mnema/core';

/** The label as it is read: `ADR-78`, or `ADR-78 (private)` for a decision held outside the public tree. */
export function readLabel(adr: string, scope?: Scope): string {
  return scope === undefined || scope === 'public' ? adr : `${adr} (${scope})`;
}
