/**
 * The block mnema keeps in a repository's `info/exclude`, the file git reads, in the common git
 * directory, to ignore paths for every worktree of the repository without a tracked file saying
 * so.
 *
 * THE BLOCK IS THE ONLY PART OF THE FILE THIS TOUCHES. It is two marker lines and the lines
 * between them; everything outside is the person's, kept byte for byte, including its line
 * endings and a last line with no newline. A line is added to or taken from the block only; an
 * identical line outside it is never read as ours. When the last line leaves, the block goes
 * whole. Nothing here runs git: {@link excludeFileOf} reads the place the way {@link gitPlaceOf}
 * does, and a linked worktree answers with the common directory's file, one for all of them.
 *
 * A BLOCK THAT IS NOT ONE BLOCK is refused with the line it was found at and nothing written: an
 * opening with no closing, a closing with no opening, a second block, an opening inside one. A
 * guess about what the person meant would rewrite lines that are theirs.
 *
 * The file is written whole through a temporary file beside it and a rename, and never through a
 * link: a link in its place is refused by name. A file in CRLF gets the block in CRLF, a file that
 * is not UTF-8 keeps each of its bytes (it is read and written as bytes, and only the lines this
 * module adds are encoded), and the file keeps the mode it had (0644 when this makes it).
 *
 * ONE WRITER AT A TIME: the read, the change and the rename happen under a lock file beside the
 * exclude file (`exclude.mnema-lock`, created exclusively, the tail lock's own primitive, so a
 * lock of a dead process is broken the same way), and a temporary file a dead process left is
 * removed under it. Two mnema processes therefore never lose each other's line; a process of
 * another program writing the file is not stopped by a lock it does not know. An empty block (its
 * two markers and nothing between) is removed by the next write.
 */

import {
  chmodSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { alive, TailBusyError, withTailLock } from '@mnema/chain';
import { gitPlaceOf } from './git-place.js';

const BEGIN = '# >>> mnema (managed by mnema; edit only outside these two lines)';
const END = '# <<< mnema';

/** Why the exclude file was left as it was found. */
export class ExcludeBlockError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExcludeBlockError';
  }
}

/** The exclude file of the repository `dir` belongs to, or undefined outside one. */
export function excludeFileOf(dir: string): string | undefined {
  const place = gitPlaceOf(dir);
  return place === undefined ? undefined : join(place.commonDir, 'info', 'exclude');
}

/** The lines in the block, in order; none for an absent file or a file with no block. */
export function excludeLinesOf(file: string): string[] {
  const parsed = parse(file);
  return parsed.block === undefined ? [] : insideOf(parsed).map((l) => decode(l.text));
}

