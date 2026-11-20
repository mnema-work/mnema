/**
 * An agent ruling a decision in force: free, always on the record, always said, and with a
 * switch for whoever wants it shut.
 *
 * THE DECISION THIS FILE CARRIES, as the person who owns the product made it: *"the agent may
 * do that freely, keeping the record's trail and a notice to the user, and there could even be a
 * setting."* So an agent's `accept` is NOT refused by default and is NOT held for a person.
 * What the product owes instead is the three things the sentence names:
 *   - the trail: the accepting event's envelope already says which agent executed it, and the
 *     readings (`show`, `brief`, the console) say it from there; nothing is added to the
 *     record;
 *   - the notice: the tool's reply says the acceptance was recorded as an agent's (the CLI says
 *     it too, when an agent drives it with `--which`), and the document the next session opens
 *     with marks every rule an agent accepted (`presentation/brief.ts`);
 *   - the setting: `agent-accepts` is a channel like the others, a fact recorded by `mnema
 *     switch off agent-accepts`, and with it off an accept with no person at a terminal is refused in
 *     words that say how to turn it back on and where a person accepts instead.
 *
 * WHO IS AN AGENT HERE is who the envelope says: an act with a `which` on it. Through the MCP
 * server that is every act (the server's `which` is the connecting client); through the command
 * line it is an act declared with `--which`. Whether the human at the keyboard typed what the
 * agent ran is a fact about the machine this product cannot see, and it does not pretend to.
 */

import { channelStates, type ScopedCache } from '@mnema/context';
import type { DecisionAction } from '@mnema/core';
import { oneLine } from './one-line.js';
import { AGENT_ACCEPTS_CHANNEL } from './record-framing.js';

/** The one action the switch is about, typed so a rename in the workflow does not leave it behind. */
const ACCEPT: DecisionAction = 'accept';

/** The two moves of a pattern that change what governs: it comes into force, or falls out of it. */
const SKILL_ACTIONS_OF_A_PERSON: readonly string[] = ['adopt', 'deprecate'];

/** The other action that takes a decision out of the rule with the switch off: replacing it. */
const SUPERSEDE: DecisionAction = 'supersede';

/** The code a refused acceptance, or a refused supersede, carries. */
export const AGENT_ACCEPTS_IS_OFF = 'AGENT_ACCEPTS_IS_OFF';

/** The code a refused switching-on of `agent-accepts` carries. */
export const AGENT_ACCEPTS_NEEDS_A_PERSON = 'AGENT_ACCEPTS_NEEDS_A_PERSON';

/**
 * Whether this accept, supersede, or adoption or deprecation of a pattern may be made: `undefined` when it may, and the refusal's code and
 * words when the switch is off and the act is not a person's. A `supersede` is asked like an
 * `accept` because it is the other way an act takes a decision out of force or puts one in its
 * place (a merely proposed successor leaves nothing in force). A `reject` is not asked.
 *
 * WHO IS A PERSON HERE, with the switch off, is read from the SEAT as well as from the envelope:
 * an accept that declares an agent is refused, and an accept that declares none is refused too
 * unless it is made at a terminal (`atATerminal`: the door's own answer, a pair of TTYs on the
 * command line and in the library, never true through the MCP server, whose stdio is the host's
 * pipe). That is a heuristic, said as one in `docs/what-it-proves.md`: a script run in a terminal
 * is a person's seat to it. The seat is asked and not recorded.
 */
export function agentMayAccept(
  sources: readonly ScopedCache[],
  move: {
    readonly action: string;
    readonly agent: string | undefined;
    readonly atATerminal: boolean;
  },
): { readonly code: string; readonly message: string } | undefined {
  const ofAPattern = SKILL_ACTIONS_OF_A_PERSON.includes(move.action);
  if (move.action !== ACCEPT && move.action !== SUPERSEDE && !ofAPattern) return undefined;
  if (move.agent === undefined && move.atATerminal) return undefined;
  const state = channelStates(sources, [AGENT_ACCEPTS_CHANNEL])[0];
  if (state === undefined || state.on) return undefined;
  const who = move.agent === undefined ? 'no agent declared and no terminal here' : 'an agent';
  const switchedOff = `${AGENT_ACCEPTS_CHANNEL} was switched off by ${oneLine(state.by ?? '')} at ${oneLine(state.at ?? '')}, `;
  if (ofAPattern) {
    return {
      code: AGENT_ACCEPTS_IS_OFF,
      message:
        `${switchedOff}and this ${move.action} is from ${who}: only a person at a terminal adopts or deprecates a pattern here, ` +
        'because that changes what governs, and a person at a terminal turns the switch back on ' +
        '(`mnema switch on agent-accepts`). The pattern was not moved.',
    };
  }
  if (move.action === SUPERSEDE) {
    return {
      code: AGENT_ACCEPTS_IS_OFF,
      message:
        `${switchedOff}and this supersede is from ${who}: only a person at a terminal replaces a decision here, ` +
        'because replacing one takes it out of force, and a person at a terminal turns the switch back on ' +
        '(`mnema switch on agent-accepts`). The decision was not moved.',
    };
  }
  return {
    code: AGENT_ACCEPTS_IS_OFF,
    message:
      `${switchedOff}and this accept is from ${who}: only a person at a terminal accepts a decision here ` +
      '(`mnema decision review`), and a person at a terminal turns the switch back on ' +
      '(`mnema switch on agent-accepts`) to let an agent accept again. ' +
      'The decision was not moved.',
  };
}

