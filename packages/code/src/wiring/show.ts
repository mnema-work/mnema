/**
 * The `mnema show` wiring: what it declares, and what it prints.
 *
 * `mnema show <id> [--json]`: the whole record behind an id from `search`.
 * Serves a skill's body too, in EVERY state: on this surface the reader is CURATING
 * patterns, and refusing them the text of the thing they are reviewing would make the
 * curation impossible (the agent's surface serves a body through the `skills` tool,
 * which records the reading and refuses the two closed states: see `runShow`).
 */

import type { Command } from 'commander';
import { here } from './context.js';
import { fact } from '../presentation/detail.js';
import { oneLine } from '../one-line.js';
import { writeLines } from './io.js';
import { noSuchRecord } from './no-such-record.js';
import { idOrRefuse, reportRefusal } from './report.js';
import { type Declared, readsTheRecord, type Wiring } from './verb.js';

/** Registers `mnema show` on the program. */
export function registerShow(program: Command, wiring: Wiring): Declared {
  const { io, render } = wiring;
  const show = program
    .command('show')
    .description('show one whole record by id (the body a search only pointed at)')
    .argument('<id>', 'the record id (from `mnema search`)')
    .option('--json', 'emit the faithful record as JSON')
    .action(async (id: string, opts: { json?: boolean }) => {
      const { divergenceNotice, linkBreakNotice, newerLinesNotice } = await import(
        './integrity.js'
      );
      const { runShow } = await import('../commands/show.js');
      const { recordReport } = await import('../presentation/record.js');
      const named = await idOrRefuse(wiring, id);
      if (named === undefined) return;
      const result = runShow(here(), { id: named });
      if (!result.ok) {
        // The refusal says what the trees it read say about their proof, first: a record that
        // was written and is not found because its entry was left out is not a record that never was.
        for (const line of linkBreakNotice(result.linkBreaks)) io.err(render(line));
        reportRefusal(wiring, result, { UNKNOWN_RECORD: noSuchRecord('record', id) });
        return;
      }
      // BEFORE the answer, and on the other stream, so it survives a pipe, and so
      // `--json` stays the machine-readable thing it promises to be.
      for (const line of linkBreakNotice(result.linkBreaks)) io.err(render(line));
      // The same stream and the same place, for a fact about the record the answer hides:
      // the projection below keeps the last move, and this says there was another.
      for (const line of divergenceNotice(result.divergent)) io.err(render(line));
      // A label two trees carry: the one served is named, and the other, so the choice is seen.
      if (result.sameLabel !== undefined) {
        const { typed, served, others } = result.sameLabel;
        const also = others.map((other) => `${other.scope} tree (${other.id})`).join(' and the ');
        io.err(
          render(
            fact(
              `${oneLine(typed)} is carried by two records: this one, in the ${served.scope} tree (${served.id}), and the ${also}. Use the id to read the other.`,
            ),
          ),
        );
      }
      // And the lines a newer mnema wrote about this record, which this one does not apply.
      for (const line of newerLinesNotice(result.newerLines, 'one record')) io.err(render(line));
      if (opts.json === true) {
        io.out(JSON.stringify(result.record, null, 2));
        return;
      }
      writeLines(
        io,
        recordReport(render, result.record, {
          anchors: result.anchors,
          ...(result.consultations !== undefined ? { consultations: result.consultations } : {}),
          ...(result.attested !== undefined ? { attested: result.attested } : {}),
          ...(result.unannounced !== undefined ? { unannounced: result.unannounced } : {}),
        }),
      );
    });
  return readsTheRecord(show);
}