/** Adds the lines the block lacks. True when the file changed. */
export function withExcludeLines(file: string, lines: readonly string[]): boolean {
  for (const line of lines) {
    if (line.trim() === '' || line !== line.trim() || /[\r\n]/.test(line) || /^[#!]/.test(line)) {
      throw new ExcludeBlockError(`${JSON.stringify(line)} is not a line the block can hold.`);
    }
  }
  return underLock(file, () => {
    const parsed = parse(file);
    const wanted = lines.map(encode);
    const held = parsed.block === undefined ? [] : insideOf(parsed).map(textOf);
    const missing = wanted.filter(
      (line, at) => !held.includes(line) && wanted.indexOf(line) === at,
    );
    if (missing.length === 0) return false;
    const eol = parsed.eol;
    const added = missing.map((line) => ({ text: line, eol }));
    let next: Line[];
    if (parsed.block === undefined) {
      const before = parsed.lines.map((l, at) =>
        at === parsed.lines.length - 1 && l.eol === '' ? { text: l.text, eol } : l,
      );
      next = [...before, { text: BEGIN, eol }, ...added, { text: END, eol }];
    } else {
      next = [...parsed.lines];
      next.splice(parsed.block.end, 0, ...added);
    }
    write(file, next);
    return true;
  });
}

/** Takes the lines out of the block (the block with its last one). True when the file changed. */
export function withoutExcludeLines(file: string, lines: readonly string[]): boolean {
  if (lstatSync(file, { throwIfNoEntry: false }) === undefined) return false;
  return underLock(file, () => {
    const parsed = parse(file);
    if (parsed.block === undefined) return false;
    const { begin, end } = parsed.block;
    const inside = parsed.lines.slice(begin + 1, end);
    const gone = lines.map(encode);
    const kept = inside.filter((l) => !gone.includes(l.text));
    if (kept.length === inside.length && inside.length > 0) return false;
    const next = [
      ...parsed.lines.slice(0, begin),
      ...(kept.length === 0
        ? []
        : [parsed.lines[begin] as Line, ...kept, parsed.lines[end] as Line]),
      ...parsed.lines.slice(end + 1),
    ];
    write(file, next);
    return true;
  });
}

interface Line {
  readonly text: string;
  readonly eol: string;
}

interface Parsed {
  readonly lines: Line[];
  readonly block: { readonly begin: number; readonly end: number } | undefined;
  /** The line ending the file uses; the first one it has, LF when it has none. */
  readonly eol: string;
}

const textOf = (line: Line): string => line.text;

/** The file is held as latin1 text: one character per byte, so no byte is changed by reading it. */
const encode = (text: string): string => Buffer.from(text, 'utf8').toString('latin1');
const decode = (text: string): string => Buffer.from(text, 'latin1').toString('utf8');

function insideOf(parsed: Parsed): Line[] {
  return parsed.block === undefined
    ? []
    : parsed.lines.slice(parsed.block.begin + 1, parsed.block.end);
}

function parse(file: string): Parsed {
  let raw: string;
  try {
    raw = readFileSync(file).toString('latin1');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { lines: [], block: undefined, eol: '\n' };
    }
    throw new ExcludeBlockError(
      `Cannot read ${file}: ${(error as NodeJS.ErrnoException).code ?? 'unreadable'}.`,
    );
  }
  const lines: Line[] = [];
  for (const match of raw.matchAll(/([^\n]*?)(\r?\n|$)/g)) {
    if (match[1] === '' && match[2] === '') continue;
    lines.push({ text: match[1] as string, eol: match[2] as string });
  }
  const eol = lines.find((l) => l.eol !== '')?.eol ?? '\n';
  let begin: number | undefined;
  let end: number | undefined;
  lines.forEach((line, at) => {
    const where = `${file}, line ${at + 1}`;
    if (line.text === BEGIN) {
      if (begin !== undefined) {
        throw new ExcludeBlockError(
          `The mnema block in ${where} is a second opening (the first is at line ${begin + 1}); ${file} was left as it was.`,
        );
      }
      begin = at;
    } else if (line.text === END) {
      if (begin === undefined || end !== undefined) {
        throw new ExcludeBlockError(
          `The mnema block closes at ${where} with no opening before it; ${file} was left as it was.`,
        );
      }
      end = at;
    }
  });
  if (begin !== undefined && end === undefined) {
    throw new ExcludeBlockError(
      `The mnema block opened at ${file}, line ${begin + 1} is never closed; ${file} was left as it was.`,
    );
  }
  return {
    lines,
    block: begin === undefined || end === undefined ? undefined : { begin, end },
    eol,
  };
}

function underLock<T>(file: string, act: () => T): T {
  const dir = dirname(file);
  try {
    mkdirSync(dir, { recursive: true });
    return withTailLock(
      `${file}.mnema-lock`,
      () => {
        clearTemporariesOfTheDead(file);
        return act();
      },
      { waitMs: 3_000 },
    );
  } catch (error) {
    if (error instanceof TailBusyError) {
      throw new ExcludeBlockError(
        `Another mnema process is changing ${file}${error.heldBy === undefined ? '' : ` (pid ${error.heldBy})`}; nothing was written. Try again.`,
      );
    }
    if (error instanceof ExcludeBlockError) throw error;
    throw new ExcludeBlockError(
      `Cannot change ${file}: ${(error as NodeJS.ErrnoException).code ?? 'failed'}.`,
    );
  }
}

function clearTemporariesOfTheDead(file: string): void {
  const prefix = `${basename(file)}.mnema-`;
  for (const name of readdirSync(dirname(file))) {
    const pid =
      name.startsWith(prefix) && name.endsWith('.tmp') ? name.slice(prefix.length, -4) : '';
    if (/^\d+$/.test(pid) && !alive(Number(pid))) {
      rmSync(join(dirname(file), name), { force: true });
    }
  }
}

function write(file: string, lines: readonly Line[]): void {
  try {
    const found = lstatSync(file, { throwIfNoEntry: false });
    if (found?.isSymbolicLink()) {
      throw new ExcludeBlockError(`${file} is a link, and mnema writes no file through a link.`);
    }
    const mode = found === undefined ? 0o644 : statSync(file).mode & 0o777;
    const temporary = `${file}.mnema-${process.pid}.tmp`;
    try {
      writeFileSync(temporary, Buffer.from(lines.map((l) => l.text + l.eol).join(''), 'latin1'), {
        mode,
      });
      chmodSync(temporary, mode);
      renameSync(temporary, file);
    } catch (error) {
      rmSync(temporary, { force: true });
      throw error;
    }
  } catch (error) {
    if (error instanceof ExcludeBlockError) throw error;
    throw new ExcludeBlockError(
      `Cannot write ${file}: ${(error as NodeJS.ErrnoException).code ?? 'failed'}.`,
    );
  }
}
