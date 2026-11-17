/**
 * What a writer cites: the FRONTIER of the heads of the other tails of its record that its own tail
 * has not cited yet, read off the disk at the moment it writes (FORMAT.md, "Reading many tails").
 *
 * WHY THE DISK AT THE MOMENT OF WRITING. A citation says "this hash existed when I wrote", and
 * the heads on disk are exactly what existed: whatever a session read before deciding to write
 * was there before them. So citing them is never a claim the writer cannot back, and it is the
 * one reading that needs no help from whatever surface asked for the write. It may cite more
 * than the act depended on; that only orders the event after facts that did precede it.
 *
 * WHY ONLY THE FRONTIER. A citation orders the entry after the head it names AND after everything
 * that head's tail had cited. So a head that another tail's head already cites needs no citation of
 * its own: citing the other is enough, and an entry that cited every head of a record of N tails
 * grew with N, and the record with N squared (ADR-321). The writer cites instead
 *
 *   (a) the heads no other tail's head covers (the frontier);
 *   (b) on a move or a retraction, the head of every tail that holds a line of the subject, since
 *       what a move saw is read off what it cites directly (FORMAT.md, section 6.7);
 *   (c) the head of every tail that holds the enrolment of a key, since an event is accepted from a
 *       key only after the enrolment it rests on (section 6.2);
 *
 * and, for the key facts of section 6.2 themselves (ADR-506), every head it has not cited
 * directly, as it always did. A tail a waiver names covers nothing, and neither does a tail whose
 * bytes do not index or whose key this record does not commit ({@link ./citation-index.ts}).
 * In a record that holds every tail the order and the sight of moves are the ones every-head
 * citation gives; in a partial one (a clone missing the covering tail, a tail cut by a waiver) an
 * entry whose cover is missing falls back to its clock, which FORMAT.md states with its number.
 *
 * WHY NOTES OF WHAT WAS CITED, AND WHERE. "Not cited yet" is a fact about the writer's own tail, and
 * reading the whole tail back before every write to learn it is the cost this must not have. So two
 * notes are kept beside the tail's lock, in `locks/`, which the tree's `.gitignore` already keeps
 * out of the record (inside a git repository, the `locks/` its worktrees share under the common git
 * directory): `.cited`, the heads the tail cited directly, and `.covered`, the heads that are in the
 * tail's past because another head it cited covers them, with the tail that covers. They are
 * machinery, never proof. Lost, the next write cites again what it no longer knows it cited: one
 * redundant citation per tail, which changes no order. Two processes of one installation share the
 * tail and its lock, so they read and write the notes in turn.
 *
 * WHAT IT COSTS. A record with one tail (one machine, which is most of them) costs one directory
 * listing and nothing else: there is no other head to read. Otherwise one look at the end of each
 * other tail per write, and the index of every tail only when a head changed that no note covers.
 */

import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CatalogEvent } from '../events/catalog.js';
import { parseStoredJson } from '../events/stored-json.js';
import type { UpcasterRegistry } from '../events/upcaster.js';
import { isMove } from '../events/workflow.js';
import { holdsAny, indexAt, type Snapshot, snapshotOf, type TailIndex } from './citation-index.js';
import { type ChainLayout, publicKeyPath } from './layout.js';
import { refuseToWriteThrough } from './linked-write.js';
import { listTails } from './store.js';
import { writtenAsItself } from './subject-events.js';

/** Where a tail keeps the heads it last cited, by tail id: beside its lock, out of the record. */
export function citedHeadsPath(layout: ChainLayout, tailId: string): string {
  return join(layout.root, 'locks', `${tailId}.cited`);
}

/** Where a tail keeps the heads that its citations cover, and by which tail: out of the record. */
export function coveredHeadsPath(layout: ChainLayout, tailId: string): string {
  return join(layout.root, 'locks', `${tailId}.covered`);
}

