/**
 * Reading a DIRECTORY of decision documents: the walk, the triage, and the two
 * refusals that are about this product rather than about the document's shape.
 *
 * IT IS NOT RECURSIVE, and that is a decision rather than a shortcut. An ADR base
 * is a flat directory by every convention that publishes one (`docs/adr/`,
 * `doc/adr/`, `docs/decisions/`), and a recursive walk pointed at a repository
 * root would read every markdown file in it (a README, a changelog, an issue
 * template) and propose whatever happened to have a heading and a paragraph. The
 * caller names the directory holding the decisions; nothing here guesses which one
 * that is.
 *
 * THE ORDER IS THE FILE NAME, so two runs over the same directory report the same
 * list in the same order. ADR file names carry their own sequence number, so this
 * is also the order their authors intended.
 *
 * TWO THINGS ARE THIS PRODUCT'S AND NOT THE DOCUMENT'S: one refusal and one cut, applied here
 * rather than in the reader because they are about what may enter the record:
 *
 *   - `HOLDS_A_SECRET`: a field carries something shaped like a credential. Text
 *     from somebody else's file is exactly the untrusted input the content door
 *     exists for, and the door SCRUBS and reports. That is right for a person
 *     typing one fact and wrong for a bulk read of forty files: a placeholder
 *     recorded on a person's behalf, in a document they did not write, is a
 *     permanent entry nobody chose. So this refuses the FILE, by name, with the
 *     class named, and the door still runs on everything that does get written,
 *     because the screen lives inside the write and this triage cannot skip it.
 *     Detection here is the SAME function the door uses (`detectSecrets`), so
 *     there is one idea of what a credential looks like and not two.
 *
 *   - `TITLE_TOO_LARGE`: the title is over {@link FIELD_BYTE_LIMIT}. A title is a name, and a
 *     name cut short would name another decision, so the file is refused.
 *
 * AND ONE CUT, which replaces what used to be a refusal (`FIELD_TOO_LARGE`, for any field). The
 * why and the turned-down text over {@link FIELD_BYTE_LIMIT} are CUT to fit, and the text that
 * is kept ends in a note that says so and carries the SHA-256 of the whole text. This refused
 * the whole document on the premise that a field over the limit was a document that could not
 * be recorded; a real 70,287-byte decision section falsified it, and one oversized section
 * made a whole ADR vanish from the plan. The document stays in the repository and the proposal's
 * `derived-from` edge names it, so the hash lets a reader prove later that the file still says
 * what was read. The credential screen runs over the WHOLE text, before the cut, so a secret
 * past the cut point still refuses the file.
 *
 * And one skip that is a POLICY and says so: `RETIRED`, a document whose own status
 * says it is no longer in force. See {@link adrIsInForce}.
 */

import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FIELD_BYTE_LIMIT } from '../content/screen.js';
import type { SecretClass } from '../content/secrets.js';
import { detectSecrets } from '../content/secrets.js';
import { type AdrDocument, type AdrRefusalCode, adrIsInForce, readAdr } from './read.js';

/** Why a file in the directory produced no proposal. */
export type ScanRefusalCode =
  | AdrRefusalCode
  /** The document's own status says this decision is no longer in force. */
  | 'RETIRED'
  /** A field carries something shaped like a credential; nothing is proposed from it. */
  | 'HOLDS_A_SECRET'
  /** The title is over the limit a recorded field may weigh: a name is not cut. */
  | 'TITLE_TOO_LARGE'
  /** The file could not be read from disk (permission, a broken link, a race). */
  | 'UNREADABLE'
  /** A bridge's file does not have the shape its source documents: nothing is proposed from it. */
  | 'MALFORMED'
  /** A bridge's entry is not a decision (a note, a lesson, a runbook): nothing is proposed from it. */
  | 'NOT_A_DECISION';

/** One document that WOULD become a decision, and the file it came from. */
export interface ScannedDecision extends AdrDocument {
  /** The file's path as the caller will record it: the provenance of the proposal. */
  readonly path: string;
  /** The line it was read from, for a source that holds many entries per file. */
  readonly line?: number;
  /**
   * A short hash of the content read (the file, or the one entry of a file that holds many)
   * for a source cited by its name alone, where two directories can hold the same name.
   */
  readonly digest?: string;
  /**
   * What the triage CUT to fit {@link FIELD_BYTE_LIMIT}, per field: the bytes kept (the note not
   * counted) and the bytes the text had. Absent when nothing was cut.
   */
  readonly cut?: {
    readonly rationale?: CutField;
    readonly alternatives?: CutField;
  };
}