/**
 * Whether this switch may be made: `undefined` when it may, and the refusal when it turns
 * `agent-accepts` back ON and the act is not a person's. Switching it off is open to anyone, and so is
 * every other channel: the brake is the party it brakes's to apply, never to release. WHO IS A PERSON is
 * read as `agentMayAccept` reads it: no agent declared and `atATerminal`.
 */
export function mayTurnAgentAcceptsOn(move: {
  readonly channel: string;
  readonly on: boolean;
  readonly agent: string | undefined;
  readonly atATerminal: boolean;
}): { readonly code: string; readonly message: string } | undefined {
  if (move.channel !== AGENT_ACCEPTS_CHANNEL || !move.on) return undefined;
  if (move.agent === undefined && move.atATerminal) return undefined;
  const who = move.agent === undefined ? 'no agent declared and no terminal here' : 'an agent';
  return {
    code: AGENT_ACCEPTS_NEEDS_A_PERSON,
    message:
      `Switching ${AGENT_ACCEPTS_CHANNEL} on is from ${who}: only a person at a terminal turns it back on, ` +
      'since it is the brake on what an agent may accept. Switching it off is open to anyone. Nothing was switched.',
  };
}

/**
 * What an acceptance by an agent says about itself, in the reply to the agent that made it:
 * a statement of what is now true, which is also what a person reading the transcript needs.
 */
export function acceptedByAnAgent(agent: string): string {
  return (
    `This acceptance is recorded as made by an agent (${oneLine(agent)}), not by a person: ` +
    'the record keeps which agent executed it, `mnema show <id>` and the document a session ' +
    'opens with say so beside the rule, and the decision now governs as accepted. ' +
    'Whether agents may accept is a switch: `mnema switch off agent-accepts` stops it.'
  );
}

/** Who is told the state of a decision just recorded, which decides how the accept is spelled. */
export type WhoIsTold = 'agent-tool' | 'agent-command' | 'person';

/** What the switch `agent-accepts` is, as far as it could be told: on, off, or not readable. */
export type AcceptState = 'on' | 'off' | 'unreadable';

/**
 * What a decision just recorded says about its own state and about when an agent accepts it: the
 * one place the rule is worded for the replies of the tool and of the command. A decision is born
 * `proposed`; where the person dictated it, or chose it among the options an agent offered (a
 * recommended one included), the agent accepts it at once with a note quoting the answer; where
 * the agent concluded it alone, it waits for the person. With the switch off only a person accepts.
 *
 * A SWITCH THAT COULD NOT BE READ is a third state and says so: it is not "switched off", which
 * would be a fact nobody recorded. A person accepts, which no instruction can be set against.
 * `command` is the decision's id and the declared agent, which the command-line wording prints.
 */
export function stateOfANewDecision(
  state: AcceptState,
  who: WhoIsTold,
  command?: { readonly id: string; readonly agent: string },
): string {
  const born = '  Born proposed, so not yet in force.';
  const review = '`mnema decision review`';
  if (who === 'person') return `${born} A person accepts it with ${review}.`;
  if (state === 'off') {
    return `${born} Here only a person accepts it (${review}): \`agent-accepts\` is switched off.`;
  }
  if (state === 'unreadable') {
    return `${born} The switch \`agent-accepts\` could not be read, so only a person accepts it here (${review}).`;
  }
  const how =
    who === 'agent-tool' || command === undefined
      ? '`decision_transition` (action `accept`)'
      : `\`mnema decision move accept ${oneLine(command.id)} --which ${oneLine(command.agent)}\``;
  return (
    `${born} If the person dictated it, or chose it among options you offered ` +
    `(a recommended one included), accept it now with ${how}, the note quoting their answer; ` +
    `if you concluded it alone, it waits for the person (${review}).`
  );
}

/** Whether an agent may accept here now, asked with no decision in hand: a source that cannot be read is `unreadable`. */
export function acceptStateHere(sources: readonly ScopedCache[]): AcceptState {
  try {
    return agentMayAccept(sources, { action: ACCEPT, agent: 'an-agent', atATerminal: false }) ===
      undefined
      ? 'on'
      : 'off';
  } catch {
    return 'unreadable';
  }
}
