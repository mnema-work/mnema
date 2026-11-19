/**
 * EVERY READER OF THE TAILS SAYS WHETHER IT READS WHAT IS PROVEN OR THE BYTES AS WRITTEN.
 *
 * Only what a checkpoint (or this machine's signed note) proves governs (ADR-561): the projection
 * folds the proven events alone, so the gate, the switches, the roster, the brief and every read
 * that opens a cache read them by construction. That is true of a reader only if it reaches the
 * tails through the bridge that folds them (`chainReplay`, `chainArrivals`, `orderedEvents`,
 * `orderedEventsOfRecord`, `provenSubjectEvents`, `@mnema/core`). A reader that calls one of the
 * readers of the bytes ({@link RAW}) itself reads them as written, unproven events included, and
 * that is right only for a reader that rules on them the way `verify` does, or that prepares a write
 * and serves nothing.
 *
 * THE LIST OF READERS OF THE BYTES WAS SHORT TWICE. It named the four `readTail*` functions, and the
 * gate's own reading of a subject (`subjectEvents`, under `standing`) reached the tails beside them:
 * one forged line in a write's window refused an accept the record allows. It now names every
 * function of `@mnema/chain` that hands on what a segment's lines say: the tail readers, the search
 * by subject, the segment listing, the parse of one line and the readers from the end that go
 * through it, the tail's standing, the damage a writer reads before it resumes, what arrived since
 * a commit, and the first lines a record's name is derived from.
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

/**
 * A file's class, and why. `besides` names the readers of the bytes a `proven` file calls for
 * something that reads no event (a listing of segment files, the damage a writer would meet), each
 * with its reason: the call is allowed there and nowhere else.
 */
interface Classified {
  readonly reads: Reads;
  readonly why: string;
  readonly besides?: Readonly<Partial<Record<(typeof RAW)[number], string>>>;
}

const READERS: Readonly<Record<string, Classified>> = {
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
  'packages/chain/src/chain/entry.ts': {
    reads: 'the reading',
    why: 'it defines the parse of one line',
  },
  'packages/chain/src/chain/lines.ts': {
    reads: 'the reading',
    why: 'it defines how a stored line is split, read from the end and handed to a parse',
  },
  'packages/chain/src/events/parse.ts': {
    reads: 'the reading',
    why: 'it parses an event and names the line parse only in its documentation',
  },
  'packages/chain/src/chain/subject-events.ts': {
    reads: 'the reading',
    why: 'it is the search by subject; which lines a signature proves is its caller’s question, the bridge’s',
  },
  'packages/chain/src/chain/freshness.ts': {
    reads: 'as written',
    why: 'it takes the extent of each tail (its last segment, size and time) and reads no event',
  },
  'packages/chain/src/chain/tail-names.ts': {
    reads: 'as written',
    why: 'it names the record from the first lines of its tails, as `verify` does, and serves no event',
  },
  'packages/chain/src/chain/tail-repair.ts': {
    reads: 'as written',
    why: 'it is `tail repair`: it rules on each line and each checkpoint as `verify` does and puts back what git committed and what a signature proves',
  },
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
    besides: {
      orderedSegments:
        'it lists the segment files the frontier covers, to mark their size and time',
    },
  },
  'packages/core/src/projections/cache-home.ts': {
    reads: 'as written',
    why: 'it chooses which cache file a tree uses, by the digest of each tail’s first segment; it serves no event',
  },
  'packages/core/src/projections/tree-index.ts': {
    reads: 'as written',
    why: 'it marks how a tree stands (its segments’ size, time and last line) to know when to read again',
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
    besides: {
      readTailDamage:
        'what `mnema init` would meet resuming this machine’s own tail: said, and nothing written',
    },
  },
  'packages/core/src/workflow/read-the-record.ts': {
    reads: 'proven',
    why: 'the subject a gate judges: read through `provenSubjectEvents`',
  },
  'packages/core/src/workflow/as-the-record-stands.ts': {
    reads: 'proven',
    why: 'it names the search by subject only in its documentation; the reading is `standing`’s',
  },
  'packages/core/src/identity/id.ts': {
    reads: 'the reading',
    why: 'it names the search by subject only in its documentation',
  },
  'packages/core/src/workflow/prune-operations.ts': {
    reads: 'as written',
    why: 'it authorizes a cut by what the tails hold, as `verify` reads them, and serves nothing',
  },
  'packages/core/src/workflow/stack-operations.ts': {
    reads: 'proven',
    why: 'whether a stack is adopted: read through `orderedEvents`',
  },
  // The action: what a pull request's comment says of the record it changes.
  'packages/action/src/record.ts': {
    reads: 'proven',
    why: 'it labels the decisions a pull request moves from the lines it brings, each hash checked and each proven by a signed checkpoint; it decides no rule',
    besides: {
      readTail: 'it reads a tail to fold its checkpoints and hands on the hashes they prove, alone',
      parseEntry: 'it parses each line it was handed, and keeps only the ones the fold proved',
    },
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
  'packages/code/src/pinned-run.ts': {
    reads: 'proven',
    why: 'whether a pinned run is open: read through `provenSubjectEvents`',
  },
  'packages/code/src/not-a-project.ts': {
    reads: 'as written',
    why: 'it counts the events a folder that is not a project holds, to say what is there, and serves no content',
  },
  'packages/code/src/inherited-record.ts': {
    reads: 'as written',
    why: 'it derives the name of the record a project inherits from its first lines, to find it',
  },
  'packages/code/src/commands/verify-since.ts': {
    reads: 'as written',
    why: 'it rules on what arrived since a commit, as `verify` does',
  },
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

/** The functions of `@mnema/chain` that hand on what the lines of a segment say, as written. */
const RAW = [
  'readTail',
  'readTailSince',
  'readTailEntries',
  'readTailTip',
  'subjectEvents',
  'orderedSegments',
  'parseEntry',
  'parseStoredLine',
  'parsedFromEnd',
  'locatedFromEnd',
  'linesFromEnd',
  'tailStanding',
  'readTailDamage',
  'readTailDamageOf',
  'arrivalsSince',
  'firstEntries',
  'nameTheGenesisDerives',
] as const;

/** The bridge: what folds each tail's checkpoints and hands on proven events only. */
const BRIDGE = [
  'orderedEvents',
  'orderedEventsOfRecord',
  'chainReplay',
  'chainArrivals',
  'provenSubjectEvents',
] as const;

/** The names a file reaches the tails by: the readers of the bytes and the bridge. */
const NAMES = new RegExp(`\\b(${[...RAW, ...BRIDGE].join('|')})\\b`);

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

/**
 * What each reader of the bytes is called in a file: the local name of every `{ name as alias }`
 * an import or a re-export brings in, so `import { subjectEvents as raw }` is still the reader of
 * the bytes it is. The name itself needs no entry: it is matched as written.
 */
function aliasesOfReaders(source: string, readers: readonly string[]): Map<string, string> {
  const aliases = new Map<string, string>();
  const specifiers = /\b(?:import|export)\s+(?:type\s+)?\{([^}]*)\}\s*from\b/g;
  for (const [, list] of codeOnly(source).matchAll(specifiers)) {
    for (const part of (list as string).split(',')) {
      const named = /^\s*(?:type\s+)?([A-Za-z_$][\w$]*)\s+as\s+([A-Za-z_$][\w$]*)\s*$/.exec(part);
      if (named !== null && readers.includes(named[1] as string)) {
        aliases.set(named[2] as string, named[1] as string);
      }
    }
  }
  return aliases;
}

