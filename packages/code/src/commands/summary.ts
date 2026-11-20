/**
 * What the bare name `mnema` says: a short summary of where this project stands and what is
 * off, with the verbs that come next. A read: it writes nothing and opens no writer.
 *
 * Each fact is read from the record or the machine, and a fact that cannot be read is left
 * out, never replaced by a guess: the summary is a door, and a door that fails would hide the
 * very `--help` it points to.
 */

import type { DiscoveryEnv } from '@mnema/core';
import type { SwitchableChannel } from '../record-framing.js';
import { linkBreakSentences } from '../record-integrity.js';
import { proposalsToReview, type RuleToShow } from './decision-review.js';
import { channelsOff } from './switch.js';

/** What the summary rests on. `waiting` is absent outside a project and where the record cannot be read. */
export interface Summary {
  /** Whether there is a project here. */
  readonly founded: boolean;
  /** How many decisions await a judgement, when it could be read. */
  readonly waiting?: number;
  /**
   * The rules in force this machine's identity did not accept itself and has not been shown
   * (ADR-623), when it could be read: the ones that entered force since its last review, newest
   * first, and how many older ones are left. `lastShown` is absent before the first review, and
   * then nothing is listed one by one.
   */
  readonly notSeen?: {
    readonly since: readonly RuleToShow[];
    readonly older: number;
    readonly lastShown?: string;
  };
  /** The channels that are off on this machine, in the product's order. Empty when they could not be read. */
  readonly off: readonly SwitchableChannel[];
  /** The facts of the parts of the record left out of what was counted, said first: absent when none was. */
  readonly left?: readonly string[];
  /** What could not be read, when something could not: the summary says so and claims nothing about it. */
  readonly unread?: readonly ('record' | 'switches')[];
}

/** Reads the summary for the project at `ctx.cwd`. */
export function summaryHere(ctx: { readonly cwd: string; readonly env: DiscoveryEnv }): Summary {
  let founded = false;
  let waiting: number | undefined;
  let notSeen: Summary['notSeen'];
  let left: readonly string[] = [];
  const unread: ('record' | 'switches')[] = [];
  try {
    const read = proposalsToReview(ctx);
    founded = read.ok;
    if (read.ok) {
      waiting = read.proposals.length;
      const last = read.lastShown;
      const since = last === undefined ? [] : read.toShow.filter((rule) => rule.accepted.at > last);
      // Absent when there is nothing on the list: the summary then says nothing of it.
      if (read.toShow.length > 0) {
        notSeen = {
          since,
          older: read.toShow.length - since.length,
          ...(last !== undefined ? { lastShown: last } : {}),
        };
      }
      // What was read is counted, and what was left out is said first, as `status` says it.
      left = linkBreakSentences(read.linkBreaks);
    }
  } catch {
    // The record could not be read: the summary says that, once, and names `mnema verify`; it does
    // not say the project is not founded.
    unread.push('record');
  }
  let off: readonly SwitchableChannel[] = [];
  try {
    off = channelsOff(ctx);
  } catch {
    // The switches could not be read: nothing is listed, and the summary says that.
    unread.push('switches');
  }
  return {
    founded,
    ...(waiting === undefined ? {} : { waiting }),
    ...(notSeen === undefined ? {} : { notSeen }),
    off,
    ...(left.length === 0 ? {} : { left }),
    ...(unread.length === 0 ? {} : { unread }),
  };
}
