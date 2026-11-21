/**
 * The `mnema rules` wiring: what it declares, and what it prints.
 *
 * `mnema rules <path> [--json]`: the reverse reading of the relations whose target
 * is a path (`ADDRESS_RELATIONS`: `governs` and `asks-for-a-person`). It said "the ONE
 * relation" until the gate shipped as a second label of the same shape, and this page
 * has reported both ever since. `refs` walks outward from an id; this walks inward from
 * a place in the code and answers which recorded rules govern it, most specific first.
 *
 * It CHARGES NOTHING. It refuses no move, blocks no write and grades no work; what
 * it reports is the id a later charge would have to cite. Three numbers ride on
 * every answer (how many rules cover the path, how many address the project at all,
 * and how many address something the working tree no longer holds), so an empty
 * list is an answer and never a silence.
 *
 * A relative path is resolved against the working directory, which is what a person
 * typing one means. It sits among the intelligence reads: read-only, no `--actor`,
 * and `NO_PROJECT` outside a project, because an address is relative to a root.
 */

import type { Command } from 'commander';
import { here } from './context.js';
import { writeLines } from './io.js';
import { reportRefusal } from './report.js';
import { type Declared, readsTheRecord, type Wiring } from './verb.js';

/** Registers `mnema rules` on the program. */
export function registerRules(program: Command, wiring: Wiring): Declared {
  const { io, render } = wiring;
  const rules = program
    .command('rules')
    .description('show which recorded rules govern a path, and which address nothing')
    .argument('[path]', 'the path to ask about, relative to here or absolute')
    .option(
      '--coverage',
      'instead of a path: count the project files by layer (refused, asked, governed, none), per top-level folder, with no score, following the switches of the gate',
    )
    .option('--json', 'emit the faithful reading as JSON')
    .action(async (path: string | undefined, opts: { json?: boolean; coverage?: boolean }) => {
      // NO PROJECT FIRST: outside one, the answer to every read is the same, whatever was typed,
      // so the misuse of the line is judged only once there is a project to ask.
      if ((opts.coverage === true) === (path !== undefined)) {
        const { runRules: probe } = await import('../commands/rules.js');
        const outside = probe(here(), { path: '.' });
        if (!outside.ok) {
          reportRefusal(wiring, outside, {});
          return;
        }
        reportRefusal(wiring, {
          reason: 'USAGE',
          message:
            path === undefined
              ? 'a path to ask about, or --coverage to count the whole project.'
              : '--coverage counts the whole project: give it no path.',
        });
        return;
      }
      const { linkBreakNotice, newerLinesNotice } = await import('./integrity.js');
      const { runRules, runRulesCoverage } = await import('../commands/rules.js');
      const { rulesReport, coverageReport } = await import('../presentation/rules.js');
      const result =
        opts.coverage === true
          ? runRulesCoverage(here())
          : runRules(here(), { path: path as string });
      if (!result.ok) {
        reportRefusal(wiring, result, {});
        return;
      }
      // BEFORE the answer, and on the other stream, so it survives a pipe, and so
      // `--json` stays the machine-readable thing it promises to be.
      for (const line of linkBreakNotice(result.linkBreaks)) io.err(render(line));
      for (const line of newerLinesNotice(result.newerLines, 'the record')) io.err(render(line));
      const { inheritedNotReadLine } = await import('../inherited-record.js');
      const { fact } = await import('../presentation/detail.js');
      const notRead = inheritedNotReadLine(result.inherited);
      if (notRead !== undefined) io.err(render(fact(notRead)));
      // A directory of more than one record was read for nothing: said on the same stream, and,
      // for `--json`, in the answer itself, which is what the Action reads.
      const { severalRecordsSentence } = await import('../record-integrity.js');
      if (result.severalRecords.length > 0) {
        io.err(render(fact(severalRecordsSentence(result.severalRecords))));
      }
      if ('coverage' in result) {
        if (opts.json === true) {
          io.out(
            JSON.stringify(
              result.severalRecords.length === 0
                ? result.coverage
                : { ...result.coverage, severalRecords: result.severalRecords },
              null,
              2,
            ),
          );
          return;
        }
        writeLines(io, coverageReport(render, result.coverage));
        return;
      }
      if (result.notPushed !== undefined) io.err(render(fact(result.notPushed)));
      if (opts.json === true) {
        io.out(
          JSON.stringify(
            result.severalRecords.length === 0
              ? result.governed
              : { ...result.governed, severalRecords: result.severalRecords },
            null,
            2,
          ),
        );
        return;
      }
      writeLines(io, rulesReport(render, result.governed));
    });
  return readsTheRecord(rules);
}
