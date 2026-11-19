/**
 * EVERY READER OF THE TAILS SAYS WHETHER IT READS WHAT IS PROVEN OR THE BYTES AS WRITTEN.
 *
 * Only what a checkpoint (or this machine's signed note) proves governs (ADR-561): the projection
 * folds the proven events alone, so the gate, the switches, the roster, the brief and every read
 * that opens a cache read them by construction. That is true of a reader only if it reaches the
 * tails through the bridge that folds them (`chainReplay`, `chainArrivals`, `orderedEvents`,
 * `orderedEventsOfRecord`, `@mnema/core`). A reader that calls `readTail`, `readTailEntries`,
 * `readTailTip` or `readTailSince` itself reads the bytes as written, unproven events included, and
 * that is right only for a reader that rules on them the way `verify` does, or that prepares a write
 * and serves nothing.
 *
 * So the discriminant is the name of each of those functions in the source of every package, and
 * every file that names one is in {@link READERS} with what it is and why. A reader added next year
 * is classified here or this file is red, and a reader that left is taken out or this file is red.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { codeOnly, sourceFiles } from './support/reading-source.js';

const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));

/** What a file does with the tails it names. */
type Reads =
  /** Reaches the tails through the bridge that folds the checkpoints: only proven events. */
  | 'proven'
  /** Reads the bytes as written: it rules on them as `verify` does, or prepares a write and serves nothing. */
  | 'as written'
  /** Is the bridge or the reader itself, or only hands the bridge on. */
  | 'the reading';

const READERS: Readonly<Record<string, { readonly reads: Reads; readonly why: string }>> = {
  // The chain: the readers themselves, the verdict, and the writer's own machinery.
  'packages/chain/src/chain/store.ts': { reads: 'the reading', why: 'it defines the readers' },
  'packages/chain/src/chain/verify.ts': {
    reads: 'as written',
    why: 'it is the verdict: every line, every checkpoint, every signature',
  },
  'packages/chain/src/chain/writer.ts': {
    reads: 'as written',
    why: 'it resumes its own tail from the tip and signs only under an end its signed note vouches for',
  },
  'packages/chain/src/chain/pool.ts': {
    reads: 'as written',
    why: 'it chooses which tail a write continues (one this machine’s note wrote) and serves nothing',
  },
  'packages/chain/src/chain/citation-index.ts': {
    reads: 'as written',
    why: 'it indexes the heads a writer cites; a citation names bytes, proven or not, and decides no rule',
  },
  'packages/chain/src/chain/relink-plan.ts': {
    reads: 'as written',
    why: 'it plans `tail relink` over the tails as stored, after the checkpoints that name them are checked',
  },
  'packages/chain/src/chain/waiver.ts': {
    reads: 'as written',
    why: 'it reads the tails a cut would leave, to write a waiver; it serves nothing',
  },
  'packages/chain/src/index.ts': { reads: 'the reading', why: 'it exports the readers' },
  // The core: the bridge, and the policy readers that go through it.
  'packages/core/src/projections/order.ts': {
    reads: 'the reading',
    why: 'it IS the bridge: it folds each tail’s checkpoints and hands on proven events only',
  },
  'packages/core/src/projections/cache.ts': {
    reads: 'proven',
    why: 'the projection: replays and catch-ups through the bridge',
  },
  'packages/core/src/projections/cache-meta.ts': {
    reads: 'proven',
    why: 'it keeps the frontier and the facts the bridge produced',
  },
  'packages/core/src/projections/advance.ts': {
    reads: 'proven',
    why: 'it folds the arrivals the bridge handed on',
  },
  'packages/core/src/projections/divergent-moves.ts': {
    reads: 'proven',
    why: 'it judges the order the bridge handed on',
  },
  'packages/core/src/projections/reference-store.ts': {
    reads: 'proven',
    why: 'it indexes the order the bridge handed on',
  },
  'packages/core/src/index.ts': { reads: 'the reading', why: 'it exports the bridge' },
  'packages/core/src/checks/checkers.ts': {
    reads: 'proven',
    why: 'which keys are checkers: a policy, read through `orderedEvents`',
  },
  'packages/core/src/checks/operations.ts': {
    reads: 'proven',
    why: 'which checks are declared and run: a policy, read through `orderedEvents`',
  },
  'packages/core/src/identity/founded-beside.ts': {
    reads: 'proven',
    why: 'which identities were founded: read through `orderedEvents`',
  },
  'packages/core/src/identity/membership.ts': {
    reads: 'proven',
    why: 'the roster a write checks its key against: read through `orderedEvents`',
  },
  'packages/core/src/identity/roster.ts': {
    reads: 'proven',
    why: 'the keys and members of the record: read through `orderedEvents`',
  },
  'packages/core/src/knowledge/operations.ts': {
    reads: 'proven',
    why: 'whether a record or a link stands before it is retracted: read through `orderedEvents`',
  },
  'packages/core/src/topology/index.ts': {
    reads: 'the reading',
    why: 'it only names the bridge in its documentation',
  },
  'packages/core/src/topology/locate.ts': {
    reads: 'as written',
    why: 'it finds which tree holds an entity or a tail, to route a write there; the write then reads the proven projection',
  },
  'packages/core/src/workflow/identity-operations.ts': {
    reads: 'proven',
    why: 'the enrolments a write checks: read through `orderedEvents`',
  },
  'packages/core/src/workflow/prune-operations.ts': {
    reads: 'as written',
    why: 'it authorizes a cut by what the tails hold, as `verify` reads them, and serves nothing',
  },
  'packages/core/src/workflow/stack-operations.ts': {
    reads: 'proven',
    why: 'whether a stack is adopted: read through `orderedEvents`',
  },
  // The context: what an agent is handed of the record.
  'packages/context/src/intelligence/antipatterns.ts': {
    reads: 'proven',
    why: 'it reads the order `orderedEventsOfRecord` hands on, which folds each chain',
  },
  'packages/context/src/intelligence/events.ts': {
    reads: 'proven',
    why: 'it reads the order `orderedEventsOfRecord` hands on, which folds each chain',
  },
  // The code: the surfaces.
  'packages/code/src/tree-sources.ts': {
    reads: 'proven',
    why: 'every cache a read opens, and the birth probe, through the bridge',
  },
  'packages/code/src/intelligence-source.ts': {
    reads: 'proven',
    why: 'the audit tools’ order: `orderedEvents` and `orderedEventsOfRecord`',
  },
  'packages/code/src/record-integrity.ts': {
    reads: 'the reading',
    why: 'it words the facts the bridge produced and names a reader only in its documentation',
  },
  'packages/code/src/mcp/locate.ts': {
    reads: 'proven',
    why: 'which tree holds a record, through `orderedEvents`',
  },
  'packages/code/src/commands/key-request.ts': {
    reads: 'proven',
    why: 'the agent keys enrolled, through `orderedEvents`',
  },
  'packages/code/src/commands/site.ts': {
    reads: 'proven',
    why: 'the record page, through `orderedEvents`',
  },
  'packages/code/src/site/browser/check.ts': {
    reads: 'proven',
    why: 'the page the browser check renders, through `orderedEvents`',
  },
  'packages/code/src/commands/stack-install.ts': {
    reads: 'proven',
    why: 'which stacks are adopted, through `orderedEvents`',
  },
  'packages/code/src/commands/stack-standing.ts': {
    reads: 'proven',
    why: 'where a stack stands, through `orderedEvents`',
  },
  'packages/code/src/commands/verify.ts': {
    reads: 'proven',
    why: 'the agent keys named beside the verdict, through `orderedEvents`; the verdict itself is the chain’s',
  },
  'packages/code/src/commands/doctor.ts': {
    reads: 'as written',
    why: 'it counts the lines a newer mnema wrote, in a checklist about the machine, and serves no content',
  },
  'packages/code/src/commands/record-commit.ts': {
    reads: 'as written',
    why: 'it cuts the public tree after `verify` at the signed level ruled on it',
  },
  'packages/code/src/commands/verify-github.ts': {
    reads: 'as written',
    why: 'it runs after the verdict, over the trees it ruled on',
  },
  'packages/code/src/commands/verify-sigstore.ts': {
    reads: 'as written',
    why: 'it runs after the verdict, over the trees it ruled on',
  },
  'packages/code/src/commands/witness.ts': {
    reads: 'as written',
    why: 'it refuses a tree below fully signed by the verdict, and reads only identities of the events',
  },
  'packages/code/src/repl/following.ts': {
    reads: 'as written',
    why: 'it reports what another process appended and rules on nothing; the corner asks the verdict',
  },
};

