/**
 * The STYLED renderer: the same line, with each part's weight and its news said in
 * escapes.
 *
 * It composes through {@link renderWith}, so the depth, the separators and the order
 * are the plain renderer's: literally the same loop. All this file decides is what
 * wraps a part's own text, which is what makes the promise below true by construction
 * rather than by two files agreeing:
 *
 *   STRIP THE ESCAPES AND YOU HAVE THE PLAIN LINE, exactly. Not "almost", and not
 *   "the same information": the same bytes. mnema is a tool for auditing a record, so
 *   a reader has to be able to trust that what they are looking at says the same thing
 *   as what a CI log, a redirected file or a colleague's terminal says. Style that
 *   could add, drop or reorder a character would make the terminal a fourth account
 *   of the record. `styled.test.ts` asserts it over every shape the surface builds.
 *
 * IT PAINTS NOW, AND THE DOC HERE USED TO SAY IT COULD NOT. The premise was "WEIGHT
 * ONLY, NO COLOUR, and that is a technical limit rather than restraint": colour is
 * how a terminal says GOOD and BAD, a part did not know whether it was either, and
 * painting a verdict green would have needed a severity nothing produced. What
 * falsified it is that something produces one, {@link statement} takes an optional
 * severity and the refusal funnel sets it (`wiring/report.ts`), and the map below is
 * the consumer that had to exist first. The limit was real and it was named
 * correctly; it was a limit about the CALL SITES, and they moved.
 *
 * COLOUR IS NEVER THE CARRIER, and that is the rule the two axes are built around. A
 * refusal says the word `Refused`, a verdict says `ALLOWED` or `REFUSED`, and the hue
 * repeats it for an eye scanning a screen. A reader on a monochrome terminal, in a
 * pipe, with `--color=never`, or with the eight percent of colour vision that does not
 * separate red from green loses NOTHING, because there was nothing only the hue said.
 * `styled.test.ts` asserts that half too: what the plain line says is what the painted
 * one says.
 *
 * THE BASIC EIGHT, never RGB and never a 256-colour index. A terminal's red is the red
 * of the theme its reader chose; a fixed `38;2;220;50;47` is a red that can land
 * unreadable on a light background, and nobody would be able to fix it from their side.
 * It is what git and gh do, and it is the same argument as using SGR at all. (ONE EXCEPTION,
 * and it says why where it is: the band behind a command that has been sent, {@link SHADE}.)
 *
 * The escapes are SGR: `1` is bold, `2` is faint, and `22` returns to normal
 * intensity, one closer for both, because it is the ANSI code for "neither bold nor
 * faint" and nothing here nests. `31`, `32` and `33` are red, green and yellow, all
 * closed by `39`, the default foreground. Deliberately not `0`, which would also reset a
 * colour a caller's terminal set for its own reasons.
 */

import type { Part, Role, Severity } from './line.js';
import { renderWith } from './plain.js';
import type { Render } from './render.js';
import { widthOfText } from './width.js';

/** Bold: SGR 1. */
const BOLD = '\u001b[1m';
/** Faint: SGR 2, what a terminal shows as dim. */
const DIM = '\u001b[2m';
/** Back to normal intensity: SGR 22, the closer for both of the above. */
const NORMAL = '\u001b[22m';

/** Red: SGR 31, the basic one, so a reader's theme decides which red. */
const RED = '\u001b[31m';
/** Green: SGR 32, the basic one, for the same reason. */
const GREEN = '\u001b[32m';
/** Yellow: SGR 33, the basic one; the third, for news that is neither. */
const YELLOW = '\u001b[33m';
/** Back to the terminal's own foreground: SGR 39, the closer for every hue. */
const DEFAULT_HUE = '\u001b[39m';

