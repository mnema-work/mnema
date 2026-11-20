/**
 * What a link may NOT end in: the one rule both write surfaces (`mnema link` and `link_knowledge`)
 * ask before anything is signed.
 *
 * `mnema link ADR-1 src/gen --rel refuses-a-write` used to be accepted, exit 0, and record the
 * text "ADR-1" as the subject of an edge pointing at nothing; the notice that said so came on the
 * fifth line, after the edge was already part of a chain that cannot be edited. A label that names
 * one decision is now turned into that decision's id before this is asked
 * (`label-as-address.ts`), so what reaches here still shaped like a label is one NO decision here
 * carries. It names nothing, and a link is refused rather than record it: on either end.
 *
 * It refuses only that. A subject or a target that is not a label is not required to resolve: a link
 * is legitimately cross-tree, and an address may name a path the tree does not hold yet.
 */

import { existsSync, realpathSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, isAbsolute, join, posix, win32 } from 'node:path';
import type { UpcasterRegistry } from '@mnema/chain';
import type { RecordedAs } from '@mnema/context';
import { ADDRESS_RELATIONS, locateLinkScope, type ResolvedTrees, type Scope } from '@mnema/core';
import { inAWorkTree } from './git-log.js';
import { addressLiesOutside, addressRelativeToRoot } from './governed-tree.js';
import { oneLine } from './one-line.js';

/** Whether a word has the shape of a decision label (`ADR-` and a number). */
export function isLabelShaped(word: string): boolean {
  return /^ADR-\d+$/i.test(word.trim());
}

/** The sentence that refuses a link, or `undefined` when neither end is a label left raw. */
export function linkRefusal(ends: {
  readonly subject: string;
  readonly target: string;
}): string | undefined {
  for (const end of [ends.subject, ends.target]) {
    if (isLabelShaped(end)) {
      return `"${oneLine(end)}" is a label no decision here carries, so it names nothing: a label is never recorded as an end of a link. Nothing was recorded.`;
    }
  }
  return undefined;
}

/**
 * The sentence that refuses a relation that names something in the project (`--rel docs/`), or
 * `undefined`. A relation is an open label, so `and/or` is one; a value with a separator that is
 * a file or a directory of this project is the target typed in the wrong place. The syntactic
 * half of the rule (`src/a.ts`, `./x`) is the write door's; this half needs the project's root.
 */
export function relationNamesAPath(rel: string, root: string): string | undefined {
  if (!rel.includes('/') || /\s/u.test(rel)) return undefined;
  if (!existsSync(join(root, rel))) return undefined;
  return `the rel "${oneLine(rel)}" is a path that exists in this project, not a relation: a relation is a label such as \`governs\` or \`relates-to\`, and the path goes where the target goes. Nothing was recorded.`;
}

/**
 * The sentence that refuses a link whose target is a path OUTSIDE the project, or `undefined` when
 * it is not one. Asked only of a link born in the public tree, which is committed and reaches every
 * clone: an address no clone can resolve is the one thing that tree must not carry. The private and
 * global trees stay on one machine and are not asked.
 *
 * Only a relation that carries an ADDRESS is asked (`ADDRESS_RELATIONS`): `derived-from` cites the
 * file a proposal was read out of, which may legitimately be a name no clone can open, and covers
 * no region. Only a target shaped like a path is asked at all: an id has no `/` in it. "Outside" is
 * the one idea the gates use (`addressLiesOutside`).
 */
export function outsideTheProject(rel: string, target: string, root: string): string | undefined {
  if (!(ADDRESS_RELATIONS as readonly string[]).includes(rel)) return undefined;
  if (!addressLiesOutside(target, root)) return undefined;
  if (!inAWorkTree(root)) {
    return `"${oneLine(target)}" is outside this project, and a link in the public tree travels only as the project's files are copied, and no copy can open that path. Link a path inside the project, or record the link with --scope private. Nothing was recorded.`;
  }
  return `"${oneLine(target)}" is outside this project, and a link in the public tree reaches every clone, none of which can open that path. Link a path inside the project, or record the link with --scope private. Nothing was recorded.`;
}

/**
 * The target as the PUBLIC tree records it. An absolute path under the project root is written
 * relative to it, through the reduction the gates compare by (`addressRelativeToRoot`): an absolute
 * path is "inside" only on the machine whose root it names, and in a clone with another root it
 * would be an address outside the project, which is the one thing that tree must not carry. A
 * target already relative, a relation that carries no address, and a path outside (refused before
 * this is asked) are recorded as typed.
 */
export function targetAsRecorded(rel: string, target: string, root: string): string {
  if (!(ADDRESS_RELATIONS as readonly string[]).includes(rel)) return target;
  return reducedToRoot(target, root);
}

/** The one reduction: an absolute path goes relative to the root, anything else stays as it is. */
function reducedToRoot(target: string, root: string): string {
  if (!isAbsolute(target)) return target;
  return addressRelativeToRoot(target, root);
}