/** The names a file reaches the tails by: the four readers and the bridge. */
const NAMES =
  /\b(readTail|readTailSince|readTailEntries|readTailTip|orderedEvents|orderedEventsOfRecord|chainReplay|chainArrivals)\b/;

/** The source files of every package that name a reader of the tails, tests and fixtures aside. */
function readersInTheSource(): string[] {
  const packages = join(REPO_ROOT, 'packages');
  return readdirSync(packages, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => {
      try {
        return sourceFiles(join(packages, entry.name, 'src'));
      } catch {
        return [];
      }
    })
    .map((path) => relative(REPO_ROOT, path).split('\\').join('/'))
    .filter((path) => !path.includes('/__fixtures__/'))
    .filter((path) => NAMES.test(readFileSync(join(REPO_ROOT, path), 'utf-8')))
    .sort();
}

describe('every reader of the tails is classified', () => {
  it('classifies every file that names a reader, and no file that does not', () => {
    expect(Object.keys(READERS).sort()).toEqual(readersInTheSource());
  });

  it('reads the bytes as written only where the reason says it rules or serves nothing', () => {
    for (const [path, { reads }] of Object.entries(READERS)) {
      if (reads !== 'proven') continue;
      // A policy reader reaches the tails only through the bridge.
      const text = codeOnly(readFileSync(join(REPO_ROOT, path), 'utf-8'));
      expect(
        /\b(readTail|readTailSince|readTailEntries|readTailTip)\(/.test(text),
        `${path} calls a reader of the bytes as written`,
      ).toBe(false);
    }
  });
});
