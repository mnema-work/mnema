/**
 * The `mnema dictated` wiring: what it declares, and what it prints.
 *
 * `mnema dictated` reads the payload a host hands a hook when the person sends a message, on stdin,
 * and prints the reply that host reads: one sentence of fact for the agent, that the message has the
 * shape of a rule dictated and which tools record and accept it, or `{}`. The command is
 * `commands/dictated.ts`; the plugin's handler runs it.
 *
 * A HOST RUNS IT, NOT A PERSON, so it is `settled`'s shape: it exits 0 on every outcome that is not
 * a misuse of the verb itself. It is a read, and records nothing.
 */

import type { Command } from 'commander';
import { here } from './context.js';
import { type Declared, readsTheRecord, type Wiring } from './verb.js';

/** Registers `mnema dictated` on the program. */
export function registerDictated(program: Command, wiring: Wiring): Declared {
  const { io } = wiring;
  const verb = program
    .command('dictated')
    .description(
      'say to the agent, beside a message that has the shape of a rule the person dictated, which tools record and accept it',
    )
    .addHelpText(
      'after',
      [
        '',
        'What it reads and what it prints:',
        '  The JSON a host hands a hook when the person sends a message (UserPromptSubmit, or',
        '  BeforeAgent in Gemini CLI) on stdin. When the message is an instruction to keep (always,',
        '  never, from now on, a partir de agora, nunca, sempre followed by a verb in the imperative,',
        '  or put it as a rule, coloca como regra, in English or Portuguese), it prints the reply the',
        '  host reads: an additionalContext saying that the message has the shape of a rule, that only',
        '  a rule the person typed is to be accepted, that `record_decision` records it, that',
        '  `decision_transition` accepts it with a note quoting the person, and that nothing was',
        '  recorded from the message. It says no word of the message. A statement ("sempre dá',
        '  timeout"), a question, quoted or pasted text, a message that sets instructions aside, a',
        '  limit in time or place ("today", "here", "hoje", "aqui"), a step of the task ("then tell',
        '  me") and a condition ("if it works, make it a rule") are not rules. Accents are optional.',
        '  Otherwise, outside a project, or with the channel off, it prints {}.',
        '  It reads the message the host hands it and never the transcript, and writes nothing. It',
        '  can be switched off with `mnema switch off dictated-rule`.',
      ].join('\n'),
    )
    .action(async () => {
      const { runDictated } = await import('../commands/dictated.js');
      const payload = io.input === undefined ? '' : await io.input();
      const done = runDictated(here(), { payload });
      io.out(JSON.stringify(done.reply));
    });
  return readsTheRecord(verb);
}