/**
 * The other spellings a READ may find a link's target under: what each project's public tree
 * records an absolute path under THAT project's root as, for the readings that take the text of a
 * target (`refs`, `timeline`, `audit_refs`, `audit_timeline`). It is the same reduction `link`
 * writes with, so a read and a write cannot disagree on what a path is recorded as. A workspace
 * holds several projects, and the path is reduced against each root that contains it: one
 * reduction per project, each answering for that project's public tree alone (`RecordedAs`).
 * Undefined when no project has another spelling (an id, a relative path, no project): the target
 * as typed is then the only one. What each may answer for is the reading's to decide by relation
 * and by tree: a relation that carries no address records the target as typed.
 */
export function targetRecordedAs(
  projects: readonly ResolvedTrees[],
  target: string,
): readonly RecordedAs[] | undefined {
  const spellings = new Map<string, RecordedAs>();
  for (const trees of projects) {
    if (trees.projectPublic === undefined) continue;
    const reduced = reducedToRoot(target, dirname(trees.projectPublic));
    if (reduced === target) continue;
    spellings.set(trees.projectPublic, { target: reduced, chainRoot: trees.projectPublic });
  }
  return spellings.size === 0 ? undefined : [...spellings.values()];
}

/**
 * Finds the tree a link is in by the target as TYPED, and failing that by the target as the public
 * tree would have recorded it (`targetAsRecorded`): a link written absolute by an earlier version is
 * still found by what it was written as, and one this version wrote relative is found by the
 * absolute path that named it. The typed form is asked first, so when both exist the one written
 * as typed is the one that is found. The reduced form is asked of the public tree alone, as it is
 * the only tree `link` reduces for. Returns where it is and the target as that tree holds it.
 */
export function locateLinkAsRecorded(
  trees: ResolvedTrees,
  edge: { readonly subject: string; readonly target: string; readonly rel: string },
  upcasters: UpcasterRegistry,
): { readonly scope: Scope; readonly target: string } | undefined {
  const typed = locateLinkScope(trees, edge, upcasters);
  if (typed !== undefined) return { scope: typed, target: edge.target };
  if (trees.projectPublic === undefined) return undefined;
  const target = targetAsRecorded(edge.rel, edge.target, dirname(trees.projectPublic));
  if (target === edge.target) return undefined;
  // The public tree is searched first, so a `public` answer is the public tree's own.
  const scope = locateLinkScope(trees, { ...edge, target }, upcasters);
  return scope === 'public' ? { scope, target } : undefined;
}

/**
 * Whether a target is a path under a temporary folder: `os.tmpdir()`, `/tmp`, `/var/tmp`, their macOS
 * spellings (`/private/tmp`, `/private/var/folders`), `$TMPDIR` and the Windows `%TEMP%` and `%TMP%`.
 * Such a folder is cleared by a reboot or a cleanup, so a link to a file there names something that may
 * be gone when a reader follows it. Only an absolute path is asked (a relative one is read against a
 * folder the link does not say), and a path under the project's own root never is: a project may live
 * under a temporary folder and its files are its own.
 *
 * A path that exists is compared by where it really is (so `/tmp/p` and `/private/tmp/p` are one place
 * on macOS, where the one is a link to the other), one that does not by its text, the way
 * `addressLiesOutside` compares. A Windows path is compared by text only: a short 8.3 name is not
 * expanded, and a `\\?\` prefix is dropped. A `$TMPDIR` that is `/`, the home folder or a folder
 * holding the project is not read as a temporary folder: the rest of the machine is not one.
 */
export function isUnderATemporaryFolder(
  target: string,
  root: string | undefined,
  env: Readonly<Record<string, string | undefined>> = process.env,
  tmp: string = tmpdir(),
  home: string = homedir(),
): boolean {
  const bare = (path: string): string => path.replace(/^\\\\[?.]\\(?=[A-Za-z]:|UNC\\)/u, '');
  const typed = bare(target);
  const flavor = /^[A-Za-z]:[\\/]|^\\\\/u.test(typed) ? win32 : posix;
  if (!flavor.isAbsolute(typed)) return false;
  const where = (path: string): string =>
    flavor === posix ? truthfully(flavor.resolve(path)) : flavor.resolve(bare(path));
  const holds = (folder: string, path: string): boolean => {
    const into = flavor.relative(where(folder), where(path));
    return into === '' || (into.split(flavor.sep)[0] !== '..' && !flavor.isAbsolute(into));
  };
  if (root !== undefined && flavor.isAbsolute(root) && holds(root, typed)) return false;
  const named = [tmp, env.TMPDIR, env.TEMP, env.TMP].filter(
    (folder): folder is string =>
      folder !== undefined &&
      flavor.isAbsolute(folder) &&
      flavor.resolve(folder) !== flavor.parse(flavor.resolve(folder)).root &&
      !(flavor === posix && where(folder) === where(home)) &&
      !(
        root !== undefined &&
        flavor.isAbsolute(root) &&
        holds(folder, root) &&
        !holds(root, folder)
      ),
  );
  const folders = [...['/tmp', '/var/tmp', '/private/tmp', '/private/var/folders'], ...named];
  return folders.some((folder) => holds(folder, typed));
}

/** A path as the file system has it: the deepest part that exists is resolved, the rest kept as typed. */
function truthfully(path: string): string {
  let head = path;
  let rest = '';
  for (;;) {
    try {
      return posix.join(realpathSync(head), rest);
    } catch {
      const up = dirname(head);
      if (up === head) return path;
      rest = posix.join(posix.basename(head), rest);
      head = up;
    }
  }
}