/** One field cut to fit: the bytes of text kept, and the bytes the whole text had. */
export interface CutField {
  readonly kept: number;
  readonly of: number;
}

/** One file that produced no proposal, and why. */
export interface ScanRefusal {
  /** The file's path, so the refusal names something the caller can open. */
  readonly path: string;
  readonly code: ScanRefusalCode;
  /** The line of the file the refusal is about, for a source that holds many entries per file. */
  readonly line?: number;
  /**
   * The credential classes found, on `HOLDS_A_SECRET` and nothing else. The CLASS
   * travels and the value never does: the same posture the record's own exposure
   * reading takes.
   */
  readonly classes?: readonly SecretClass[];
}

/** What a directory of decision documents holds. */
export interface AdrScan {
  /** The documents read as decisions, in file-name order. */
  readonly read: readonly ScannedDecision[];
  /** The files that produced nothing, each with its reason, in file-name order. */
  readonly refused: readonly ScanRefusal[];
}

/** The extensions a decision document may have. */
const MARKDOWN = /\.(?:md|markdown)$/i;

/**
 * File names that are a decision base's own furniture rather than a decision:
 * the index page and the template every ADR tool drops beside the records.
 *
 * They are excluded by NAME and not by shape, because both usually parse: a
 * template has a title and a `## Context` full of instructions, and reading one
 * would propose "Short title of solved problem and solution" as a decision of the
 * project. Comparing on the stem (case-folded, without extension) covers
 * `README.md`, `readme.markdown` and `TEMPLATE.md` alike.
 *
 * AND THE FILES AN AGENT HOST READS AS STANDING INSTRUCTIONS (`AGENTS.md`, `CLAUDE.md`,
 * `GEMINI.md`), which sit at a repository's root, the one base a project may also keep its
 * decisions in: `mnema init` creates an `AGENTS.md` there, and its heading would otherwise make
 * it a document of that base that the record never read, for as long as the file is there.
 *
 * AND THE FILES A PROJECT KEEPS AT ITS ROOT BESIDE THEM (`CHANGELOG.md`, `CONTRIBUTING.md`,
 * `SECURITY.md`, `CODE_OF_CONDUCT.md`): with no paragraph under the title, they used to be
 * refused as stating no why, and now that a document's sections are read as its why they would be
 * proposed as decisions.
 */
const NOT_A_DECISION: readonly string[] = [
  'readme',
  'index',
  'template',
  'formato',
  'format',
  '_index',
  'agents',
  'claude',
  'gemini',
  'changelog',
  'contributing',
  'security',
  'code_of_conduct',
  'code-of-conduct',
];

/** The path, POSIX-style, of a file inside the scanned directory. */
function relative(directory: string, file: string): string {
  let end = directory.length;
  while (end > 0 && directory[end - 1] === '/') end -= 1;
  return `${directory.slice(0, end)}/${file}`;
}

/** The bytes a field would weigh in the record: UTF-8, the form the chain stores. */
function weight(text: string): number {
  return Buffer.byteLength(text, 'utf8');
}

/** Every free-text field the proposal would carry, for one pass of triage. */
function fieldsOf(document: AdrDocument): readonly string[] {
  return [
    document.title,
    document.rationale,
    ...(document.alternatives !== undefined ? [document.alternatives] : []),
  ];
}

/** The note that closes a cut field: product text, one line, carrying the proof of the whole. */
function noteOf(whole: string): string {
  const hash = createHash('sha256').update(whole, 'utf8').digest('hex');
  const bytes = weight(whole).toLocaleString('en-US');
  const limit = FIELD_BYTE_LIMIT.toLocaleString('en-US');
  return (
    `[Cut on import: this text runs to ${bytes} bytes and a recorded field holds at most ${limit}. ` +
    `The whole text is in the document this decision was imported from; its SHA-256 is ${hash}.]`
  );
}

