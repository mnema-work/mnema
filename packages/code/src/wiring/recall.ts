/**
 * The `mnema recall` wiring: what it declares, and what it prints.
 *
 * `mnema recall`: the memories and observations recorded for this project, out of every
 * tree this machine holds for it, the ones near what the session touches first, as the
 * markdown a session opens with beside the document `mnema brief` prints. The plugin's second `SessionStart` handler runs it; a
 * person runs it to see what that session is handed.
 *
 * IT TAKES ONE OPTION, `--hook`, and it is `brief`'s, for `brief`'s reason: the plugin's handler
 * hands this text to a session through a hook, the host replaces a hook's text by a file path
 * past a ceiling it measures, and with the flag the text stops at a whole note inside it
 * (`presentation/within-a-hook.ts`). Without it nothing is cut. This said it takes NO options;
 * the other absences are still decided the way `brief`'s are. No `--scope`:
 * what it reads is every tree, and that is the point of it; a note an agent records lands
 * in the tree that does not travel, and a scope flag would be a way to leave out exactly
 * the notes this verb exists to bring back. No `--limit`: the cut is the index's own, the
 * one `mnema search` cuts at. This said the cut kept this text and `mnema search --kind
 * memory` from disagreeing *"about which notes are the latest"*, and since the notes are
 * chosen by what the session touches the two lists are no longer the same list (the one
 * a session is handed puts the near notes first), so what the absent flag still buys is
 * the one number, not the one list. No `--json`: `mnema search --json` is the index
 * itself, and a caller that wants it by term asks it.
 *
 * IT IS NOT A FILE, AND THE HELP SAYS SO BEFORE ANYTHING ELSE. It prints what was kept on
 * this machine as well as what was committed, so redirecting it into a tracked file would
 * put a machine's private notes into the repository, which is the defect `mnema brief` was
 * corrected for, and why this is a verb of its own and not a flag of that one.
 *
 * AND IT PRINTS NOTHING WHEN NOTHING IS RECORDED, with a zero exit: a session in a project
 * with no notes is handed no text, and a person who ran it has been told the same thing by
 * the empty answer. Its two refusals are `brief`'s (outside a project, and switched off)
 * in `brief`'s words ({@link switchedOff}), on stderr with a non-zero exit, which is what
 * the plugin's handler treats as silence.
 */

import type { Command } from 'commander';
import { hookTextOf } from '../host-names.js';
import { fact } from '../presentation/detail.js';
import { hookHostOf, hookHostOption, switchedOff } from './brief.js';
import { here } from './context.js';
import { writeLines } from './io.js';

/**
 * What a person running the hook form by hand reads on the error stream when the notes exist but
 * are longer than the room a hook has: the hook hands nothing then, and this says why.
 */
const NOTHING_HANDED_BECAUSE_IT_DOES_NOT_FIT =
  'recall: the notes are longer than the room a hook has, so none were handed over';
import { reportRefusal } from './report.js';
import { type Declared, readsTheRecord, type Wiring } from './verb.js';

