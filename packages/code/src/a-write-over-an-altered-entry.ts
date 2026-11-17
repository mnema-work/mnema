/**
 * THE DOOR OF THE COMMAND LINE for the refusal of a write while an entry of the record is altered
 * (ADR-396): which verbs it stands in front of, and the question it asks.
 *
 * A verb stands behind it when it declared `mutates` (`record-effect.ts`), the one classification of
 * what can change the record, so a verb added tomorrow is covered by declaring itself. The verbs that
 * declare it and append nothing are named in {@link RUNS_OVER_AN_ALTERED_ENTRY}, each with the reason,
 * and they are the whole of the exceptions.
 *
 * THE QUESTION IS ASKED OF THE FILES, over every tree the verb reaches (the project's public and
 * private trees and the machine's global one), before the verb opens anything for writing: the same
 * reach as a line that cannot be read, which stops every write of the project and, in the global
 * tree, of every project on the machine. A line that cannot be read is not answered here: reading the
 * trees throws it, and the entry makes the refusal it always made (`program.ts`).
 */

import type { ResolvedTrees } from '@mnema/core';
import type { Command } from 'commander';
import type { Declared } from './wiring/verb.js';

/** Verbs that declare they can write and are let through, and why: by their whole path. */
export const RUNS_OVER_AN_ALTERED_ENTRY: Readonly<Record<string, string>> = {
  mcp: 'It serves a connection and appends nothing itself: every tool that writes is stopped at the one door the server opens writes through.',
  'before-a-write':
    'It is the edit gate and answers in the gate’s own voice, a denial the host reads, which names the entry (ADR-395).',
  'tail list': 'It lists the tails and appends nothing.',
  'key restore':
    'It puts a key file back and appends nothing; it is the way out of a refused write.',
  'record pull':
    'It is `git pull` over the record and appends nothing: it is how a restored line arrives.',
  'record merge-tail':
    'It is the merge driver git runs for a tail’s files and appends nothing; refusing it would stop a merge.',
  'commit-hook install': 'It writes a git hook and touches no record.',
  'commit-hook uninstall': 'It removes a git hook and touches no record.',
  'commit-hook suggest': 'It appends a suggestion to a commit message file and touches no record.',
  switch:
    'The bare verb is the listing of the channels: a read, which degrades around the entry (ADR-396).',
  witness:
    'The bare verb says where the proof stands: a read, which degrades around the entry (ADR-396).',
  'key protect': 'It encrypts the private key files and appends nothing.',
  'key unprotect': 'It writes the private key files back in the clear and appends nothing.',
};

/**
 * Invocations that write only with an option, and the option: `inherit set` and `inherit update` print
 * a plan and touch no record unless `--write` is given, and `doctor --fix private-tree` moves tails with
 * signed appends (the verb itself is declared a read, so the declaration alone would not see it).
 */
const WRITES_WHEN: Readonly<Record<string, (opts: Record<string, unknown>) => boolean>> = {
  'inherit set': (opts) => opts.write === true,
  'inherit update': (opts) => opts.write === true,
  doctor: (opts) => opts.fix === 'private-tree' && opts.dryRun !== true,
};

/** The words from the verb the person typed to the one that runs: `task move` for `move` under `task`. */
function pathOf(command: Command): string {
  const words: string[] = [];
  for (let at: Command | null = command; at?.parent != null; at = at.parent)
    words.unshift(at.name());
  return words.join(' ');
}

/** Whether this invocation can change the record, by what its verb, or its member of a group, declared. */
export function canWrite(verbs: readonly Declared[], action: Command): boolean {
  const path = pathOf(action);
  if (path in RUNS_OVER_AN_ALTERED_ENTRY) return false;
  const when = WRITES_WHEN[path];
  if (when !== undefined) return when(action.opts());
  const verb = verbs.find((one) => one.act.name() === path.split(' ')[0]);
  if (verb === undefined) return false;
  if (verb.members === undefined) return verb.effect === 'mutates';
  return verb.members.some((one) => one.act.name() === action.name() && one.effect === 'mutates');
}

/**
 * Throws the refusal when any tree this process reaches holds an altered entry; the question is
 * `an-altered-entry-stops-a-write.ts`, loaded here and not at the top because only a verb that writes
 * asks, and a read must not pay for the record's modules (`the-floor-is-the-declaration.test.ts`).
 */
export async function refuseTheWriteOverAnAlteredEntry(
  trees: ResolvedTrees,
  inMemory: boolean,
): Promise<void> {
  const { checkForAnAlteredEntry } = await import('./an-altered-entry-stops-a-write.js');
  checkForAnAlteredEntry(trees, inMemory);
}
