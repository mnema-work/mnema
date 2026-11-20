/**
 * How many of the project's files fall under each layer of the record's rules, with no score.
 *
 * THE LAYERS ARE THE GATE'S OWN, in the gate's own order: a file is counted under the STRONGEST
 * layer that stands over it, so the four numbers sum to the files walked and no file is counted
 * twice. A rule in force that REFUSES a write at the file is the first layer; failing that, one
 * that ASKS FOR A PERSON; failing that, one that GOVERNS; and a file none of them addresses is
 * under none. Which rules stand over a file is read ONCE for the whole walk
 * (`rulesInForceReach`: every address of every rule in force, by the gate's own in-force reading
 * and its own prefix comparison), and each walked file is matched against that set: the record is
 * never read per file, which is what keeps the count linear in the files.
 *
 * IT FOLLOWS THE GATE'S SWITCHES, as the gate does: with the channel that refuses a write (or the
 * one that asks for a person) switched off, that layer does not apply and a file under such a rule
 * counts under the next layer. The channels that are off are carried out beside the counts and
 * said, so the numbers are never read as if the gate were on.
 *
 * ONE WALK, AND IT IS THE REACH'S: `walkProject` is what counts what an address covers when it is
 * recorded, so what a file of the project IS (the six names left out as not hand-written, a link
 * neither counted nor followed) is the same judgement here. The names left out and the ceiling are
 * carried out beside the counts: past the ceiling the walk stops, the counts are FLOORS, and the
 * surfaces say so.
 *
 * NUMBERS ONLY. No percentage, no grade, no threshold: a project whose files mostly fall under
 * none may be right to, and a number that graded it would be this product holding an opinion about
 * somebody else's repository.
 */

import { channelIsOn, relationsCovering, rulesInForceReach, type ScopedCache } from '@mnema/context';
import {
  ASKS_FOR_A_PERSON_RELATION,
  GOVERNS_RELATION,
  REFUSES_A_WRITE_RELATION,
} from '@mnema/core';
import { WALK_CEILING, walkProject } from './governed-tree.js';
import { ASKS_A_PERSON_CHANNEL, REFUSES_A_WRITE_CHANNEL } from './record-framing.js';

/** The layers a file falls under, strongest first. */
export const LAYERS = ['refuses', 'asks', 'governs', 'none'] as const;
export type Layer = (typeof LAYERS)[number];

/** A count of files per layer. */
export type LayerCounts = Readonly<Record<Layer, number>>;

/** One top-level folder, or the project's own root files (`.`), and its files by layer. */
export interface FolderCoverage extends LayerCounts {
  readonly folder: string;
  readonly files: number;
}

/** What the walk found, by layer, in total and per top-level folder. */
export interface RuleCoverage {
  /** The files walked, which is the sum of {@link layers}. */
  readonly files: number;
  readonly layers: LayerCounts;
  /** Sorted by folder name; the root files, when there are any, under `.`. */
  readonly folders: readonly FolderCoverage[];
  /** The names the walk left out as not hand-written, as met. */
  readonly skipped: readonly string[];
  /** The walk stopped at {@link ceiling}: every count is a floor. */
  readonly truncated: boolean;
  readonly ceiling: number;
  /**
   * The gate's channels that are switched off, which the counts follow: a file whose strongest
   * rule is of a layer whose channel is off counts under the next layer, as the gate treats it.
   */
  readonly switchedOff: readonly string[];
}

const empty = (): Record<Layer, number> => ({ refuses: 0, asks: 0, governs: 0, none: 0 });

/** The strongest layer among the relations standing over a file. */
function layerOf(relations: ReadonlySet<string>): Layer {
  if (relations.has(REFUSES_A_WRITE_RELATION)) return 'refuses';
  if (relations.has(ASKS_FOR_A_PERSON_RELATION)) return 'asks';
  if (relations.has(GOVERNS_RELATION)) return 'governs';
  return 'none';
}

/**
 * Counts the project's files under `root` by the layer of the rules in force at each, reading
 * `sources`. The ceiling is overridable so a case can reach it; production passes the default.
 */
export function coverageByLayer(
  sources: readonly ScopedCache[],
  root: string,
  ceiling: number = WALK_CEILING,
): RuleCoverage {
  const own = sources.filter((source) => source.inherited === undefined);
  const switchedOff = [
    ...(channelIsOn(own, REFUSES_A_WRITE_CHANNEL) ? [] : [REFUSES_A_WRITE_CHANNEL]),
    ...(channelIsOn(own, ASKS_A_PERSON_CHANNEL) ? [] : [ASKS_A_PERSON_CHANNEL]),
  ];
  const reach = rulesInForceReach(sources, { root });
  const total = empty();
  const byFolder = new Map<string, Record<Layer, number>>();
  const outcome = walkProject(
    root,
    (relative) => {
      const relations = relationsCovering(reach, relative);
      for (const channel of switchedOff) {
        relations.delete(channel === REFUSES_A_WRITE_CHANNEL ? REFUSES_A_WRITE_RELATION : ASKS_FOR_A_PERSON_RELATION);
      }
      const layer = layerOf(relations);
      const slash = relative.indexOf('/');
      const folder = slash === -1 ? '.' : relative.slice(0, slash);
      const row = byFolder.get(folder) ?? empty();
      row[layer] += 1;
      byFolder.set(folder, row);
      total[layer] += 1;
    },
    ceiling,
  );
  const folders = [...byFolder]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([folder, row]) => ({
      folder,
      files: row.refuses + row.asks + row.governs + row.none,
      ...row,
    }));
  return {
    files: total.refuses + total.asks + total.governs + total.none,
    layers: total,
    folders,
    skipped: outcome.skipped,
    truncated: outcome.truncated,
    ceiling,
    switchedOff,
  };
}
