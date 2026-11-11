import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect } from 'vitest';

/**
 * THE COUNTS A GUARD KEEPS BY HAND, and the one way a person who cannot judge them restates them.
 *
 * A ledger in a test file says, for each file it lists, how many of something the guard reads in
 * it. A change to one file moves one count, and the red used to say only what was read. Now it
 * names the line of the ledger and the number to write, and `-u` on the guard rewrites exactly
 * those numbers in place, the way `-u` rewrites a golden.
 *
 * WHAT `-u` DOES NOT DO. It restates a count of a file the ledger already lists. A file the guard
 * reads that has no line, a line whose file is gone, and a count a row did not have before are
 * left as they are: someone lists those on purpose, and the guard goes on refusing them.
 *
 * A ledger of reasons rather than counts (a debt, an allowed escape, a list of instruments) is not
 * kept this way: its point is the sentence a person writes.
 */

/** A count per file, or a count per kind of reading per file. */
export type Counts = number | Readonly<Record<string, number>>;

interface Ledger {
  /** `import.meta.url` of the test file that holds the ledger. */
  readonly testFile: string;
  /** The identifier the ledger is declared under, as it stands in that file. */
  readonly name: string;
  /** What the guard read, by file. */
  readonly read: ReadonlyMap<string, Counts> | Readonly<Record<string, Counts>>;
  /** What the ledger says, by file. */
  readonly declared: Readonly<Record<string, Counts>>;
  /** Only a case of this guard's own sets it: otherwise `-u` on the run decides. */
  readonly updating?: boolean;
}

interface Restatement {
  readonly key: string;
  /** The field of a row (`line`, `name`), or undefined for a flat count. */
  readonly field: string | undefined;
  readonly read: number;
  readonly said: number;
}

const entriesOf = (counts: Ledger['read']): [string, Counts][] =>
  counts instanceof Map ? [...counts] : Object.entries(counts);

const fieldsOf = (count: Counts): [string | undefined, number][] =>
  typeof count === 'number' ? [[undefined, count]] : Object.entries(count);

/** Every count of a file the ledger lists that the guard read as another number. */
function restatements({ read, declared }: Ledger): Restatement[] {
  const out: Restatement[] = [];
  for (const [key, now] of entriesOf(read)) {
    const said = declared[key];
    if (said === undefined) continue;
    const saidFields = new Map(fieldsOf(said));
    for (const [field, count] of fieldsOf(now)) {
      const was = saidFields.get(field);
      if (was !== undefined && was !== count) out.push({ key, field, read: count, said: was });
    }
  }
  return out.sort((a, b) => a.key.localeCompare(b.key));
}

/** Where, in the test file, the number of one count is written. */
function placeOf(lines: readonly string[], ledger: string, one: Restatement) {
  const start = lines.findIndex((line) => new RegExp(`^(export )?const ${ledger}\\b`).test(line));
  if (start === -1) throw new Error(`the ledger ${ledger} is not declared in the test file`);
  const quoted = `'${one.key}':`;
  const at = lines.findIndex((line, i) => i > start && line.trimStart().startsWith(quoted));
  if (at === -1) throw new Error(`${ledger} has no line for ${one.key}`);
  const text = lines[at] as string;
  const pattern =
    one.field === undefined
      ? new RegExp(`(${quoted.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*)(\\d+)`)
      : new RegExp(`(\\b${one.field}:\\s*)(\\d+)`);
  if (!pattern.test(text))
    throw new Error(`${ledger}: the number of ${one.key} is not on its line`);
  return { at, text, pattern };
}

/**
 * Holds a ledger to what the guard read. Without `-u`, a count that is not the one read fails
 * naming the line and the number to write, and the command that writes it. Under `-u`, those
 * numbers are rewritten in the test file and the ledger returned is the restated one, so the
 * guard's own comparison, which goes on after this, holds the restated counts to the same read.
 */
export function holdTheCounts<T extends Readonly<Record<string, Counts>>>(
  ledger: Ledger & { declared: T },
): T {
  const stale = restatements(ledger);
  if (stale.length === 0) return ledger.declared;
  const path = fileURLToPath(ledger.testFile);
  const repo = fileURLToPath(new URL('../../../../', import.meta.url));
  const rel = path.startsWith(repo) ? path.slice(repo.length) : path;
  const lines = readFileSync(path, 'utf8').split('\n');
  const places = stale.map((one) => ({ one, place: placeOf(lines, ledger.name, one) }));
  const updating =
    ledger.updating ??
    (expect.getState() as { snapshotState?: { _updateSnapshot?: string } }).snapshotState
      ?._updateSnapshot === 'all';
  if (!updating) {
    const says = places.map(({ one, place }) => {
      const what = one.field === undefined ? '' : ` ${one.field}`;
      return `${rel}:${place.at + 1}: '${one.key}'${what} says ${one.said}, the guard read ${one.read}`;
    });
    throw new Error(
      `${ledger.name} keeps a count that moved. Write the number it read on each line below, or run ` +
        `\`pnpm vitest run ${rel} -u\` to write them:\n${says.join('\n')}`,
    );
  }
  for (const { one, place } of places) {
    lines[place.at] = place.text.replace(place.pattern, `$1${one.read}`);
  }
  writeFileSync(path, lines.join('\n'));
  const restated: Record<string, Counts> = {};
  for (const [key, row] of Object.entries(ledger.declared)) restated[key] = row;
  for (const one of stale) {
    const row = restated[one.key] as Counts;
    restated[one.key] =
      one.field === undefined ? one.read : { ...(row as object), [one.field]: one.read };
  }
  return restated as T;
}
