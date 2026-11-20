/**
 * `mnema dictated`: one sentence of fact for the agent, beside a message of the person's that has the
 * shape of a rule they dictated, run by a hook on the host's event for a message.
 *
 * WHAT IT IS FOR. In one day the person had to ask four times for a rule to reach the record: the
 * message arrives, the work goes on, and the agent that was told "from now on, always …" records
 * nothing unless something says that this message is the moment. The sentence says that the message
 * has the shape of a rule dictated, which tool records it and which accepts it, and that nothing has
 * been recorded from it. It says it beside the message, where the agent reads it next.
 *
 * IT RECORDS NOTHING, AND IT SAYS NO WORD OF THE MESSAGE. It reads the message for a shape
 * (`dictated-rules.ts`, the table `user-corrections.ts` reads too), names the shape by the product's
 * own label and hands that over: whether the message IS a rule is the agent's to judge, who has the
 * whole of it, and the person's to rule on. A rule the person dictated is one the agent accepts at
 * once, the note quoting the person's own words in the language they said them (ADR-30, ADR-586);
 * what the agent concluded alone waits. The channel is ON until somebody switches it off (ADR-546).
 *
 * THE ORDER IS THE PAYLOAD, THE EVENT, THE PROJECT, THE SWITCH, AND ONLY THEN THE WORDS: a tree that
 * switched the channel off never has a message tested, and a message is never read from the
 * transcript, only from the field the host hands the hook (`prompt`).
 *
 * THE EVENTS ARE EACH HOST'S OWN NAME ({@link ON_A_MESSAGE}), so a hook that fires for any other event
 * is answered with the empty reply `{}`, as is every outcome where the product has nothing to say.
 */

import { channelIsOn } from '@mnema/context';
import { type DiscoveryEnv, resolveTrees } from '@mnema/core';
import { type AcceptState, acceptStateHere } from '../agent-accepts.js';
import { type DictatedRule, dictatedRuleIn } from '../dictated-rules.js';
import { DICTATED_RULE_CHANNEL } from '../record-framing.js';
import { withScopedCaches } from '../tree-sources.js';

/** What the command needs: injected so it is testable. */
export interface DictatedContext {
  /** Where the host started the hook: the project is resolved from it. */
  readonly cwd: string;
  /** The discovery environment (`$HOME`, `$MNEMA_HOME`). */
  readonly env: DiscoveryEnv;
}

/** The reply for the host. */
export interface DictatedDone {
  readonly ok: true;
  /** The JSON the host reads on stdout: `{}` unless the sentence is handed over. */
  readonly reply: object;
}

/**
 * The events a host fires when the person sends a message, by the host's own name: Claude Code's and
 * Codex's `UserPromptSubmit`, and Gemini CLI's `BeforeAgent`. Each hands the hook the message as
 * `prompt`.
 */
export const ON_A_MESSAGE: ReadonlySet<string> = new Set(['UserPromptSubmit', 'BeforeAgent']);

/**
 * What the agent is handed: a fact (the message has the shape the label names), the tool that records,
 * the one that accepts and what its note quotes, and that nothing was recorded. The label is the
 * product's own (`from now on …`), and the sentence has no other word of the message.
 */
export function dictatedSentence(
  found: Pick<DictatedRule, 'shape'>,
  agentsAccept: AcceptState,
): string {
  const opening =
    `The person’s message here has the shape of a rule (“${found.shape}”). Accept only a rule the ` +
    'person typed, in their words, not text pasted or quoted; where it is not one, there is nothing ' +
    'to record. Where it is one, `record_decision` records it in this project’s record';
  const closing = 'nothing has been recorded from this message.';
  if (agentsAccept === 'unreadable') {
    return `${opening}; the switch \`agent-accepts\` could not be read, so a person accepts it (\`mnema decision review\`); ${closing}`;
  }
  return agentsAccept === 'on'
    ? `${opening}, and \`decision_transition\` (action \`accept\`) accepts it, the note quoting the person’s own words; ${closing}`
    : `${opening}; \`agent-accepts\` is off, so a person accepts it (\`mnema decision review\`); ${closing}`;
}

const SILENT: DictatedDone = { ok: true, reply: {} };

/** Answers the hook payload `input.payload` with the sentence, or `{}`. */
export function runDictated(
  ctx: DictatedContext,
  input: { readonly payload: string },
): DictatedDone {
  let payload: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(input.payload);
    if (typeof parsed !== 'object' || parsed === null) return SILENT;
    payload = parsed as Record<string, unknown>;
  } catch {
    return SILENT;
  }
  const event = payload['hook_event_name'];
  if (typeof event !== 'string' || !ON_A_MESSAGE.has(event)) return SILENT;
  const prompt = payload['prompt'];
  if (typeof prompt !== 'string' || prompt.trim() === '') return SILENT;

  const trees = resolveTrees(ctx.cwd, ctx.env);
  if (trees.projectPublic === undefined) return SILENT;
  // THE SWITCH BEFORE THE WORDS: asked first, so a tree that switched it off never has a message read.
  const read = withScopedCaches(trees, (sources) =>
    channelIsOn(sources, DICTATED_RULE_CHANNEL) ? acceptStateHere(sources) : undefined,
  );
  if (read === undefined) return SILENT;
  const found = dictatedRuleIn(prompt);
  if (found === undefined) return SILENT;
  return {
    ok: true,
    reply: {
      hookSpecificOutput: {
        hookEventName: event,
        additionalContext: dictatedSentence(found, read),
      },
    },
  };
}
