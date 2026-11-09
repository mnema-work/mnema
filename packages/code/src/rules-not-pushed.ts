/**
 * The sentence `mnema rules` and `mnema why` owe when a rule governs a path and the channel that
 * hands a rule to an agent at an edit is switched off.
 *
 * Both reads answer which rules stand over a path, and with `edit-rules-push` off the answer is
 * the same as with it on: nothing in it said that those rules are not put in front of an agent
 * when it edits the path. The reads themselves still answer whoever asks; only the push stops.
 */

import { channelIsOn, type ScopedCache } from '@mnema/context';
import { EDIT_PUSH_CHANNEL } from './record-framing.js';

/**
 * The line to print, or undefined: said only where a rule governs the path and the channel is off,
 * since a path no rule governs has nothing that would not have been pushed.
 */
export function rulesNotPushedLine(
  sources: readonly ScopedCache[],
  governing: number,
): string | undefined {
  if (governing < 1 || channelIsOn(sources, EDIT_PUSH_CHANNEL)) return undefined;
  return `${EDIT_PUSH_CHANNEL} is off: ${governing === 1 ? 'the rule that governs' : 'the rules that govern'} this path ${governing === 1 ? 'is' : 'are'} not handed to an agent when it edits there. \`mnema switch on ${EDIT_PUSH_CHANNEL}\` turns the push back on.`;
}