/**
 * THE BAND A SENT COMMAND SITS ON, and the two foregrounds drawn over it: the 256-colour greys 238
 * (the band, `48;5;238`), 246 (the mark) and 253 (the words), closed by SGR 49 and by
 * {@link DEFAULT_HUE}.
 *
 * IT IS THE ONE PLACE THIS FILE LEAVES THE BASIC EIGHT, and the rule it leaves is about a colour
 * landing unreadable on a theme its reader cannot change: *a fixed red can land unreadable on a
 * light background*. A band is a background and a background is half of a pair, so the pair is
 * fixed at BOTH ends, a mid-dark grey with light text on it, and what a theme can change is only
 * the page around it. Measured by drawing the same recording on a dark and on a light theme: on
 * the dark one it is a quiet band, on the light one a darker band with its words still on top of
 * it, legible on both. The basic eight cannot say a quiet grey at all (the theme's own bright
 * black is a loud mid-grey on the dark theme and a theme-dependent one elsewhere), and a band
 * with no foreground of its own would be the terminal's default text over a colour nobody checked
 * it against. A terminal that cannot take the indexes ignores all three and shows the words.
 */
const SHADE = '\u001b[48;5;238m';
const MARK_HUE = '\u001b[38;5;246m';
const SENT_HUE = '\u001b[38;5;253m';
const UNSHADE = '\u001b[49m';

/**
 * NO ACCENT: this surface carries no hue of the product's own. It used to: SGR 35, magenta, the
 * one hue that was not news, spent on the echo's prompt, the mark on a picked row and a word of
 * the console's list of words, on the premise that *magenta says this is mnema*. That premise
 * held while the mark had a colour in the terminal; the mark no longer does. The terminal carries
 * the mark as WEIGHT only (the prompt and the picked mark are bold), and the three severities are
 * the only hues left here (`tests/the-renderer-writes-no-accent.test.ts`).
 *
 * THE CONSEQUENCE AT THE DOOR: an actor's field that holds its own `ESC[35m` is no longer a
 * sequence this product writes, so the port that lets the product's own sequences through
 * ({@link PAINTING}) escapes it like any other control byte.
 */

/**
 * What opens each role, and the empty string for a role written bare.
 *
 * Total over {@link Role} by type, the same rule the separator table keeps, for the
 * same reason: a role that did not say how it is painted would be painted by whatever
 * a fallback chose, and a surface would acquire an emphasis nobody decided on. A role
 * added to the union without an entry here does not build.
 *
 * The ten, and the convention each follows:
 *
 *   - `label`: bold. It leads the line and it is what a reader scanning a log for a
 *     refusal reads first, which is the one thing git, gh and kubectl all embolden.
 *   - `subject`: bold. A heading, and headings are the other half of that same
 *     convention.
 *   - `field`: bare. A column of a list is the DATA; emphasising all of it emphasises
 *     nothing, and this is most of what the surface prints.
 *   - `detail`: dim. Secondary by construction: it is the half of a statement that
 *     follows the colon, and dimming what is secondary is the convention a reader
 *     already knows from `git status` and `gh pr list`.
 *   - `clause`: dim, the same as the detail it is a refinement of, and the sameness is
 *     load-bearing rather than a coincidence to collapse. `verify`'s verdict used to
 *     arrive as ONE detail holding every clause, so the whole sentence was dim; splitting
 *     it into the clauses the chain hands over must not change the weight of a single
 *     word of it, or the split would have been a restyling wearing a decomposition's
 *     clothes. What the split buys is that ONE clause can now carry a hue.
 *   - `state`: bare, exactly like the `field` it rides. A position's WEIGHT is the
 *     title's: emboldening or dimming every state would say something about all of them,
 *     and what distinguishes them is not how much they matter but what a reader does
 *     next. That travels on the other axis; three of the five dispositions carry a
 *     severity and two carry none (see `state.ts`), so a state with nothing to report
 *     comes out byte for byte the plain line, which is most of them.
 *   - `id`, `when` and `scope`: dim, and they are the reason this map was worth
 *     extending. A list of hits is columns of `field` that all weigh the same, so nothing
 *     in it stood out; dimming the columns nobody READS makes the title beside them the
 *     line's subject, WITHOUT painting the title. It is emphasis by subtraction, which is
 *     the only kind that scales to six lists. IT WAS TWO, AND THIS FILE POINTED AT
 *     `line.ts` FOR *why no third column joined them*: the scope is that third, it
 *     joined for this entry's own argument rather than for one of its own, and `line.ts`
 *     is where the premise it falsified is written out.
 *   - `prompt`: bold. What a caller typed in front of is the product's mark on the page
 *     rather than a fact about the record; the mark has no colour in the terminal, so weight
 *     is all it carries, and it is the weight of the `typed` words that follow it.
 *   - `pick`: bold. The mark on the row a caller chose is the console's own punctuation
 *     rather than a fact; it carries weight and no hue, for the same reason as the prompt.
 *   - `typed`: bold, exactly like the `label` it is a refinement of, and the sameness is
 *     the point rather than a duplication to collapse. A caller scrolling a session is
 *     looking for the line they asked, in among the answer to it, and that is the same
 *     thing a reader scanning a log for a refusal is doing.
 *   - `sentmark` and `sent`: a command the caller has sent, as the roll keeps it: a quiet grey
 *     mark and the words in a lighter grey, on the band {@link shadedAcross} lays under the whole
 *     row. They carry no hue and no weight, because what a
 *     caller asked is not the product's mark; they are painted as a PAIR with the band ({@link SHADE}).
 *   - `word`: bare. A word a caller could type is the product's own vocabulary offered back;
 *     it takes neither a hue (the mark has none) nor a weight (a list where four rows are
 *     emboldened is four rows shouting). The row is dimmed whole by the layout.
 */