/**
 * The marker of the fenced code block `text` ends inside, or undefined when it ends outside one.
 * CommonMark's rule: a fence opens on a line with up to three spaces of indent and three or more
 * backticks or tildes (a backtick fence's info string holds no backtick), and closes only on a
 * line of the SAME character, at least as long as the opening, with nothing after it. A line
 * indented four or more spaces is indented code, not a fence. A fence inside a block quote
 * (`> ```) is NOT recognised: that is this reader's declared limit, and the cut there may fall
 * inside such a block.
 */
function openFence(text: string): string | undefined {
  let open: string | undefined;
  for (const line of text.split('\n')) {
    const found = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
    if (found === null) continue;
    const marker = found[1] as string;
    const rest = found[2] as string;
    if (open === undefined) {
      if (marker[0] === '`' && rest.includes('`')) continue;
      open = marker;
    } else if (marker[0] === open[0] && marker.length >= open.length && rest.trim() === '') {
      open = undefined;
    }
  }
  return open;
}

/**
 * A text cut so that `prefix` (kept as it is, and not part of the hash) plus what is kept plus
 * the closing note weigh at most {@link FIELD_BYTE_LIMIT} bytes of UTF-8, or the text itself
 * when it already fits. The cut falls at the last blank line that fits and is outside an open
 * fenced code block, else the last such line break, else the last whole code point, and a block
 * still open at the cut is closed before the note with the marker it opened with, counted in the
 * budget. Fences follow CommonMark ({@link openFence}). Never inside a
 * multi-byte sequence. Held by `scan.test.ts` ("cuts at a whole character when two and four byte
 * characters cross the limit", "does not cut inside an open code block").
 *
 * The note's byte count and hash are of `text` alone: for a bridge, `prefix` is the origin line
 * the import wrote, which is not the source's text.
 */
