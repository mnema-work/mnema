/**
 * THE DOOR OF THE COMMAND LINE for the refusal of a write while an entry of the record is altered
 * (ADR-396): which invocations it stands behind, and how it is armed.
 *
 * IT STANDS AT THE WRITER, NOT AT THE VERB. The question is asked where a tree is opened for writing
 * (`guardWrites`, in the core: the one door every write to a tree opens through), so an invocation
 * that never opens a writer is never asked and an invocation added tomorrow is asked without knowing.
 * That is what keeps a read, the listing a group answers when typed bare, a plan printed without
 * `--write`, the verbs that only touch key files and `record pull` (the way a restored line arrives)
 * answering over an altered entry: reading degrades (ADR-396). It also keeps a write that is refused
 * for its own reasons, or reports a plan, from leaving anything behind: asking waits for the writer.
 *
 * Armed before a verb runs, with the question loaded only for a verb that can write: the ones that
 * declared `mutates` (`record-effect.ts`), and the verbs of {@link OPEN_A_WRITER_AS_READS}.
 */

import { guardWrites, type ResolvedTrees } from '@mnema/core';
import type { Command } from 'commander';
import type { Declared } from './wiring/verb.js';

/** Invocations that are not stood behind, and why: by their whole path. */
export const RUNS_OVER_AN_ALTERED_ENTRY: Readonly<Record<string, string>> = {
  mcp: 'It serves a connection and opens no writer itself: every tool that writes is stopped at the one door the server opens writes through, and the end of a run with it.',
  'before-a-write':
    'It is the edit gate and answers in the gate’s own voice, a denial the host reads, which names the entry (ADR-395).',
  'tail repair':
    'It is the write that mends an altered or unreadable line (ADR-398): it opens no writer and signs nothing, and everything else stays stopped at the writer.',
};

/**
 * Verbs declared reads that open a writer for one of their options: `doctor --fix private-tree` moves
 * tails with signed appends. They are armed as the verbs that write are.
 */
export const OPEN_A_WRITER_AS_READS: readonly string[] = ['doctor'];

/**
 * Invocations that act on the record without opening a writer, and are asked before they run:
 * `key request --agent` makes key files and moves a retired key aside, on what an enrollment or a
 * revocation line says, which an altered line leaves out of the order; the three of `witness` file an
 * outside witness's attestation beside the checkpoints of the tails they read.
 */
export const ASK_BEFORE_THEY_RUN: readonly string[] = [
  'key request',
  'witness stamp',
  'witness upgrade',
  'witness sigstore',
];

/** The words from the verb the person typed to the one that runs: `task move` for `move` under `task`. */
function pathOf(command: Command): string {
  const words: string[] = [];
  for (let at: Command | null = command; at?.parent != null; at = at.parent)
    words.unshift(at.name());
  return words.join(' ');
}

/** Whether the question is to be loaded and asked at the writers this invocation opens. */
export function armsTheDoor(verbs: readonly Declared[], action: Command): boolean {
  const path = pathOf(action);
  if (path in RUNS_OVER_AN_ALTERED_ENTRY) return false;
  const top = path.split(' ')[0] as string;
  const verb = verbs.find((one) => one.act.name() === top);
  return verb?.effect === 'mutates' || OPEN_A_WRITER_AS_READS.includes(top);
}

/** Whether this invocation asks at once, before it runs, and not at a writer. */
export function asksAtOnce(action: Command): boolean {
  return ASK_BEFORE_THEY_RUN.includes(pathOf(action));
}

/**
 * Arms the door for this invocation, or clears it: the question is `an-altered-entry-stops-a-write.ts`.
 * `now` are the trees of an invocation that asks at once.
 */
export async function armTheDoor(armed: boolean, now?: ResolvedTrees): Promise<void> {
  if (!armed && now === undefined) return guardWrites(undefined);
  const { checkForAnAlteredEntry } = await import('./an-altered-entry-stops-a-write.js');
  if (now !== undefined) checkForAnAlteredEntry(now);
  if (!armed) return guardWrites(undefined);
  // Asked once per process: what the process writes itself is not an alteration, and the writers a
  // verb opens one after the other would otherwise ask over the same files each time.
  let asked = false;
  guardWrites((trees) => {
    if (asked) return;
    checkForAnAlteredEntry(trees);
    asked = true;
  });
}
