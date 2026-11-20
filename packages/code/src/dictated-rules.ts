/**
 * When a person dictates a rule in a message, as a shape a reader can check: no model, and no guess
 * about what a sentence means.
 *
 * WHAT IT IS FOR. "From now on, always run the linter before a commit" is a decision made by the one
 * who rules it, and the moment it is said is the one an agent least often records. This finds the
 * message that has that FORM, by a handful of shapes (an opening that says *always*, *never*, *from
 * now on*, or an explicit "put it as a rule"), each one a line of {@link DICTATED_RULE_SHAPES} with
 * the probes that prove it matches. Two readers use the table and no other: `mnema dictated`, which
 * tells the agent beside the message that it has the form of a rule, and the reader of a transcript
 * (`user-corrections.ts`), which records the same message as a proposal at the end of a response.
 * `CORRECTION_SHAPES` does not carry these lines: `decision-files.ts` reads that table to decide
 * whether a file written "keeps decisions", and a rule dictated is not a correction.
 *
 * WHAT IT DOES NOT CLAIM. A match says the message has the shape of a rule, never that it is one:
 * "always" opens a question's answer as often as a rule, and the agent, who has the whole message,
 * judges. The net is narrow on purpose (precision before reach): a miss costs the person one more
 * sentence, and a false alarm costs every message an agent has to read an instruction about.
 *
 * WHAT IT READS. The first {@link READ_UP_TO} characters of the message, outside blocks fenced by
 * three backticks, one sentence at a time; a sentence that ends in a question mark is not a rule.
 * A shape of an opening matches the START of a sentence, and an explicit expression matches
 * anywhere in one. It reads one message and keeps nothing of it.
 */

/** How much of a message is read: a rule is said near the start, and a long paste is about something else. */
export const READ_UP_TO = 2000;

/** The most of a matched sentence that is ever quoted (a transcript reader's proposal). */
const AT_MOST_QUOTED = 280;

/** One shape of a rule dictated: the label the product names it by, and the pattern tried on a sentence. */
export interface DictatedRuleShape {
  /** The product's own label for the shape, written the way the person says it. */
  readonly name: string;
  /** Where in the sentence the pattern is tried. */
  readonly at: 'start' | 'anywhere';
  readonly pattern: RegExp;
}

/**
 * Every form this reader knows, in English and Portuguese, the two the person who wrote it types in.
 * A table and not a list in a function, so a reader of the record can name the shape a proposal came
 * from, and so a shape added is a line somebody has to write a probe for
 * (`a-dictated-rule-is-said.test.ts` holds a positive in each language and a negative for each).
 */
export const DICTATED_RULE_SHAPES: readonly DictatedRuleShape[] = [
  { name: 'always …', at: 'start', pattern: /^always\b/i },
  { name: 'never …', at: 'start', pattern: /^never\b(?!\s+mind\b)/i },
  { name: 'from now on …', at: 'start', pattern: /^from\s+now\s+on\b/i },
  { name: 'going forward …', at: 'start', pattern: /^going\s+forward\b/i },
  { name: 'sempre …', at: 'start', pattern: /^sempre\b/i },
  { name: 'nunca …', at: 'start', pattern: /^nunca\b(?!\s+vi\b)/i },
  { name: 'a partir de agora …', at: 'start', pattern: /^a\s+partir\s+de\s+agora\b/i },
  { name: 'daqui pra frente …', at: 'start', pattern: /^daqui\s+(pra|para)\s+frente\b/i },
  { name: 'de agora em diante …', at: 'start', pattern: /^de\s+agora\s+em\s+diante\b/i },
  {
    name: 'put it as a rule',
    at: 'anywhere',
    pattern: /\b(put|make|keep|record)\s+(it|this|that)\s+as\s+a\s+rule\b/i,
  },
  { name: 'as a rule: …', at: 'anywhere', pattern: /\bas\s+a\s+rule:/i },
  {
    name: 'coloca como regra',
    at: 'anywhere',
    pattern:
      /\b(coloca|coloque|põe|ponha|registra|registre|grava|grave)\s+(isso\s+|isto\s+)?como\s+regra\b/i,
  },
  { name: 'isso é regra', at: 'anywhere', pattern: /\bisso\s+é\s+(uma\s+)?regra\b/i },
  { name: 'vira regra', at: 'anywhere', pattern: /\bvira\s+regra\b/i },
];

/** A block fenced by three backticks, an unclosed one running to the end of the text. */
const FENCED = /```[\s\S]*?(?:```|$)/g;

/** What can stand before the first word of a sentence without being part of it: a list mark, a quote. */
const BEFORE_A_SENTENCE = /^[\s>*•"'“‘(-]+/;

/** The sentences of `text` that can be a rule: fences removed, each one on a line, none that asks. */
function sentencesOf(text: string): readonly string[] {
  const unfenced = text.slice(0, READ_UP_TO).replace(FENCED, ' ');
  const parts = unfenced.split(/(?<=[.!?])\s+|\n+|;\s*/);
  return parts
    .map((part) => part.replace(/\s+/g, ' ').trim())
    .filter((part) => part !== '' && !/\?["')”’]*$/.test(part));
}

/** What was found: the shape's label, and the sentence it matched, on one line. */
export interface DictatedRule {
  readonly shape: string;
  readonly sentence: string;
}

/** The shape of a rule dictated that `text` has, or `undefined`: the first sentence and shape that match. */
export function dictatedRuleIn(text: string): DictatedRule | undefined {
  for (const sentence of sentencesOf(text)) {
    const opening = sentence.replace(BEFORE_A_SENTENCE, '');
    for (const shape of DICTATED_RULE_SHAPES) {
      if (shape.pattern.test(shape.at === 'start' ? opening : sentence)) {
        return { shape: shape.name, sentence: sentence.slice(0, AT_MOST_QUOTED) };
      }
    }
  }
  return undefined;
}
