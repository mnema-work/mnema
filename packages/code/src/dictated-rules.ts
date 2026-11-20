/**
 * When a person dictates a rule in a message, as a shape a reader can check: no model, and no guess
 * about what a sentence means.
 *
 * WHAT IT IS FOR. "From now on, always run the linter before a commit" is a decision made by the one
 * who rules it, and the moment it is said is the one an agent least often records. This finds the
 * message that has that FORM: an INSTRUCTION, which is a trigger (*always*, *never*, *from now on*,
 * *a partir de agora* and the like) followed by a verb in the imperative, or an explicit "put it as a
 * rule". Each shape is a line of {@link DICTATED_RULE_SHAPES} with the probes that prove it matches.
 * Two readers use the table and no other: `mnema dictated`, which tells the agent beside the message
 * that it has the form of a rule, and the reader of a transcript (`user-corrections.ts`), which leaves
 * that sentence to the hook while its channel is on and records the message as a proposal where it is
 * off. `CORRECTION_SHAPES` does not carry these lines: `decision-files.ts` reads that table to decide
 * whether a file written "keeps decisions", and a rule dictated is not a correction.
 *
 * WHAT IT DOES NOT CLAIM. A match says the message has the shape of a rule, never that it is one, and
 * the agent, who has the whole message, judges. The net is narrow on purpose (precision before
 * reach): "sempre dá timeout no CI" and "from now on the tests pass" are statements, not
 * instructions, and do not match, because the word after the trigger is not an imperative verb. A
 * miss costs the person one more sentence, and a false alarm costs every message an agent has to read
 * a sentence about.
 *
 * WHAT IT READS. The first {@link READ_UP_TO} characters of the message, outside blocks fenced by
 * three backticks, one sentence at a time; a sentence that ends in a question mark is not a rule. A
 * sentence that opens with a quote mark, a `>` or any mark other than a space is somebody else's text
 * (a quotation, a blockquote, a pasted issue) and is not read. A message that tells the agent to
 * ignore its instructions, and a sentence that tells it to accept or approve decisions, is never a rule
 * (`a-dictated-rule-is-said.test.ts`). It reads one message and keeps nothing of it.
 */

/** How much of a message is read: a rule is said near the start, and a long paste is about something else. */
export const READ_UP_TO = 2000;

/** The most of a matched sentence that is ever quoted (a transcript reader's proposal). */
const AT_MOST_QUOTED = 280;

/**
 * The imperative verbs a rule opens its instruction with: the ones people give a coding agent. A
 * word after the trigger that is not on the list (a noun, an article, a verb in the indicative) makes
 * the sentence a statement. Kept short on purpose: a verb missing from it is a rule the person says
 * once more, and a verb too many is a statement that lights the hook.
 */
const IMPERATIVES_EN = [
  'add',
  'ask',
  'avoid',
  'call',
  'check',
  'cite',
  'commit',
  'confirm',
  'create',
  'delete',
  'do',
  "don't",
  'document',
  'ensure',
  'export',
  'follow',
  'format',
  'import',
  'keep',
  'link',
  'log',
  'make',
  'name',
  'open',
  'prefer',
  'push',
  'put',
  'read',
  'record',
  'remove',
  'rename',
  'review',
  'run',
  'say',
  'show',
  'start',
  'stop',
  'tell',
  'test',
  'update',
  'use',
  'validate',
  'verify',
  'wait',
  'write',
];

/** The same, in Portuguese: the imperative of `você`, and `não` which opens a negative one. */
const IMPERATIVES_PT = [
  'abra',
  'adicione',
  'anote',
  'apague',
  'avise',
  'chame',
  'cite',
  'comente',
  'confira',
  'coloque',
  'confirme',
  'crie',
  'documente',
  'escreva',
  'evite',
  'exporte',
  'faça',
  'feche',
  'formate',
  'importe',
  'junte',
  'leia',
  'mantenha',
  'mostre',
  'nomeie',
  'não',
  'pergunte',
  'peça',
  'prefira',
  'pare',
  'ponha',
  'deixe',
  'inclua',
  'registre',
  'remova',
  'renomeie',
  'revise',
  'rode',
  'rode',
  'siga',
  'teste',
  'use',
  'valide',
  'verifique',
];

