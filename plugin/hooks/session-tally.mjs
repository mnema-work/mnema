#!/usr/bin/env node
/**
 * What the session did, said as a fact: at the end of a response that wrote a file, a line saying
 * how many files the session's own tool calls wrote and how many decisions were recorded since it
 * opened. The same run keeps the session's journal, which is what `session-compacted.mjs` reads back
 * after a compaction.
 *
 * IT DECIDES NOTHING, AND IT CARRIES NO TEXT OF ITS OWN. The payload the host hands a `Stop`
 * hook goes to `mnema tally` byte for byte and its answer comes back byte for
 * byte; what was counted and what the line says are the verb's, which reads the
 * transcript the payload names and the record. The rule for running a verb is `hand-over.mjs`'s.
 *
 * NO MODEL IS CALLED, and nothing is written to the record: the line is a count, in the words the
 * other handlers use for a fact (what was counted, and from where) and not an instruction.
 *
 * IT NEVER BLOCKS BY FAILING. Every outcome that is not an answer is exit 0, and nearly all are silence:
 * no `mnema` on the PATH, no project, a transcript it could not read, the channel switched off
 * (`mnema switch off session-tally`). Silence is no output at all, which a host reads as nothing to
 * say. The exception is a record that would not answer, one held by another process or a run cut by
 * its time: one line in the `systemMessage`, since a `Stop` has no field the model reads without
 * being sent back to work.
 */

/**
 * WHICH channel of the product's framing this handler carries: the name `record-framing.ts`
 * knows it by. Read from this SOURCE by the channel guard, never imported: importing this module
 * would run it.
 */
export const MODEL_CHANNEL = 'session-tally';

/**
 * The verb, and the handler's own arguments from the hooks file (`--host`, which says whose payload
 * this is): the event itself is in the payload, never guessed from a flag. `--where` and `--unless`
 * only say whether to start, and are not handed on.
 */
const VERB = ['tally'];

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