/**
 * Every sequence this renderer can write, for the port that must let them through while it
 * escapes every other control byte (`wiring/io.ts`). Built from the constants above, so a
 * colour added to a table here is a colour the port already knows.
 */
export const PAINTING: readonly string[] = [
  BOLD,
  DIM,
  NORMAL,
  RED,
  GREEN,
  YELLOW,
  DEFAULT_HUE,
  SHADE,
  UNSHADE,
  MARK_HUE,
  SENT_HUE,
];

const OPENED_BY: { readonly [R in Role]: string } = {
  label: BOLD,
  subject: BOLD,
  field: '',
  detail: DIM,
  clause: DIM,
  id: DIM,
  when: DIM,
  scope: DIM,
  state: '',
  prompt: BOLD,
  typed: BOLD,
  sentmark: '',
  sent: '',
  pick: BOLD,
  word: '',
};

/**
 * What each role TINTS, and the empty string for every role that carries no hue of its
 * own, which is all of them but the two halves of a sent command's band.
 *
 * Total over {@link Role} by type, exactly like the two tables it sits between, and for
 * the third time the same reason: a role whose hue nobody stated would be painted by
 * whatever a fallback chose.
 *
 * THE ACCENT IS GONE FROM IT. This table used to say *one accent on three roles* (the echo's
 * prompt, the mark on a picked row, a word of the list), on the premise that those three were
 * the parts of the surface that are the product rather than the record and that each said
 * *this is mnema* in magenta. What falsified it is the new brand: the mark carries no colour
 * in the terminal, only weight, so the three roles moved to {@link OPENED_BY} (two of them
 * bold, the word bare) and what is left here is the pair of greys over the band.
 * `tests/the-renderer-writes-no-accent.test.ts` asserts, over every role, that no role writes
 * SGR 35.
 */
const TINTED_BY: { readonly [R in Role]: string } = {
  label: '',
  subject: '',
  field: '',
  detail: '',
  clause: '',
  id: '',
  when: '',
  scope: '',
  state: '',
  prompt: '',
  typed: '',
  sentmark: MARK_HUE,
  sent: SENT_HUE,
  pick: '',
  word: '',
};