/** Registers `mnema recall` on the program. */
export function registerRecall(program: Command, wiring: Wiring): Declared {
  const { io, render } = wiring;
  const recall = program
    .command('recall')
    .description('print the notes recorded here as markdown, near ones first, for an agent to read')
    .addHelpText(
      'after',
      [
        '',
        'It prints to stdout and writes nothing. It is what a session opens with beside the',
        'document `mnema brief` prints: the memories and the observations recorded for this',
        'project, one line each: out of EVERY tree this machine holds for it, the committed',
        'one, this machine’s own and your personal one.',
        'So it is NOT a file to commit: `mnema brief` carries the committed record and is',
        'written to be redirected into one; this carries what was kept on this machine too.',
        '',
        'Each line is the one the record already knows a note by (an observation’s topic,',
        'the start of a memory), with the id `mnema show <id>` reads whole. Cut where',
        '`mnema search` cuts, and it says how many there are in all when there are more.',
        '',
        'The notes that share a word with what this session touches come first, ranked',
        'as `mnema search` ranks: the files changed in the working tree, the tasks in',
        'progress, the name of the branch and the files of the last 3 commits, read with',
        'git and no lock, the record’s own directory left out. The rest are the newest.',
        'With nothing to read there, all of them are the newest. It says which, in a line.',
        'Above them, when another session that has stopped (its connection ended, or its journal has been',
        'quiet for 15 minutes) left a journal on this machine in the last 24 hours',
        '(`mnema switch off session-journal` stops it), a few lines say where it stopped:',
        'its goal, the decisions it recorded, and the counts it left. They can be switched off alone',
        '(`mnema switch off last-session`).',
        'It prints NOTHING when nothing is recorded, so a session opens with nothing added.',
        'It can be switched off (`mnema switch off recall-document`), and then it refuses.',
      ].join('\n'),
    )
    .option(
      '--hook',
      'print it for a Claude Code hook: whole notes up to what a hook carries, each section ' +
        'saying how many it left out' +
        ', and a refusal opens with its code alone on the first line of the error stream ' +
        '(a refusal of usage, such as an invalid --host, carries none: the hook is silent for it)',
    )
    .addOption(hookHostOption('the notes'))
    .option(
      '--session <id>',
      'the host’s id for the session these notes are for: the journal that session keeps is ' +
        'not "the last session", which a hook passes from the payload',
    )
    .option(
      '--after-a-compaction',
      'print, instead of the notes, what entered the record since the session named by --session opened, ' +
        'before its conversation was compacted, read from its journal: a sentence, or nothing',
    )
    .action(
      async (opts: {
        hook?: boolean;
        host?: string;
        session?: string;
        afterACompaction?: boolean;
      }) => {
        const host = hookHostOf(wiring, opts.hook === true, opts.host);
        if (host === false) return;
        if (opts.afterACompaction === true) {
          const { runAfterACompaction } = await import('../commands/compacted.js');
          const reminder = runAfterACompaction({ ...here(), session: opts.session });
          if (!reminder.ok) {
            reportRefusal(
              wiring,
              reminder,
              reminder.reason === 'SWITCHED_OFF' ? { SWITCHED_OFF: switchedOff(reminder) } : {},
              opts.hook === true,
            );
            return;
          }
          if (reminder.text !== undefined) io.out(reminder.text);
          return;
        }
        const { linkBreakNotice, newerLinesNotice } = await import('./integrity.js');
        const { runRecall } = await import('../commands/recall.js');
        const { recallDocument, recallWithin } = await import('../presentation/recall.js');
        const { hookCeilingOf, roomBeside } = await import('../presentation/within-a-hook.js');
        const ceiling = hookCeilingOf(host === null ? undefined : hookTextOf(host));
        const result = runRecall({ ...here(), session: opts.session });
        if (!result.ok) {
          reportRefusal(
            wiring,
            result,
            result.reason === 'SWITCHED_OFF' ? { SWITCHED_OFF: switchedOff(result) } : {},
            opts.hook === true,
          );
          return;
        }
        // On `err` for a person, as `brief` puts it: the state of the record's proof qualifies the
        // notes. With the flag the facts of integrity LEAD the text handed to the model, on stdout
        // (ADR-394, ADR-410), and nothing else is said on `err` by this verb; where there are no
        // notes there is no text to lead, and the verb stays as silent as it was (the opening
        // document says the fact).
        const integrity = linkBreakNotice(result.linkBreaks);
        // What is not integrity (a newer mnema wrote lines) stays on `err` even with the flag, under
        // the document, where the handler appends it; the room beside the document counts only what goes to `out`.
        const others = newerLinesNotice(result.newerLines, 'the record');
        const notice = [...integrity, ...others];
        // With the flag the facts of integrity are part of what has to fit: they lead the document on `out`.
        const document =
          opts.hook === true
            ? recallWithin(
                result,
                roomBeside(
                  integrity.map((line) => render(line)),
                  ceiling,
                ),
                ceiling.lengthOf,
              )
            : recallDocument(result);
        if (opts.hook === true && document.length === 0 && recallDocument(result).length > 0) {
          io.err(render(fact(NOTHING_HANDED_BECAUSE_IT_DOES_NOT_FIT, 0)));
        }
        if (opts.hook !== true) {
          for (const line of notice) io.err(render(line));
        } else if (document.length > 0) {
          for (const line of others) io.err(render(line));
          for (const line of integrity) io.out(render(line));
          if (integrity.length > 0) io.out('');
        }
        writeLines(io, document);
      },
    );
  return readsTheRecord(recall);
}
