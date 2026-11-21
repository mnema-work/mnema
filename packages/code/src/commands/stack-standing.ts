import { catalogUpcasters } from '@mnema/chain';
import { orderedEvents } from '@mnema/core';

/**
 * The stacks a tree's record stands on, each with the version of its last adoption. It serves around
 * a part of the record this mnema cannot read, as the brief it is asked for does: the part is named by
 * the facts that answer opens with.
 */
export function standingIn(root: string): Map<string, string> {
  const standing = new Map<string, string>();
  for (const event of orderedEvents({ root }, catalogUpcasters(), true)) {
    if (event.kind === 'stack.adopted') standing.set(event.subject, event.payload.version);
    else if (event.kind === 'stack.removed') standing.delete(event.subject);
  }
  return standing;
}
