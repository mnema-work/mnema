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
import { reportRefusal, reportUsage } from './report.js';
import { type Declared, readsTheRecord, type Wiring } from './verb.js';

/** Registers `mnema rules` on the program. */
export function registerRules(program: Command, wiring: Wiring): Declared {
  const { io, render } = wiring;
  const rules = program
    .command('rules')
    .description('show which recorded rules govern a path, and which address nothing')
    .argument('<path>', 'the path to ask about, relative to here or absolute')
    .option('--json', 'emit the faithful reading as JSON')
    .action(async (path: string, opts: { json?: boolean }) => {
      const { linkBreakNotice, newerLinesNotice } = await import('./integrity.js');
      const { runRules } = await import('../commands/rules.js');
      const { rulesReport } = await import('../presentation/rules.js');
      const result = runRules(here(), { path });
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
  rules
    .command('test')
    .description('check the verdicts a file declares for paths against the record’s rules')
    .argument('<file>', 'a JSON file: { "cases": [ { "path": "src/a.ts", "expect": "refuse" } ] }')
    .addHelpText(
      'after',
      [
        '',
        'Each case names a path, relative to the project root, and what it must meet:',
        '  refuse   the gate refuses a write there',
        '  ask      the gate holds a write there for a person',
        '  governs  a rule is linked `governs` there, and none refuses or asks',
        '  none     no rule stands over the path',
        'The answer is the gate’s own, so a switch turned off changes it as it changes the gate.',
        'Every case that does not meet its verdict is named, with the rules that stand there,',
        'and the exit code is 1; a file with no case is refused. Nothing is written.',
      ].join('\n'),
    )
    .action(async (file: string) => {
      const { runRulesTest } = await import('../commands/rules-test.js');
      const { oneLine } = await import('../one-line.js');
      const { statement } = await import('../presentation/verdict.js');
      const result = runRulesTest(here(), { file });
      if (!result.ok) {
        if (result.reason === 'BAD_CASES') reportUsage(wiring, result.message);
        else reportRefusal(wiring, result, {});
        return;
      }
      for (const one of result.cases) {
        const by = one.by.length === 0 ? '' : ` (${one.by.map(oneLine).join(', ')})`;
        io.out(
          render(
            one.matched
              ? statement('MATCH', `${oneLine(one.path)}: ${one.got}${by}`, 'good')
              : statement(
                  'MISMATCH',
                  `${oneLine(one.path)}: expected ${one.expect}, got ${one.got}${by}`,
                  'bad',
                ),
          ),
        );
      }
      const missed = result.cases.filter((one) => !one.matched).length;
      io.out(`${result.cases.length - missed} of ${result.cases.length} case(s) met their verdict.`);
      if (missed > 0) io.fail();
    });
  return readsTheRecord(rules);
}