export function cutToFit(
  text: string,
  prefix = '',
): { readonly value: string; readonly cut?: CutField } {
  const of = weight(text);
  if (weight(prefix) + of <= FIELD_BYTE_LIMIT) return { value: `${prefix}${text}` };
  const note = noteOf(text);
  // The room a closing fence may need: a line break and the longest marker the text opens with.
  const longest = Math.max(
    3,
    ...[...text.matchAll(/^ {0,3}(`{3,}|~{3,})/gm)].map((found) => (found[1] as string).length),
  );
  const budget = FIELD_BYTE_LIMIT - weight(prefix) - weight(note) - 2 - (1 + longest);
  const bytes = Buffer.from(text, 'utf8');
  let end = budget;
  // A continuation byte (10xxxxxx) is the middle of a character: step back to its first byte.
  while (end > 0 && ((bytes[end] as number) & 0xc0) === 0x80) end -= 1;
  const fits = bytes.subarray(0, end).toString('utf8');
  const outside = (index: number): boolean => openFence(fits.slice(0, index)) === undefined;
  let blank = -1;
  for (const match of fits.matchAll(/\n[ \t]*\n/g)) if (outside(match.index)) blank = match.index;
  let lineBreak = -1;
  for (const match of fits.matchAll(/\n/g)) if (outside(match.index)) lineBreak = match.index;
  const at = blank > 0 ? blank : lineBreak > 0 ? lineBreak : fits.length;
  let kept = fits.slice(0, at).trimEnd();
  const marker = openFence(kept);
  if (marker !== undefined) kept = `${kept}\n${marker}`;
  return { value: `${prefix}${kept}\n\n${note}`, cut: { kept: weight(kept), of } };
}

/**
 * What this product does to a document already read, whatever file shape it came out of, in
 * this order: refuse a file that holds something shaped like a credential (over everything that
 * was read), refuse a title over the limit, and cut the why and the turned-down text to fit.
 * `origin` is the line a bridge put at the start of the rationale: it is kept whole and is no part
 * of the text the cut's hash covers. One function, so a bridge from another tool's notes is screened, refused and cut by the same
 * rules and the same idea of a credential as an ADR.
 */
export function triage(
  path: string,
  document: AdrDocument,
  line?: number,
  origin = '',
): ScannedDecision | ScanRefusal {
  const at = line !== undefined ? { line } : {};
  // Screened over what was READ, not only over what is kept: the whole options section is
  // screened even where the list is not recorded (see {@link AdrDocument.considered}), and the
  // credential screen runs BEFORE the cut, so a secret past the cut point still refuses the file.
  const fields = fieldsOf(document);
  const screened = document.considered !== undefined ? [...fields, document.considered] : fields;
  const classes = [...new Set(screened.flatMap((field) => detectSecrets(field)))].sort();
  if (classes.length > 0) return { path, ...at, code: 'HOLDS_A_SECRET', classes };
  if (weight(document.title) > FIELD_BYTE_LIMIT) return { path, ...at, code: 'TITLE_TOO_LARGE' };
  const why = cutToFit(document.rationale.slice(origin.length), origin);
  const turnedDown =
    document.alternatives !== undefined ? cutToFit(document.alternatives) : undefined;
  const cut = {
    ...(why.cut !== undefined ? { rationale: why.cut } : {}),
    ...(turnedDown?.cut !== undefined ? { alternatives: turnedDown.cut } : {}),
  };
  const { considered: _considered, ...fieldsOfDocument } = document;
  return {
    ...fieldsOfDocument,
    rationale: why.value,
    ...(turnedDown !== undefined ? { alternatives: turnedDown.value } : {}),
    ...(Object.keys(cut).length > 0 ? { cut } : {}),
    path,
    ...at,
  };
}

/**
 * The names in `directory` that are DECISION DOCUMENTS by their file name alone
 * (markdown, minus the furniture) in file-name order.
 *
 * IT IS SPLIT OUT BECAUSE A SECOND READER ASKS THE NAME QUESTION WITHOUT ASKING THE
 * CONTENT ONE. `mnema status` reports how many documents of a base the record has no
 * decision for, and that answer needs the file names and nothing else: opening every
 * file to triage its fields would pay the whole import's cost on an opening read, to
 * decide a question the names already settle. A second `readdirSync` with a second
 * copy of the extension test and of {@link NOT_A_DECISION} is how the two readers
 * would come to disagree about what counts as a document, one of them counting a
 * `README.md` the other never proposes, so there is one function and two callers.
 *
 * A directory that does not exist, or that cannot be listed, comes back EMPTY rather
 * than throwing, for {@link scanAdrDirectory}'s reason: a typo in a path must not look
 * like a failure of the product.
 *
 * IT ANSWERS ABOUT NAMES AND NEVER ABOUT CONTENT, which is the limit a caller has to
 * carry. A file named here can still be refused by the scan (retired, over the field
 * limit, or holding something shaped like a credential), so a caller counting these is
 * counting files a person may look at, not proposals the record would accept.
 */
export function adrFileNames(directory: string): string[] {
  try {
    return readdirSync(directory, { withFileTypes: true })
      .filter((entry) => entry.isFile() && MARKDOWN.test(entry.name))
      .map((entry) => entry.name)
      .filter((name) => !NOT_A_DECISION.includes(name.replace(MARKDOWN, '').toLowerCase()))
      .sort();
  } catch {
    return [];
  }
}

/**
 * Reads every markdown file in `directory` as a decision document, and returns
 * what it read beside what it refused and why.
 *
 * A directory that does not exist, or that cannot be listed, comes back EMPTY
 * rather than throwing: the caller reports "nothing here" and the person points it
 * somewhere else. Throwing would make a typo in a path look like a failure of the
 * product.
 */
export function scanAdrDirectory(directory: string): AdrScan {
  const names = adrFileNames(directory);

  const read: ScannedDecision[] = [];
  const refused: ScanRefusal[] = [];
  for (const name of names) {
    const path = relative(directory, name);
    let text: string;
    try {
      text = readFileSync(join(directory, name), 'utf8');
    } catch {
      refused.push({ path, code: 'UNREADABLE' });
      continue;
    }
    const document = readAdr(text);
    if (!document.ok) {
      refused.push({ path, code: document.code });
      continue;
    }
    if (!adrIsInForce(document.status)) {
      refused.push({ path, code: 'RETIRED' });
      continue;
    }
    const { ok: _ok, ...parsed } = document;
    const triaged = triage(path, parsed);
    if ('code' in triaged) refused.push(triaged);
    else read.push(triaged);
  }
  return { read, refused };
}
