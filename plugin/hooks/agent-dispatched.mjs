#!/usr/bin/env node
/**
 * What a session hands to other agents, kept in the record: after the host's `Agent` tool, and when a
 * session ends, `mnema dispatched` records one private task for the session and a private handoff
 * for each dispatch, and closes the task at the end (unless somebody switched `agent-mirror` off).
 *
 * IT DECIDES NOTHING, AND IT CARRIES NO TEXT OF ITS OWN. The payload goes to the verb byte for byte;
 * which event it is, what is recorded and what is never recorded (the prompt) are the verb's. The
 * rule for running a verb is `hand-over.mjs`'s, and so is the silence: no `mnema` on the PATH, no
 * project, the channel off.
 *
 * IT CARRIES NO CHANNEL OF THE PRODUCT'S FRAMING: what the verb prints is `{}`. What it writes to the
 * host is one line, and only where the record did not answer (a record that would not read, one held
 * by another process, a run cut by its time): after the host's agent tool, as the `additionalContext`
 * of a `PostToolUse` reply; at the end of a session, nothing, since nobody reads a line there.
 *
 * THE HOOKS FILE HANDS IT `--tools Agent,Task` on the hook after the host's agent tool, and no shell
 * in front: a hook command is one program and its arguments. VS Code runs a plugin's command on every
 * tool call whatever its matcher says, so the handler ends before it starts `mnema` for any tool that
 * is not named. The hook at the end of a session is given no tools and runs for what it is handed.
 *
 * IT NEVER FAILS A DISPATCH. Every outcome is exit 0.
 */

/**
 * WHICH channel of the product's framing this handler carries: the name `record-framing.ts` knows it
 * by. Read from this SOURCE by the channel guard, never imported: importing this module would run it.
 */
export const MODEL_CHANNEL = 'agent-mirror';

/** The verb and nothing else: the event, the tool and the session are in the payload. */
const VERB = ['dispatched'];

/**
 * The event a payload names, or `''` where it names none or is not JSON.
 *
 * @param {string} payload
 * @returns {string}
 */
function eventOf(payload) {
  try {
    const event = JSON.parse(payload)?.hook_event_name;
    return typeof event === 'string' ? event : '';
  } catch {
    return '';
  }
}

try {
  const { reply, theToolIsNotNamed, whatTheVerbReports, whereTheSessionIs } = await import(
    './hand-over.mjs'
  );
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const payload = Buffer.concat(chunks).toString('utf-8');
  // `--tools Agent,Task` is the hooks file's, on the hook after the host's agent tool; the hook at
  // the end of a session is given none and always runs.
  if (!theToolIsNotNamed(process.argv.slice(2), payload)) {
    const { said } = whatTheVerbReports(VERB, whereTheSessionIs(), payload);
    if (said !== null && eventOf(payload) === 'PostToolUse') {
      process.stdout.write(reply('PostToolUse', said));
    }
  }
} catch {
  // Silence: the one thing this handler must never do is make somebody else's session worse
  // than it would have been without the plugin installed.
}