/** The reader of the bytes `source` calls, by its name or by an alias, outside what `allowed` names. */
function callsToReaders(source: string, allowed: readonly string[]): string[] {
  const forbidden = RAW.filter((name) => !allowed.includes(name));
  const code = codeOnly(source);
  // The name is a call wherever it stands (`chain.subjectEvents(` too); an alias only where it
  // is a bare name, so a method of the same spelling is not taken for the import.
  const aliases = [...aliasesOfReaders(source, forbidden)].map(([alias]) => alias);
  const alternatives = [`\\b(?:${forbidden.join('|')})`];
  if (aliases.length > 0) alternatives.push(`(?<![\\w$.])(?:${aliases.join('|')})`);
  const found = new RegExp(`(${alternatives.join('|')})\\(`, 'g');
  return [...code.matchAll(found)].map((one) => one[1] as string);
}

describe('every reader of the tails is classified', () => {
  it('classifies every file that names a reader, and no file that does not', () => {
    expect(Object.keys(READERS).sort()).toEqual(readersInTheSource());
  });

  it('reads the bytes as written only where the reason says it rules or serves nothing', () => {
    for (const [path, { reads, besides }] of Object.entries(READERS)) {
      if (reads !== 'proven') continue;
      // A policy reader reaches the tails only through the bridge, but for the calls it names.
      const text = readFileSync(join(REPO_ROOT, path), 'utf-8');
      expect(
        callsToReaders(text, Object.keys(besides ?? {})),
        `${path} calls a reader of the bytes as written`,
      ).toEqual([]);
    }
  });

  it('sees a reader of the bytes called under another name', () => {
    const aliased = [
      "import { type ChainEntry, subjectEvents as raw } from '@mnema/chain';",
      'import {',
      '  readTail as read,',
      "} from '@mnema/chain';",
      'export const a = raw(layout, id);',
      'export const b = read(layout, tail, upcasters);',
    ].join('\n');
    expect(callsToReaders(aliased, [])).toEqual(['raw', 'read']);
    // A name the file's reason allows is allowed under its alias too.
    expect(callsToReaders(aliased, ['subjectEvents'])).toEqual(['read']);
    // A method that happens to be called like an alias is not the import.
    expect(callsToReaders("import { readTail as read } from 'x'; this.read(1);", [])).toEqual([]);
    // And the plain name is still seen.
    expect(callsToReaders('subjectEvents(layout, id);', [])).toEqual(['subjectEvents']);
    expect(callsToReaders('chain.subjectEvents(layout, id);', [])).toEqual(['subjectEvents']);
  });
});
