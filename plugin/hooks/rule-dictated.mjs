#!/usr/bin/env node
/**
 * When the person's message has the shape of a rule they dictated ("from now on, always …", "nunca
 * …", "put it as a rule"): `mnema dictated` hands the agent one sentence of fact beside the message,
 * that it may be a rule and which tools record and accept it. Nothing is recorded.
 *
 * IT DECIDES NOTHING, AND IT CARRIES NO TEXT OF ITS OWN. The payload goes to the verb byte for byte
 * and its answer comes back byte for byte; which messages have the shape and what the sentence says
 * are the verb's, and no word of the message is in it. The rule for running a verb is
 * `hand-over.mjs`'s, and so is the silence: no `mnema` on the PATH, no project, a message with no
 * such shape, the channel off. A record that would not answer, one held by another process and a
 * run cut by its time are one line in the reply's field for context (the record was not consulted).
 *
 * A HOST THAT READS THE PLUGIN'S HOOKS FILE AND SAYS IT IS THERE is named in `--unless` (from the
 * host table) and turned away before `mnema` starts: only the hosts this was read for (Claude Code,
 * Codex, and Gemini CLI through its own script) are handed the sentence.
 */

/**
 * WHICH channel of the product's framing this handler carries: the name `record-framing.ts`
 * knows it by. Read from this SOURCE by the channel guard, never imported: importing this module
 * would run it.
 */
export const MODEL_CHANNEL = 'dictated-rule';

try {
  const {
    aHostYields,
    reply,
    whatTheVerbReports,
    whereTheSessionIs,
    withoutTheFiltersOfTheHooksFile,
  } = await import('./hand-over.mjs');
  const argv = process.argv.slice(2);
  if (!aHostYields(argv, process.env)) {
    const chunks = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    const payload = Buffer.concat(chunks).toString('utf-8');
    const { answer, said } = whatTheVerbReports(
      ['dictated', ...withoutTheFiltersOfTheHooksFile(argv)],
      whereTheSessionIs(),
      payload,
    );
    // A record that did not answer is a line beside the message, in the reply this host reads, and
    // never outside the reply.
    if (answer !== null) process.stdout.write(answer);
    else if (said !== null) process.stdout.write(reply('UserPromptSubmit', said, argv));
  }
} catch {
  // Silence: the one thing this handler must never do is make somebody else's session worse
  // than it would have been without the plugin installed.
}
