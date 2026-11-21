#!/usr/bin/env node
/**
 * What a subagent hands back, checked as it stops: a final reply that does not end in the block of
 * decisions the record asks of a subagent sends it back, once, with the format.
 *
 * IT DECIDES NOTHING. The payload the host hands a `SubagentStop` hook goes to `mnema handback`
 * byte for byte; whether the reply is in the format, and what the reason says, are the verb's.
 * This file only turns the verb's answer into what the host reads as "do not stop yet": the
 * reason on the second stream and exit 2 (Claude Code), or the same decision on stdout and exit 0
 * (`--host codex` and `--host copilot`, whose documentation reads it there; Copilot CLI makes exit 2
 * a warning). The rule for running a verb is `hand-over.mjs`'s.
 *
 * IT BLOCKS ONCE AND ONLY WHEN THE VERB SAYS SO. The verb is silent the second time the host asks
 * (`stop_hook_active`), when no project is here, when the channel is switched off
 * (`mnema switch off subagent-handback`), and for a reply it could not read; silence is no output
 * and exit 0, which a host reads as nothing to say.
 *
 * IT NEVER BLOCKS BY FAILING. No `mnema` on the PATH, a stranger of that name, an answer that is
 * not the verb's, an error of any kind: exit 0, so a subagent is never held by a hook that could not
 * do its work. A record that would not answer, one held by another process and a run cut by its time
 * are one line in the `systemMessage`, and nothing else is written.
 */

/**
 * WHICH channel of the product's framing this handler carries: the name `record-framing.ts`
 * knows it by. Read from this SOURCE by the channel guard, never imported: importing this module
 * would run it.
 */
export const MODEL_CHANNEL = 'subagent-handback';

/**
 * The verb, and the host the hooks file names with `--host`: the event is in the payload, never
 * guessed from a flag, and the flag says which host's payload it is.
 */
const VERB = ['handback'];

try {
  const { whatTheVerbReports, whereTheSessionIs, withoutTheFiltersOfTheHooksFile } = await import(
    './hand-over.mjs'
  );
  const argv = process.argv.slice(2);
  const host = argv.includes('--host') ? argv[argv.indexOf('--host') + 1] : 'claude';
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const { answer, said } = whatTheVerbReports(
    [...VERB, ...withoutTheFiltersOfTheHooksFile(argv)],
    whereTheSessionIs(),
    Buffer.concat(chunks).toString('utf-8'),
  );
  // A record that did not answer is said in the `systemMessage`: the field a model reads at the end
  // of a subagent would send it back to work, which a refusal is no reason for.
  if (said !== null) process.stdout.write(`${JSON.stringify({ systemMessage: said })}\n`);
  if (answer !== null) {
    const said = JSON.parse(answer);
    if (said?.decision === 'block' && typeof said.reason === 'string' && said.reason !== '') {
      // Claude Code reads exit 2 with the reason on the second stream (measured). Codex and Copilot
      // CLI read the decision itself on stdout with exit 0 (their documentation): Copilot CLI treats
      // exit 2 as a warning that lets the subagent go.
      if (host === 'claude') {
        process.stderr.write(`${said.reason}\n`);
        process.exitCode = 2;
      } else {
        process.stdout.write(`${JSON.stringify({ decision: 'block', reason: said.reason })}\n`);
      }
    }
  }
} catch {
  // Silence: the one thing this handler must never do is make somebody else's session worse
  // than it would have been without the plugin installed.
}