/**
 * What each severity paints: the whole use of hue on this surface again, now that the
 * accent that was a second one is gone ({@link TINTED_BY} says what falsified it).
 *
 * Total over {@link Severity} by type, for the third time and the same reason: a
 * severity a call site could set and this map had no entry for would be news reported
 * in whatever a fallback chose.
 *
 * THREE ENTRIES, and the triple is deliberately the most conventional one in a terminal:
 * red is the answer a caller has to act on, green is the one they do not, and yellow is
 * the one where neither is true. It was two, and `line.ts` says what falsified the
 * premise that there was no third to say: a proven level that is neither a break nor a
 * signature. Nothing here decides WHICH a given line is: the call site says (see
 * `verdict.ts`, `wiring/verify.ts` and `state.ts`), and that is what keeps the renderer
 * from being the thing that judges the record.
 *
 * AND THE TRIPLE MEANS ONE THING PER HUE, whichever call site sets it. That is the whole
 * reason a record's position reuses this scale instead of getting one of its own: a
 * `stalled` task is red because it is an answer a caller has to act on, exactly as a
 * refusal is; a `settled` one is green for the same reason `ALLOWED` is, and so is a
 * decision in force. A second vocabulary would have given this surface two reds meaning
 * different things, which is how a hue stops being readable at all, and it is why the
 * three machines' positions come through ONE table on the way here (`state.ts`), not one
 * per machine.
 */
const PAINTED_BY: { readonly [S in Severity]: string } = {
  good: GREEN,
  warn: YELLOW,
  bad: RED,
};

/**
 * One part as the bytes it occupies: its text, wrapped in its role's weight and then
 * in its hue, the severity's where it has one, and the role's own where it does not.
 *
 * THE NEWS WINS, and the order is the decision rather than an accident of the `??`. A
 * part that carries a severity is reporting something a reader has to act on, and a part
 * that carries a role's own hue (the grey of a sent command) says nothing about the record;
 * if one part could ever be both, the news is the half that may not be overwritten. Nothing
 * produces such a part today, so this line states an order rather than resolving a collision.
 *
 * A part that opens NOTHING is returned untouched, not wrapped in an empty pair, so
 * the styled line of a list of plain columns is byte for byte the plain one, and the
 * common case costs nothing at all.
 *
 * Each wrap is closed by its own closer and only its own: `22` says "neither bold nor
 * faint" and `39` says "the terminal's own foreground", so a bold-and-red label closes
 * both and a dim id closes one. Closing what was never opened would reset a colour the
 * caller's terminal set for its own reasons, which is the same argument that keeps `0`
 * out of this file.
 *
 * The text goes through verbatim, escapes and all. A stored field that holds an
 * escape byte of its own is text an actor wrote, and this renderer neither strips it
 * nor honours it; that is the content door's business and not a renderer's (see
 * `one-line.ts`).
 */
function painted(part: Part): string {
  const weight = OPENED_BY[part.role];
  const hue = part.severity === undefined ? TINTED_BY[part.role] : PAINTED_BY[part.severity];
  if (weight === '' && hue === '') return part.text;
  const closer = `${hue === '' ? '' : DEFAULT_HUE}${weight === '' ? '' : NORMAL}`;
  return `${weight}${hue}${part.text}${closer}`;
}

/**
 * The renderer for a terminal that can show weight and colour: chosen at the entry,
 * never here (see `wiring/color.ts` for what chooses it, and `render.ts` for why
 * nothing in `presentation/` may ask).
 */
export const renderStyled: Render = renderWith(painted);

/**
 * THE BAND, laid across the width of the page: every row of a sent command, shaded from its
 * first column to the last, whatever the words took of it.
 *
 * IT IS A WRAPPER AND NOT A PART because what fills a row is the width, and a part carries no
 * width (`line.ts`). It is applied AFTER the fold, row by row, so a command long enough to
 * break is a band as tall as it is and not a band on its first row alone, and it is applied
 * only to a line that begins with the mark, which is the one discriminant there is for a sent
 * command. What it adds is spaces and the two escapes that open and close the shade; the plain
 * rendering of the same line is untouched, which is what leaves a reader without colour only
 * the mark (`wiring/color.ts` chooses which renderer is wrapped, and never wraps the plain one).
 *
 * A row is padded to `columns` and never past it: a row already that wide is shaded as it is.
 */
export function shadedAcross(columns: number, render: Render): Render {
  return (line) => {
    const bytes = render(line);
    if (line.parts[0]?.role !== 'sentmark') return bytes;
    return bytes
      .split('\n')
      .map(
        (row) => `${SHADE}${row}${' '.repeat(Math.max(0, columns - widthOfText(row)))}${UNSHADE}`,
      )
      .join('\n');
  };
}
