/**
 * The entry hash of an event the reading placed, kept beside the event rather than inside it.
 *
 * A fold is handed events, and an event does not carry the hash of the entry that holds it: that
 * hash binds the event to its tail and its position (FORMAT.md section 3), which the event's own
 * bytes do not say. One reading needs it all the same: a `decision.seen` names the accepts it
 * covers by entry hash, so the decision fold keeps the hash of every accept it applies, and a
 * showing is matched against those hashes byte for byte.
 *
 * So the merge that places each event (`order.ts`) notes its hash here, keyed by the event object
 * itself, and the fold asks. An event no reading placed (one a caller built and handed to a fold
 * directly) has no hash here, and a fold that asks gets `undefined`: such an accept is one no
 * showing can cover, which is the side that keeps a rule on the list rather than off it.
 */

import type { CatalogEvent } from '@mnema/chain';

const placed = new WeakMap<CatalogEvent, string>();

/** Notes the entry hash the reading found `event` under. */
export function placedAt(event: CatalogEvent, hash: string): void {
  placed.set(event, hash);
}

/** The entry hash the reading found `event` under, or undefined for an event no reading placed. */
export function entryHashOf(event: CatalogEvent): string | undefined {
  return placed.get(event);
}
