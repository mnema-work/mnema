#!/usr/bin/env node
/**
 * What a person corrected, recorded as a proposal: at `Stop`, `mnema corrections` reads the
 * transcript the host names and records each place where the person corrected the agent as a
 * `proposed` decision in this machine's private tree.
 *
 * OFF UNTIL SOMEBODY SWITCHES IT ON (`mnema switch on user-corrections`). It is the one handler of
 * this plugin that reads what a person typed, and the one that writes without anybody typing a
 * verb, so it does nothing in a project that never asked for it: the verb answers `{}`, and a handler
 * that has nothing to say writes no byte.
 *
 * IT DECIDES NOTHING, AND IT CARRIES NO TEXT OF ITS OWN. The payload goes to the verb byte for byte
 * and its answer comes back byte for byte; which prompts are corrections, what is recorded and what
 * the line says are the verb's. The rule for running a verb is `hand-over.mjs`'s, and so is the
 * silence: no `mnema` on the PATH, no project, a transcript it could not read, the channel off. A
 * record that would not answer, one held by another process and a run cut by its time are one line in
 * the `systemMessage` (a `Stop` has no field the model reads without being sent back to work).
 */

/**
 * WHICH channel of the product's framing this handler carries: the name `record-framing.ts`
 * knows it by. Read from this SOURCE by the channel guard, never imported: importing this module
 * would run it.
 */
export const MODEL_CHANNEL = 'user-corrections';

/** The verb and nothing else: the event is in the payload. */
const VERB = ['corrections'];

try {
  const { whatTheVerbReports, whereTheSessionIs } = await import('./hand-over.mjs');
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const { answer, said } = whatTheVerbReports(
    VERB,
    whereTheSessionIs(),
    Buffer.concat(chunks).toString('utf-8'),
  );
  // A hook at the end of a response has no field the model reads without being sent back to work,
  // so a record that did not answer is said in the `systemMessage`, the channel the line above
  // already uses, and never outside the reply.
  if (answer !== null) process.stdout.write(answer);
  else if (said !== null) process.stdout.write(`${JSON.stringify({ systemMessage: said })}\n`);
} catch {
  // Silence: the one thing this handler must never do is make somebody else's session worse
  // than it would have been without the plugin installed.
}
