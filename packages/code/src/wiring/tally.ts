/**
 * The `mnema tally` wiring: what it declares, and what it prints.
 *
 * `mnema tally` reads the payload a host hands a `Stop` hook, on stdin,
 * and prints the reply that host reads, on stdout: one line saying how many files the session's
 * own tool calls wrote and how many decisions were recorded since it opened, and `{}` when there is
 * nothing to count. It keeps the session journal (`session-journal.ts`) as it goes: a file on this
 * machine, outside the record, which is why the verb still says it reads the record and no more. The command is `commands/tally.ts`; the plugin's handler runs it.
 *
 * A HOST RUNS IT, NOT A PERSON, so it is `before-a-write`'s shape: it exits 0 on every outcome that
 * is not a misuse of the verb itself, and what it has to say about a payload it could not read goes
 * to the second stream, which the host logs and nobody decides by. `--host` says whose payload it
 * is (the field that names the event and the transcript differs by host), and the event is still read
 * from the payload: a flag that said which event it was would be a second opinion about it.
 */

import type { Command } from 'commander';
import { END_HOSTS, type EndHost } from '../host-names.js';
import { here } from './context.js';
import { enumeratedOption, listed } from './enumerated.js';
import { reportUsage } from './report.js';
import { type Declared, readsTheRecord, type Wiring } from './verb.js';

/** Registers `mnema tally` on the program. */
export function registerTally(program: Command, wiring: Wiring): Declared {
  const { io, render } = wiring;
  const verb = program
    .command('tally')
    .description('answer a host’s Stop hook with what the session wrote and recorded')
    .addOption(
      enumeratedOption(
        '--host <host>',
        `the host whose hook runs this, and whose payload arrives on stdin: ${listed(END_HOSTS)}; Claude Code's when it is not given`,
        END_HOSTS,
      ),
    )
    .addHelpText(
      'after',
      [
        '',
        'What it reads and what it prints:',
        '  The JSON a host hands a hook on stdin, with the transcript it names. On stdout, the reply',
        '  the host reads: a `systemMessage` saying how many files this session’s own tool calls',
        '  wrote and how many decisions were recorded in this project since it opened, and, when',
        '  events of the record are in no git commit yet, how many (`mnema record commit` is what',
        '  prepares them), and, on a second line, how many of those decisions still await a',
        '  person, or {} when',
        '  the hook is not the end of a turn, the session wrote no file in the last response, there is',
        '  no project here, or the transcript cannot be read. Only Claude Code’s transcript is read',
        '  today: for any other --host it says so on the second stream and counts and keeps nothing.',
        '  A response begins at a line Claude Code marks as typed by a person (origin.kind human):',
        '  a compaction summary, a local command and “[Request interrupted by user]” never count, a',
        '  slash command opens a response, and a transcript of an older Claude Code with no origin',
        '  yields no typed line of the person’s.',
        '  It writes nothing to the record. When the hook names its session it also keeps a small file on',
        '  this machine, the session journal (ids and counts, never what was said), and reads the',
        '  transcript from where the last reading stopped. `mnema switch off session-tally` stops the',
        '  line and `mnema switch off session-journal` stops the file.',
        '  With MNEMA_FOR_A_HOOK=1 in the environment (the hooks set it), a refusal opens with its',
        '  code alone on the first line of the error stream; typed by a person, nothing changes.',
      ].join('\n'),
    )
    .action(async (opts: { host?: string }) => {
      const host: EndHost | undefined =
        opts.host === undefined ? undefined : END_HOSTS.find((one) => one === opts.host);
      if (opts.host !== undefined && host === undefined) {
        reportUsage(wiring, `--host takes one of ${listed(END_HOSTS)}, not "${opts.host}".`);
        return;
      }
      const { runSessionTally } = await import('../commands/tally.js');
      const { fact } = await import('../presentation/detail.js');
      const payload = io.input === undefined ? '' : await io.input();
      const done = runSessionTally(here(), { payload, ...(host === undefined ? {} : { host }) });
      for (const note of done.notes) io.err(render(fact(note, 0)));
      io.out(JSON.stringify(done.reply));
    });
  return readsTheRecord(verb);
}