const VERB_EN = `(?:${IMPERATIVES_EN.join('|')})`;
const VERB_PT = `(?:${IMPERATIVES_PT.join('|')})`;
/** What can stand between a trigger and its verb. */
const POLITE_EN = '(?:please,?\\s+)?';
const POLITE_PT = '(?:por\\s+favor,?\\s+)?';
const ADVERB_EN = '(?:(?:always|never)\\s+)?';
const ADVERB_PT = '(?:(?:sempre|nunca)\\s+)?';

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
  {
    name: 'always …',
    at: 'start',
    pattern: new RegExp(`^always\\s+${POLITE_EN}${VERB_EN}\\b`, 'i'),
  },
  { name: 'never …', at: 'start', pattern: new RegExp(`^never\\s+${POLITE_EN}${VERB_EN}\\b`, 'i') },
  {
    name: 'from now on …',
    at: 'start',
    pattern: new RegExp(`^from\\s+now\\s+on,?\\s+${POLITE_EN}${ADVERB_EN}${VERB_EN}\\b`, 'i'),
  },
  {
    name: 'going forward …',
    at: 'start',
    pattern: new RegExp(`^going\\s+forward,?\\s+${POLITE_EN}${ADVERB_EN}${VERB_EN}\\b`, 'i'),
  },
  {
    name: 'sempre …',
    at: 'start',
    pattern: new RegExp(`^sempre\\s+${POLITE_PT}${VERB_PT}\\b`, 'i'),
  },
  {
    name: 'nunca …',
    at: 'start',
    pattern: new RegExp(`^nunca\\s+(?:mais\\s+)?${POLITE_PT}${VERB_PT}\\b`, 'i'),
  },
  {
    name: 'a partir de agora …',
    at: 'start',
    pattern: new RegExp(
      `^a\\s+partir\\s+de\\s+agora,?\\s+${POLITE_PT}${ADVERB_PT}${VERB_PT}\\b`,
      'i',
    ),
  },
  {
    name: 'daqui pra frente …',
    at: 'start',
    pattern: new RegExp(
      `^daqui\\s+(?:pra|para)\\s+frente,?\\s+${POLITE_PT}${ADVERB_PT}${VERB_PT}\\b`,
      'i',
    ),
  },
  {
    name: 'de agora em diante …',
    at: 'start',
    pattern: new RegExp(
      `^de\\s+agora\\s+em\\s+diante,?\\s+${POLITE_PT}${ADVERB_PT}${VERB_PT}\\b`,
      'i',
    ),
  },
  {
    name: 'put it as a rule',
    at: 'anywhere',
    pattern:
      /(?:^|,\s*)(?:please\s+)?(?:put|make|keep|record)\s+(?:it|this|that)\s+as\s+a\s+rule\b/i,
  },
  { name: 'as a rule: …', at: 'start', pattern: /^as\s+a\s+rule:/i },
  {
    name: 'coloca como regra',
    at: 'anywhere',
    pattern:
      /(?:^|,\s*)(?:por\s+favor,?\s+)?(?:coloca|coloque|põe|ponha|registra|registre|grava|grave|anota|anote)\s+(?:isso\s+|isto\s+)?como\s+regra\b/i,
  },
  {
    name: 'isso é regra',
    at: 'anywhere',
    pattern:
      /(?:^|,\s*)(?:isso|isto)\s+é\s+(?:uma\s+)?regra(?:\s+(?:do\s+projeto|aqui|daqui\s+pra\s+frente))?[.!]*$/i,
  },
  {
    name: 'vira regra',
    at: 'anywhere',
    pattern: /(?:^|,\s*)(?:(?:isso|isto|essa|esta)\s+)?vira\s+regra[.!]*$/i,
  },
];

/** A block fenced by three backticks, an unclosed one running to the end of the text. */
const FENCED = /```[\s\S]*?(?:```|$)/g;

/**
 * Said to the agent to set its instructions aside: a message that has it is somebody else's text or an
 * attack, and no rule in it is the person's.
 */
const SETS_INSTRUCTIONS_ASIDE =
  /\b(?:ignore|disregard|forget)\s+(?:all\s+|any\s+)?(?:the\s+)?(?:previous|prior|above|earlier)\s+(?:instructions|rules|messages)|\b(?:ignore|esque[cç]a)\s+(?:as\s+)?instru[cç][õo]es\s+anteriores/i;

/** A sentence that tells the agent to accept or approve decisions is the brake's business, never a rule. */
const TELLS_TO_ACCEPT =
  /\b(?:approv\w*|accept\w*|aprov\w*|aceit\w*)\b.*\b(?:decision\w*|decis[aã]o|decis[oõ]es|rule\w*|regra\w*|everything|tudo)\b/i;

/** The sentences of `text` that can be a rule: fences removed, each one on a line, none that asks. */
function sentencesOf(text: string): readonly string[] {
  const unfenced = text.slice(0, READ_UP_TO).replace(FENCED, ' ');
  return unfenced
    .split(/(?<=[.!?])\s+|\n+|;\s*/)
    .map((part) => part.replace(/\s+/g, ' ').trim())
    .filter((part) => part !== '' && !/\?["')”’]*$/.test(part));
}

/** What was found: the shape's label, and the sentence it matched, on one line. */
export interface DictatedRule {
  readonly shape: string;
  readonly sentence: string;
}

/** The shape one sentence has, or `undefined`: a sentence opening with a quote mark or `>` is another's text. */
function shapeOf(sentence: string): string | undefined {
  if (TELLS_TO_ACCEPT.test(sentence)) return undefined;
  return DICTATED_RULE_SHAPES.find((shape) => shape.pattern.test(sentence))?.name;
}

/** The shape of a rule dictated that `text` has, or `undefined`: the first sentence and shape that match. */
export function dictatedRuleIn(text: string): DictatedRule | undefined {
  if (SETS_INSTRUCTIONS_ASIDE.test(text)) return undefined;
  for (const sentence of sentencesOf(text)) {
    const shape = shapeOf(sentence);
    if (shape !== undefined) return { shape, sentence: sentence.slice(0, AT_MOST_QUOTED) };
  }
  return undefined;
}

/**
 * `text` with the sentences that have the shape of a rule dictated taken out, the rest as it was: what
 * is left for a reader that looks for something else in the same message (a correction that comes
 * before the rule). Fenced blocks are kept whole, and what is past the limit is not read.
 */
export function withoutDictatedRules(text: string): string {
  if (SETS_INSTRUCTIONS_ASIDE.test(text)) return text;
  const head = text.slice(0, READ_UP_TO);
  const kept = head
    .split(/(```[\s\S]*?(?:```|$))/)
    .map((piece) =>
      piece.startsWith('```')
        ? piece
        : piece
            .split(/(?<=[.!?])\s+|\n+/)
            .filter((sentence) => shapeOf(sentence.replace(/\s+/g, ' ').trim()) === undefined)
            .join(' '),
    )
    .join(' ');
  return `${kept} ${text.slice(READ_UP_TO)}`.trim();
}
