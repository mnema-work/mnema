#!/usr/bin/env node
/**
 * What a person corrected, recorded as a proposal: at `Stop`, `mnema corrections` reads the
 * transcript the host names and records each place where the person corrected the agent as a
 * `proposed` decision in this machine's private tree.
 *
 * ON UNTIL SOMEBODY SWITCHES IT OFF (`mnema switch off user-corrections`; ADR-546). It began off, because it
 * is the one handler of this plugin that reads what a person typed and the one that writes without
 * anybody typing a verb; the premise fell because nobody switched it on. What it records goes to the
 * machine's private tree, and in a project that switched it off the verb answers `{}` and a handler
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

/**
 * The verb, and the handler's own arguments from the hooks file (`--host`, which says whose payload
 * this is): the event itself is in the payload. `--where` and `--unless` only say whether to start,
 * and are not handed on.
 */
const VERB = ['corrections'];

try {
  const {
    aHostYields,
    itIsVsCodesTranscript,
    theHostIsNotHere,
    theTranscriptIsNotRead,
    whatTheVerbReports,
    whereTheSessionIs,
    withoutTheFiltersOfTheHooksFile,
  } = await import('./hand-over.mjs');
  const argv = process.argv.slice(2);
  // A host that reads a hooks file it shares (Cursor reads Claude Code's) runs the command that is
  // another host's too: `--where` and `--unless` end it here, before `mnema` starts, and so does
  // `--reads no`, for a host whose transcript this product does not read yet.
  if (
    theHostIsNotHere(argv, process.env) ||
    aHostYields(argv, process.env) ||
    theTranscriptIsNotRead(argv)
  ) {
    process.exit(0);
  }
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  // VS Code's agent reads this file too and is told apart only by where its transcript is kept.
  if (itIsVsCodesTranscript(argv, Buffer.concat(chunks).toString('utf-8'))) process.exit(0);
  const { answer, said } = whatTheVerbReports(
    [...VERB, ...withoutTheFiltersOfTheHooksFile(argv)],
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