/** The key facts of FORMAT.md section 6.2: each cites every head it has not cited directly. */
const KEY_FACTS: ReadonlySet<string> = new Set([
  'identity.founded',
  'key.enrolled',
  'key.revoked',
  'backup.declared',
  'checker.enrolled',
  'checker.retired',
  'agent.enrolled',
  'agent.retired',
  'account.linked',
]);

/** A retraction is ordered after the note it retracts, which a partial record must not lose. */
const RETRACTIONS: ReadonlySet<string> = new Set(['note.retracted', 'link.retracted']);

/** An event made ready to write, and what to remember once it is written. */
export interface Cited {
  readonly event: CatalogEvent;
  /** Records the heads the event cited. Call it only after the event reached the tail. */
  readonly remember: () => void;
}

/** What `.covered` says of one tail: the head that is in this tail's past, and the tail that covers it. */
interface Covered {
  readonly head: string;
  readonly via: string;
}

/** The heads of the other tails of one record, as the writer of one tail cites them. */
export class HeadsToCite {
  /** The last snapshot of each tail, by the extent of its last segment when it was taken. */
  private readonly looked = new Map<string, Snapshot>();

  constructor(
    private readonly layout: ChainLayout,
    private readonly ownTail: string,
    private readonly upcasters: UpcasterRegistry,
    /** The layout whose `locks/` holds this tail's notes of what it cited: the record's own, unless shared. */
    private readonly notes: ChainLayout = layout,
  ) {}

  /**
   * The first of `events` with `after` naming the heads this tail must cite, or itself when there
   * is none, or when it already says what it cites. `events` is the whole act: the first one
   * cites, and every one of them is looked at for the moves and retractions the act holds.
   */
  cite(events: readonly CatalogEvent[]): Cited {
    const event = events[0] as CatalogEvent;
    const unchanged: Cited = { event, remember: () => undefined };
    if (event.after !== undefined) return unchanged;
    const heads = new Map<string, Snapshot>();
    for (const tail of listTails(this.layout)) {
      if (tail === this.ownTail) continue;
      const snap = this.snapshot(tail);
      if (snap !== undefined) heads.set(tail, snap);
    }
    if (heads.size === 0) return unchanged;
    const cited = this.read<string>(citedHeadsPath(this.notes, this.ownTail), 'cited');
    const pending = [...heads.keys()].filter((tail) => cited[tail] !== heads.get(tail)?.head);
    if (pending.length === 0) return unchanged;
    const hashOf = (tail: string): string => (heads.get(tail) as Snapshot).head;
    const covered = this.read<Covered>(coveredHeadsPath(this.notes, this.ownTail), 'covered');
    if (events.some((one) => KEY_FACTS.has(one.kind))) {
      return this.cited(event, cited, covered, new Set(pending.map(hashOf)), pending, hashOf);
    }
    const holds = this.holders(events);
    const behind = (tail: string): boolean => {
      const had = covered[tail];
      return had === undefined || had.head !== hashOf(tail) || !heads.has(had.via);
    };
    if (holds === undefined && pending.every((tail) => !behind(tail))) return unchanged;
    const isHead = new Set([...heads.keys()].map(hashOf));
    const indexes = new Map<string, TailIndex>();
    for (const [tail, snap] of heads) {
      const index = indexAt(this.notes, this.ownTail, tail, snap, (h) => isHead.has(h));
      if (index !== undefined) indexes.set(tail, index);
    }
    const waived = new Set([...indexes.values()].flatMap((index) => index.prunes));
    const fresh = pending.filter(
      (tail) => behind(tail) || waived.has((covered[tail] as Covered).via),
    );
    const covers = new Map<string, string>();
    const committed = new Map<string, boolean>();
    const keyed = (tail: string): boolean => {
      const fingerprint = tail.slice(0, tail.indexOf('-'));
      let known = committed.get(fingerprint);
      if (known === undefined) {
        known = existsSync(publicKeyPath(this.layout, fingerprint));
        committed.set(fingerprint, known);
      }
      return known;
    };
    for (const [tail, index] of indexes) {
      if (waived.has(tail) || !keyed(tail)) continue;
      for (const hash of index.cites) if (!covers.has(hash)) covers.set(hash, tail);
    }
    const after = new Set<string>();
    const nowCovered: Record<string, Covered> = {};
    for (const tail of fresh) {
      const via = covers.get(hashOf(tail));
      if (via !== undefined && via !== tail) nowCovered[tail] = { head: hashOf(tail), via };
      else after.add(hashOf(tail));
    }
    for (const tail of pending) {
      // The enrolment of a key is never left behind a cover; what cannot be read is taken to hold one.
      if (indexes.get(tail)?.enrols !== false) after.add(hashOf(tail));
      else if (holds !== undefined && holdsAny(heads.get(tail) as Snapshot, holds)) {
        after.add(hashOf(tail));
      }
    }
    return this.cited(event, cited, { ...covered, ...nowCovered }, after, pending, hashOf);
  }

