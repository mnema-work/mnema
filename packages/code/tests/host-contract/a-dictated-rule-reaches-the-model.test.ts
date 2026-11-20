/**
 * A DICTATED RULE REACHES THE MODEL, in the real host: when the person's message has the shape of a
 * rule they dictated, the plugin's `UserPromptSubmit` hook hands the agent one sentence beside the
 * message, and the next request to the model carries it. With the channel switched off, the hook
 * runs and nothing is added.
 *
 * WHAT IS HELD HERE AND WHAT IS NOT. The product's half (which messages have the shape, the
 * sentence, the silence) is `a-dictated-rule-is-said.test.ts`. What it cannot say is that the host
 * fires the hook for a message under the hooks file the plugin declares and puts the reply in front
 * of the model, and that the message is handed to the hook as `prompt`.
 *
 * NOT HELD: that the model records anything.
 */

import { describe, expect, it } from 'vitest';
import { dictatedSentence } from '../../src/commands/dictated.js';
import { aHostForEachCase, everyBlockOf } from './support/the-host.js';

const RULE = 'From now on, always run the linter before a commit.';

/** What a `UserPromptSubmit` hook added beside the message, in the first request of the session. */
function addedBesideTheMessage(blocks: readonly string[]): string[] {
  return blocks.filter((block) =>
    block.startsWith('<system-reminder>\nUserPromptSubmit hook additional context:'),
  );
}

describe('a dictated rule reaches the model', () => {
  const start = aHostForEachCase();

  it('hands the sentence to the request that carries the message', async () => {
    const session = await start({ prompt: RULE });
    const first = session.messages[0];
    expect(first).toBeDefined();
    const blocks = first === undefined ? [] : everyBlockOf(first);
    expect(blocks.some((block) => block.includes(RULE))).toBe(true);
    const added = addedBesideTheMessage(blocks).join('\n');
    expect(added).toContain(dictatedSentence({ shape: 'from now on …' }, 'on'));
    // The sentence is the product's own: none of the message's words is in it.
    expect(added).not.toContain('linter');
  }, 120_000);

  it('adds nothing beside a message that has no such shape', async () => {
    const session = await start({ prompt: 'Say hi.' });
    const first = session.messages[0];
    const blocks = first === undefined ? [] : everyBlockOf(first);
    expect(addedBesideTheMessage(blocks)).toEqual([]);
  }, 120_000);

  it('with the channel switched off, the hook runs and nothing reaches the model', async () => {
    const session = await start({
      prompt: RULE,
      project: (it) => {
        it.mnema('switch', 'off', 'dictated-rule', '--reason', 'not in this project');
      },
    });
    const first = session.messages[0];
    const blocks = first === undefined ? [] : everyBlockOf(first);
    expect(blocks.some((block) => block.includes(RULE))).toBe(true);
    expect(addedBesideTheMessage(blocks)).toEqual([]);
  }, 120_000);
});
