/**
 * The one edit `mnema upgrade` makes to a file that declares the mnema MCP server more than once: it drops
 * named entries of one `mcpServers` table and nothing else.
 *
 * The files are plain JSON (`~/.claude.json`, a project's `.mcp.json`), and a person's `~/.claude.json` holds the
 * host's own state beside the servers, so the edit is TEXTUAL, like the VS Code one (`doctor-vscode.ts`, whose
 * scanner this uses): it finds each member by scanning tokens, cuts the bytes of that member and leaves every other
 * byte where it was. A file it cannot scan to the end, that is not strict JSON, or whose result does not read back
 * as the original minus exactly those entries, is REFUSED with the reason, and nothing is written.
 */

import { type ObjectScan, objectAt, only, rootObject, Unsafe } from './doctor-vscode.js';

/** Where the table is: the keys from the top-level object down to the `mcpServers` object. */
export type TablePath = readonly string[];

/** What removing entries from one file would do. */
export type RemovePlan =
  | { readonly kind: 'refused'; readonly why: string }
  | { readonly kind: 'unchanged' }
  | { readonly kind: 'change'; readonly text: string; readonly removed: readonly string[] };

function descend(text: string, root: ObjectScan, path: TablePath): ObjectScan | undefined {
  let scan = root;
  for (const key of path) {
    const member = only(
      scan.members.filter((m) => m.key === key),
      `“${key}”`,
    );
    if (member === undefined) return undefined;
    if (text[member.valueStart] !== '{') throw new Unsafe(`“${key}” is not an object`);
    scan = objectAt(text, member.valueStart);
  }
  return scan;
}

/** The text without the member `key` of `scan`, and without the comma that joined it to its neighbours. */
function cut(text: string, scan: ObjectScan, key: string): string {
  const at = scan.members.findIndex((m) => m.key === key);
  const one = scan.members[at];
  if (one === undefined) return text;
  const end = one.commaAt >= 0 ? one.commaAt + 1 : one.valueEnd;
  const lineStart = text.lastIndexOf('\n', one.start - 1) + 1;
  const lineEnd = text.indexOf('\n', end);
  const alone =
    /^[ \t]*$/.test(text.slice(lineStart, one.start)) &&
    /^[ \t]*\r?$/.test(text.slice(end, lineEnd < 0 ? text.length : lineEnd));
  const previous = scan.members[at - 1];
  // The last member has no comma of its own: the one before it loses its, or the object would end in a comma.
  const dropPreviousComma = (from: string): string =>
    previous === undefined || previous.commaAt < 0 || one.commaAt >= 0
      ? from
      : `${from.slice(0, previous.commaAt)}${from.slice(previous.commaAt + 1)}`;
  if (alone) {
    const stop = lineEnd < 0 ? text.length : lineEnd + 1;
    const cutText = `${text.slice(0, lineStart)}${text.slice(stop)}`;
    return dropPreviousComma(cutText);
  }
  const next = scan.members[at + 1];
  if (one.commaAt >= 0 && next !== undefined) {
    return `${text.slice(0, one.start)}${text.slice(next.start)}`;
  }
  return dropPreviousComma(`${text.slice(0, one.start)}${text.slice(one.valueEnd)}`);
}

function without(value: unknown, path: TablePath, names: readonly string[]): unknown {
  const copy = structuredClone(value) as Record<string, unknown>;
  let table: unknown = copy;
  for (const key of path) table = (table as Record<string, unknown> | undefined)?.[key];
  for (const name of names) delete (table as Record<string, unknown>)[name];
  return copy;
}

/** What it would take to drop `names` from the table at `path` of this JSON text, touching no other byte. */
export function planRemoval(text: string, path: TablePath, names: readonly string[]): RemovePlan {
  try {
    let original: unknown;
    try {
      original = JSON.parse(text);
    } catch {
      return { kind: 'refused', why: 'the file is not strict JSON, which is all this edits' };
    }
    const root = rootObject(text);
    if (root === undefined) return { kind: 'unchanged' };
    let out = text;
    const removed: string[] = [];
    for (const name of names) {
      const now = rootObject(out);
      const table = now === undefined ? undefined : descend(out, now, path);
      if (table === undefined) continue;
      const matches = table.members.filter((m) => m.key === name);
      if (matches.length > 1) throw new Unsafe(`“${name}” appears more than once`);
      if (matches.length === 0) continue;
      out = cut(out, table, name);
      removed.push(name);
    }
    if (removed.length === 0) return { kind: 'unchanged' };
    let after: unknown;
    try {
      after = JSON.parse(out);
    } catch {
      return { kind: 'refused', why: 'the edited text did not read back as JSON' };
    }
    if (JSON.stringify(after) !== JSON.stringify(without(original, path, removed))) {
      return {
        kind: 'refused',
        why: 'the edited text did not read back as the file minus those entries',
      };
    }
    return { kind: 'change', text: out, removed };
  } catch (error) {
    if (error instanceof Unsafe) return { kind: 'refused', why: error.message };
    throw error;
  }
}
