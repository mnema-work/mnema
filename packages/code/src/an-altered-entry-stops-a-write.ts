/**
 * THE QUESTION BEHIND THE REFUSAL OF A WRITE OVER AN ALTERED ENTRY (ADR-396), asked of the files before a
 * door opens anything for writing: the command line's (`a-write-over-an-altered-entry.ts`) and the SDK's.
 * The agent's server asks it of the connection's own caches (`mcp/session.ts`).
 *
 * Over every tree the caller reaches (the project's public and private trees and the machine's global
 * one), the same reach as a line that cannot be read. Over the cache the tree keeps, as a read of the
 * project does: a warm one costs a stat, and the replay and the refresh check each line's hash.
 * It is asked where a writer is about to open, so what it leaves (the cache file a read of the project
 * leaves too) is left by a write that is going to be made. A tree with no files is not opened: asking
 * would make one.
 *
 * ONE TREE AT A TIME, so a line that cannot be read in one is not a reason to leave another unasked:
 * that line is not answered here (the verb meets it and refuses as it always did), and an altered entry
 * in any other tree still is. A gap or a fork is not read here: it is told, never refused.
 *
 * ITS LIMITS, said where the reads say theirs: it is a check and then an append, and an alteration made
 * between the two is not seen, because the writer does not read the hash of the lines it resumes from. And it
 * asks the cache the tree keeps, so it has the cache's limit: an entry rewritten to the same size with its
 * modification time put back is not seen by a warm one, and the write goes through.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { catalogUpcasters, UnreadableLineError, verifyChain } from '@mnema/chain';
import { type DiscoveryEnv, type ResolvedTrees, reachableTrees, resolveTrees } from '@mnema/core';
import type { ScopedLinkBreak } from './record-integrity.js';
import {
  linkBreaksOf,
  THE_READING_THAT_OPENED_THESE,
  withOpenedCaches,
  withTreesRead,
} from './tree-sources.js';
import { AlteredEntryError, refuseWhileAltered } from './what-a-write-meets.js';

/**
 * THE ENTRIES A DIRECTORY OF TAILS OF SEVERAL RECORDS HOLDS ALTERED. Every reading of such a directory
 * reads no tail (`tailsReadAt`), so the cache sees no entry at all and leaves none out: the question
 * above would find nothing in the very directory `tail relink` writes into. The chain's own check is
 * asked instead, over every tail, and a write is refused over what it says is not what was written:
 * an entry whose hash does not hold or that does not link to the one before it (named by its line,
 * found by the seq the issue names), and a checkpoint that does not verify (a bad signature, a broken
 * link between checkpoints). What is only a fact about the directory (two records, a key without a
 * tail) is not a reason here.
 */
function alteredBesideSeveralRecords(
  scope: ScopedLinkBreak['scope'],
  chainRoot: string,
): ScopedLinkBreak[] {
  const verdict = verifyChain({ root: chainRoot }, catalogUpcasters());
  const facts: ScopedLinkBreak[] = [];
  let checkpoint: AlteredEntryError | undefined;
  for (const issue of verdict.issues) {
    if (issue.tail === undefined) continue;
    if (issue.layer === 'T1' && issue.seq !== undefined) {
      facts.push({
        scope,
        tail: issue.tail,
        seq: issue.seq,
        detail: issue.detail,
        retained: lineOf(chainRoot, issue.tail, issue.seq, issue.detail),
      });
    } else if (CHECKPOINT_THAT_DOES_NOT_HOLD.some((start) => issue.detail.startsWith(start))) {
      // An entry that was altered fails its checkpoint too: the entry is the sentence, the checkpoint what is left.
      checkpoint ??= new AlteredEntryError(
        `Nothing was done: the ${scope} record holds a checkpoint that does not verify, and a write would sign over a record that no longer proves itself.\n\n` +
          `issue [${issue.layer}] ${scope} ${issue.tail}: ${issue.detail}\n\n` +
          'Every write in the project is refused until the record is as it was written.',
      );
    }
  }
  if (facts.length === 0 && checkpoint !== undefined) throw checkpoint;
  return facts;
}

/** How the issues of a checkpoint that does not hold begin (`verify.ts`). */
const CHECKPOINT_THAT_DOES_NOT_HOLD = [
  'checkpoint failed',
  'checkpoint chain break',
  'public key for',
];

/** The segment and the line of the entry of `tail` that holds `seq`, as the sentence names them. */
function lineOf(
  chainRoot: string,
  tail: string,
  seq: number,
  detail: string,
): { segment: string; line: number } {
  const dir = join(chainRoot, 'tails', tail);
  for (const segment of readdirSync(dir)
    .filter((name) => /^\d+\.jsonl$/.test(name))
    .sort()) {
    const lines = readFileSync(join(dir, segment), 'utf-8').split('\n');
    for (const [at, text] of lines.entries()) {
      try {
        const held = JSON.parse(text) as { link?: { seq?: number } };
        if (held.link?.seq === seq) return { segment, line: at + 1 };
      } catch {
        // A line that does not parse is not the entry asked for.
      }
    }
  }
  throw new AlteredEntryError(
    `Nothing was done: tail ${tail} holds an entry at seq ${seq} that is not what was written (${detail}), and the line that holds it could not be found.`,
  );
}

/** What the sources say, and what a directory of several records hides from them. */
function breaksOf(sources: Parameters<typeof linkBreaksOf>[0]): readonly ScopedLinkBreak[] {
  const hidden = sources
    .filter((source) => source.cache.severalRecords().length > 0)
    .flatMap((source) => alteredBesideSeveralRecords(source.scope, source.chainRoot));
  return [...linkBreaksOf(sources, THE_READING_THAT_OPENED_THESE), ...hidden];
}

/** Throws {@link AlteredEntryError} when any tree of `trees` holds an altered entry. */
export function checkForAnAlteredEntry(trees: ResolvedTrees): void {
  const reached = reachableTrees(trees).filter((one) => existsSync(one.chainRoot));
  const facts = reached.flatMap((tree) => {
    try {
      // The machine's global tree keeps no cache for a project's verb: a refusal there leaves it as it
      // found it, so that tree is replayed in memory (it is the small one).
      if (tree.scope === 'global') {
        return withTreesRead([tree], (read) => breaksOf(read));
      }
      return withOpenedCaches(trees, (open, opened) => {
        open(tree.scope);
        return breaksOf(opened);
      });
    } catch (error) {
      if (error instanceof UnreadableLineError) return [];
      throw error;
    }
  });
  refuseWhileAltered(facts);
}

/**
 * The refusal as the library's callers (the SDK) read one, or `undefined` when the write may go on:
 * the shape of every other refusal a library write returns.
 */
export function refusedOverAnAlteredEntry(here: {
  readonly cwd: string;
  readonly env: DiscoveryEnv;
}):
  | {
      readonly ok: false;
      readonly reason: 'REFUSED';
      readonly code: string;
      readonly message: string;
    }
  | undefined {
  try {
    checkForAnAlteredEntry(resolveTrees(here.cwd, here.env));
    return undefined;
  } catch (error) {
    if (error instanceof AlteredEntryError) {
      return { ok: false, reason: 'REFUSED', code: error.code, message: error.message };
    }
    throw error;
  }
}
