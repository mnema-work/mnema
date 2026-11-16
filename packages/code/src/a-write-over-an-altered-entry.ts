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

import { existsSync } from 'node:fs';
import { type ResolvedTrees, reachableTrees } from '@mnema/core';
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
  'key request': 'It prints the line a member enrolls and appends nothing.',
  'key protect': 'It encrypts the private key files and appends nothing.',
  'key unprotect': 'It writes the private key files back in the clear and appends nothing.',
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
  const verb = verbs.find((one) => one.act.name() === path.split(' ')[0]);
  if (verb === undefined) return false;
  if (verb.members === undefined) return verb.effect === 'mutates';
  return verb.members.some((one) => one.act.name() === action.name() && one.effect === 'mutates');
}

/**
 * Throws the refusal when any tree this process reaches holds an altered entry. A tree with no files
 * is not opened (asking would make one), and the caches are the ones every read of the project keeps.
 */
export async function refuseTheWriteOverAnAlteredEntry(trees: ResolvedTrees): Promise<void> {
  const reached = new Set(
    reachableTrees(trees)
      .filter((one) => existsSync(one.chainRoot))
      .map((one) => one.scope),
  );
  if (reached.size === 0) return;
  // Loaded here, not at the top: only a verb that writes asks, and a read does not pay for the
  // record's modules to be read twice (`the-floor-is-the-declaration.test.ts`).
  const { linkBreaksOf, SCOPES, THE_READING_THAT_OPENED_THESE, withOpenedCaches } = await import(
    './tree-sources.js'
  );
  const { refuseWhileAltered } = await import('./what-a-write-meets.js');
  const facts = withOpenedCaches(trees, (open, opened) => {
    for (const scope of SCOPES) if (reached.has(scope)) open(scope);
    return linkBreaksOf(opened, THE_READING_THAT_OPENED_THESE);
  });
  refuseWhileAltered(facts);
}
