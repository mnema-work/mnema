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
 *
 * A RULE IS PERMANENT AND UNCONDITIONAL. A sentence with a limit in time or place ("today", "here",
 * "this time", "hoje", "aqui", "desta vez"), one that is a step of this task ("check the logs first,
 * then tell me") and one that opens with a condition ("if it works, make it a rule") is an
 * instruction for now, not a rule. Accents are folded before the test, so "nao", "faca", "poe" and
 * "isso e regra" are read as the accented words are, and a list mark in front of a sentence is not part
 * of it.
 */

/** How much of a message is read: a rule is said near the start, and a long paste is about something else. */
export const READ_UP_TO = 2000;

/** The most of a matched sentence that is ever quoted (a transcript reader's proposal). */
const AT_MOST_QUOTED = 280;

/**
 * The imperative verbs a rule opens its instruction with: the ones people give a coding agent. A
 * word after the trigger that is not on the list (a noun, an article, a verb in the indicative) makes
 * the sentence a statement. Kept short on purpose: a verb missing from it is a rule the person says
 * once more, and a verb too many is a statement that lights the hook. `remember to` and `forget to`
 * are there because "never forget to run the linter" is an instruction.
 */
const IMPERATIVES_EN = [
  ...`add ask avoid call check cite commit confirm create delete do document don't ensure export follow format import keep link log make name open prefer push put read record remove rename review run say show start stop tell test update use validate verify wait write`.split(
    ' ',
  ),
  'remember to',
  'forget to',
];

/** The same, in Portuguese: the imperative of `você`, and `não` which opens a negative one. */
const IMPERATIVES_PT = [
  ...`abra adicione anote apague avise chame cite coloque comente confira confirme crie deixe documente escreva evite exporte faça feche formate importe inclua junte leia mantenha mostre nomeie não pare pergunte peça ponha prefira registre remova renomeie revise rode siga teste use valide verifique`.split(
    ' ',
  ),
  'lembre de',
  'lembre-se de',
  'esqueça de',
];

/** The text with its accents taken off and in lower case: what every pattern below is written for. */
function fold(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

const VERB_EN = `(?:${IMPERATIVES_EN.map(fold).join('|')})`;
const VERB_PT = `(?:${IMPERATIVES_PT.map(fold).join('|')})`;
/** What can stand between a trigger and its verb: a comma, a polite word, an adverb, a reinforcement. */
const BETWEEN_EN = ',?\\s+(?:please,?\\s+)?(?:(?:always|never)\\s+)?(?:ever\\s+)?(?:please,?\\s+)?';
const BETWEEN_PT =
  ',?\\s+(?:por\\s+favor,?\\s+)?(?:(?:sempre|nunca)\\s+)?(?:(?:mais|jamais)\\s+)?(?:por\\s+favor,?\\s+)?';
const THEN_EN = `${BETWEEN_EN}${VERB_EN}\\b`;
const THEN_PT = `${BETWEEN_PT}${VERB_PT}\\b`;

/** One shape of a rule dictated: the label the product names it by, and the pattern tried on a sentence. */
export interface DictatedRuleShape {
  /** The product's own label for the shape, written the way the person says it. */
  readonly name: string;
  /** Where in the sentence the pattern is tried. */
  readonly at: 'start' | 'anywhere';
  /** Written for a sentence folded by {@link fold}: no accent, lower case. */
  readonly pattern: RegExp;
}

/**
 * Every form this reader knows, in English and Portuguese, the two the person who wrote it types in.
 * A table and not a list in a function, so a reader of the record can name the shape a proposal came
 * from, and so a shape added is a line somebody has to write a probe for
 * (`a-dictated-rule-is-said.test.ts` holds a positive in each language and a negative for each).
 */
export const DICTATED_RULE_SHAPES: readonly DictatedRuleShape[] = [
  { name: 'always …', at: 'start', pattern: new RegExp(`^always${THEN_EN}`, 'i') },
  { name: 'never …', at: 'start', pattern: new RegExp(`^never${THEN_EN}`, 'i') },
  { name: 'from now on …', at: 'start', pattern: new RegExp(`^from\\s+now\\s+on${THEN_EN}`, 'i') },
  { name: 'going forward …', at: 'start', pattern: new RegExp(`^going\\s+forward${THEN_EN}`, 'i') },
  { name: 'sempre …', at: 'start', pattern: new RegExp(`^sempre${THEN_PT}`, 'i') },
  { name: 'nunca …', at: 'start', pattern: new RegExp(`^nunca${THEN_PT}`, 'i') },
  {
    name: 'a partir de agora …',
    at: 'start',
    pattern: new RegExp(`^a\\s+partir\\s+de\\s+agora${THEN_PT}`, 'i'),
  },
  {
    name: 'daqui pra frente …',
    at: 'start',
    pattern: new RegExp(`^daqui\\s+(?:pra|para)\\s+frente${THEN_PT}`, 'i'),
  },
  {
    name: 'de agora em diante …',
    at: 'start',
    pattern: new RegExp(`^de\\s+agora\\s+em\\s+diante${THEN_PT}`, 'i'),
  },
  {
    name: 'put it as a rule',
    at: 'anywhere',
    pattern:
      /(?:^|,\s*)(?:please\s+)?(?:put|make|keep|record)\s+(?:it|this|that)\s+(?:as\s+)?a\s+rule\b/i,
  },
  { name: 'as a rule: …', at: 'start', pattern: /^as\s+a\s+rule:/i },
  {
    name: 'coloca como regra',
    at: 'anywhere',
    pattern:
      /(?:^|,\s*)(?:por\s+favor,?\s+)?(?:coloca|coloque|poe|ponha|registra|registre|grava|grave|anota|anote)\s+(?:isso\s+|isto\s+)?como\s+regra\b/i,
  },
  {
    name: 'isso é regra',
    at: 'anywhere',
    pattern:
      /(?:^|,\s*)(?:isso|isto)\s+e\s+(?:uma\s+)?regra(?:\s+(?:do\s+projeto|aqui|daqui\s+pra\s+frente))?[.!]*$/i,
  },
  {
    name: 'vira regra',
    at: 'anywhere',
    pattern:
      /(?:^|,\s*)(?:(?:isso|isto|essa|esta)\s+)?(?:vira|(?:deveria|deve|tem\s+que|precisa)\s+virar)\s+regra[.!]*$/i,
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

/** A sentence that opens with a condition ("if it works, make it a rule") is not a rule yet. */
const CONDITIONAL = /^(?:if|se|caso|quando|when|whenever|assim\s+que|once)\b/;

/**
 * A limit in time or place, or a step of the task at hand: an instruction for now, not a rule. Written
 * for a folded sentence.
 */
const NOT_PERMANENT = new RegExp(
  [
    '\\b(?:today|tonight|tomorrow|here|hoje|amanha|aqui|por\\s+enquanto|por\\s+agora|neste\\s+momento)\\b',
    '\\bthis\\s+(?:time|once|session|week)\\b',
    '\\b(?:for|right)\\s+now\\b',
    '\\bjust\\s+(?:this|for)\\b',
    '\\b(?:desta|dessa)\\s+vez\\b',
    '\\b(?:so\\s+hoje|agora\\s+so)\\b',
    '\\b(?:nesta)\\s+(?:sessao|semana)\\b',
    '\\bthen\\s+(?:tell|let|report|show|reply|answer)\\s+me\\b',
    '\\bdepois\\s+(?:me\\s+)?(?:diga|avise|conte|mostre|responda)\\b',
    '\\bfirst\\b.*\\bthen\\b',
    '\\bprimeiro\\b.*\\bdepois\\b',
  ].join('|'),
  'i',
);

/** What can stand in front of a sentence without being part of it: a list mark, a numeral, a polite word. */
const BEFORE_A_SENTENCE = /^(?:(?:[-*\u2022]|\d+[.)])\s+)?(?:(?:please|por\s+favor),?\s+)?/;

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

/**
 * The shape one sentence has and where in it the match ends, or `undefined`. A sentence opening with a
 * quote mark or `>` is another's text: only a space, a list mark or a polite word may stand before it.
 * `end` counts in the sentence as given, which folding does not move unless the accents were typed apart.
 */
function ruleIn(sentence: string): { readonly shape: string; readonly end: number } | undefined {
  const folded = fold(sentence);
  const lead = BEFORE_A_SENTENCE.exec(folded)?.[0].length ?? 0;
  const body = folded.slice(lead);
  if (TELLS_TO_ACCEPT.test(body) || CONDITIONAL.test(body) || NOT_PERMANENT.test(body)) {
    return undefined;
  }
  for (const shape of DICTATED_RULE_SHAPES) {
    const at = shape.pattern.exec(body);
    if (at !== null) {
      return {
        shape: shape.name,
        end: folded.length === sentence.length ? lead + at.index + at[0].length : -1,
      };
    }
  }
  return undefined;
}

/** The shape of a rule dictated that `text` has, or `undefined`: the first sentence and shape that match. */
export function dictatedRuleIn(text: string): DictatedRule | undefined {
  if (SETS_INSTRUCTIONS_ASIDE.test(text)) return undefined;
  for (const sentence of sentencesOf(text)) {
    const found = ruleIn(sentence);
    if (found !== undefined)
      return { shape: found.shape, sentence: sentence.slice(0, AT_MOST_QUOTED) };
  }
  return undefined;
}

/** What separates the clause a rule ends in from the next one: a semicolon, a comma, a dash or a hyphen between spaces. */
const NEXT_CLAUSE = /;\s*|,\s+|\s[-\u2013\u2014]\s/;

/** A conjunction that only joins the clause that is left to the one that was a rule. */
const JOINING = /^(?:and(?:\s+then)?|but|also|e|mas|e\s+tambem)\s+/i;

/**
 * `text` with the rule taken out of each sentence that has the shape of one, the rest as it was: what
 * is left for a reader that looks for something else in the same message. The rule is the clause the
 * trigger opens, up to the next semicolon, comma or dash; what follows it stays ("Always use tabs; no,
 * that's wrong" keeps "no, that's wrong"), and a sentence that is only the rule goes whole. Fenced
 * blocks are kept whole, and what is past the limit is not read.
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
            .map((raw) => {
              const sentence = raw.replace(/\s+/g, ' ').trim();
              if (/\?["')”’]*$/.test(sentence)) return sentence;
              const found = ruleIn(sentence);
              if (found === undefined) return sentence;
              if (found.end < 0) return '';
              const next = NEXT_CLAUSE.exec(sentence.slice(found.end));
              if (next === null) return '';
              return sentence
                .slice(found.end + next.index + next[0].length)
                .trim()
                .replace(JOINING, '');
            })
            .filter((sentence) => sentence !== '')
            .join(' '),
    )
    .join(' ');
  return `${kept} ${text.slice(READ_UP_TO)}`.trim();
}
