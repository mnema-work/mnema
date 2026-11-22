/**
 * The `mnema words` wiring: what it declares, and what it prints.
 *
 * `mnema words --host <host>` reads the payload a host hands a hook on stdin, and keeps what the
 * person said in a file of this machine's, outside the record: the text of a prompt the host's
 * prompt hook delivers, or the option the person chose, delivered by the hook after the host's
 * question tool. The command is `persons-words.ts`.
 *
 * A HOST RUNS IT, NOT A PERSON, so it is `settled`'s shape: it exits 0 on every outcome that is not
 * a misuse of the verb itself, it prints `{}` on stdout (nothing for the host to read) and never
 * the words, and it writes nothing to the record. A host that has neither hook gets one line on the
 * second stream saying so.
 */

import type { Command } from 'commander';
import { HOST_NAMES } from '../host-names.js';
import { here } from './context.js';
import { enumeratedOption, listed } from './enumerated.js';
import { reportUsage } from './report.js';
import { type Declared, readsTheRecord, type Wiring } from './verb.js';

/** Registers `mnema words` on the program. */
export function registerWords(program: Command, wiring: Wiring): Declared {
  const { io, render } = wiring;
  const verb = program
    .command('words')
    .description(
      'keep, on this machine and outside the record, what the person typed or chose, from a host’s hook',
    )
    .addOption(
      enumeratedOption(
        '--host <host>',
        `the host whose hook runs this, and whose payload arrives on stdin: ${listed(HOST_NAMES)}`,
        HOST_NAMES,
      ).makeOptionMandatory(),
    )
    .addHelpText(
      'after',
      [
        '',
        'What it reads, what it keeps and what it prints:',
        '  The JSON a host hands a hook on stdin: the prompt hook (UserPromptSubmit, BeforeAgent,',
        '  userPromptSubmitted, beforeSubmitPrompt, an OpenCode plugin’s chat.message) or the hook',
        '  after the host’s question tool. It appends the text of the prompt (typed), or the option',
        '  labels chosen (chosen), to a file of this session on this machine: readable by you only,',
        '  beside the session journal, and let go with it. It writes nothing to the record, prints',
        '  {} and never the words. A host with neither hook is told so on the second stream.',
      ].join('\n'),
    )
    .action(async (opts: { host: string }) => {
      const { keepPersonsWords, noWords } = await import('../persons-words.js');
      const { fact } = await import('../presentation/detail.js');
      const host = HOST_NAMES.find((one) => one === opts.host);
      if (host === undefined) {
        reportUsage(wiring, `--host takes one of ${listed(HOST_NAMES)}, not "${opts.host}".`);
        return;
      }
      const payload = io.input === undefined ? '' : await io.input();
      const done = keepPersonsWords(here(), { host, payload });
      if (done.why !== undefined && done.why === noWords(host)) io.err(render(fact(done.why, 0)));
      io.out('{}');
    });
  return readsTheRecord(verb);
}