  /** The act with its citations, and the notes to keep once it is written. */
  private cited(
    event: CatalogEvent,
    cited: Record<string, string>,
    covered: Record<string, Covered>,
    after: ReadonlySet<string>,
    pending: readonly string[],
    hashOf: (tail: string) => string,
  ): Cited {
    const direct = pending.filter((tail) => after.has(hashOf(tail)));
    const remember = (): void => {
      this.keep(citedHeadsPath(this.notes, this.ownTail), {
        ...cited,
        ...Object.fromEntries(direct.map((tail) => [tail, hashOf(tail)])),
      });
      this.keep(coveredHeadsPath(this.notes, this.ownTail), covered);
    };
    if (after.size === 0) return { event, remember };
    return { event: { ...event, after: [...after].sort() }, remember };
  }

  /**
   * The needles of the subjects the act moves or retracts (`"subject":"<id>"` as the envelope writes
   * it), or undefined when it holds none. A subject that is not written as itself is searched by
   * the empty needle, which every tail holds.
   */
  private holders(events: readonly CatalogEvent[]): Buffer[] | undefined {
    const needles: Buffer[] = [];
    for (const one of events) {
      if (!isMove(one) && !RETRACTIONS.has(one.kind)) continue;
      const subject = one.subject;
      if (subject === undefined) continue;
      needles.push(
        writtenAsItself(subject)
          ? Buffer.from(`"subject":"${subject}"`, 'latin1')
          : Buffer.alloc(0),
      );
    }
    return needles.length === 0 ? undefined : needles;
  }

  /** The note `path` holds, by tail id: empty when it is absent or unreadable. */
  private read<T>(path: string, note: 'cited' | 'covered'): Record<string, T> {
    refuseToWriteThrough(this.notes, [`locks/${this.ownTail}.${note}`]);
    try {
      const parsed: unknown = parseStoredJson(readFileSync(path, 'utf-8'));
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};
      const wanted = (value: unknown): boolean =>
        note === 'cited'
          ? typeof value === 'string'
          : typeof value === 'object' &&
            value !== null &&
            typeof (value as Covered).head === 'string' &&
            typeof (value as Covered).via === 'string';
      return Object.fromEntries(
        Object.entries(parsed).filter(([, value]) => wanted(value)),
      ) as Record<string, T>;
    } catch {
      return {};
    }
  }

  /** Replaces a note whole, so a reader never meets half of it. */
  private keep(path: string, value: object): void {
    const staging = `${path}.${process.pid}`;
    try {
      writeFileSync(staging, `${JSON.stringify(value)}\n`);
      renameSync(staging, path);
    } catch {
      // A note that could not be kept costs the next write a repeated citation, and nothing else:
      // it is never what decides an order.
    }
  }

  /** The snapshot of a tail, the one taken last when its end has not moved. */
  private snapshot(tail: string): Snapshot | undefined {
    try {
      const taken = snapshotOf(this.layout, tail, this.upcasters, this.looked.get(tail));
      if (taken !== undefined) this.looked.set(tail, taken);
      return taken;
    } catch {
      // A tail whose end does not read is not one this writer can say it read. The verifier
      // names what is wrong with it; a write elsewhere is not the place to refuse over it.
      return undefined;
    }
  }
}
