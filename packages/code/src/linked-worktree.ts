/**
 * What a refusal can say when the checkout it ran in is a linked worktree: where the main
 * checkout is, and, for a read that found no project, where its record is.
 *
 * ONLY A HINT. It reads where git keeps the repository ({@link gitPlaceOf}, the files git writes,
 * no `git` run) and whether the main checkout's `.mnema` folder exists; it opens nothing inside
 * it. A record the main checkout holds and has not committed is not served from a worktree, and
 * the refusal says so rather than pretending to know what that record holds.
 */

import { existsSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { gitPlaceOf } from '@mnema/core';

/** The main checkout's top when `cwd` is in a linked worktree of a repository that has one, else undefined. */
function mainCheckoutOf(cwd: string): { readonly top: string; readonly main: string } | undefined {
  const place = gitPlaceOf(cwd);
  if (place === undefined || place.gitDir === place.commonDir) return undefined;
  if (basename(place.commonDir) !== '.git') return undefined;
  return { top: place.top, main: dirname(place.commonDir) };
}

/**
 * The `.mnema` folder of the main checkout that a project here would have been, when `cwd` is in
 * a linked worktree and that folder exists there: the record a new worktree does not get because
 * git keeps it out of its commits. Undefined anywhere else.
 */
export function recordOfTheMainCheckout(cwd: string): string | undefined {
  const found = mainCheckoutOf(cwd);
  if (found === undefined) return undefined;
  const start = resolve(cwd);
  for (let dir = start; ; dir = dirname(dir)) {
    const candidate = join(found.main, relative(found.top, dir), '.mnema');
    if (existsSync(candidate)) return candidate;
    if (dir === found.top || dirname(dir) === dir) return undefined;
  }
}

/** The sentence a read with no project says in a linked worktree whose main checkout holds a record. */
export function noProjectInAWorktree(cwd: string): string | undefined {
  const record = recordOfTheMainCheckout(cwd);
  return record === undefined
    ? undefined
    : `No mnema project here: this is a linked worktree, and the record is at ${record}, which git does not carry into a checkout. Run mnema from there; \`mnema init\` here would found a second record.`;
}

/** The sentence a read that found no such record adds in a linked worktree, or undefined elsewhere. */
export function notHereInAWorktree(cwd: string): string | undefined {
  const found = mainCheckoutOf(cwd);
  if (found === undefined) return undefined;
  return `This is a linked worktree: a record written in the main checkout (${found.main}) and not yet committed is not here; read it from there.`;
}
