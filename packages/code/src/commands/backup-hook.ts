/**
 * `mnema backup hook install | uninstall`: an OPTIONAL `post-commit` hook that runs `mnema backup
 * run` after a commit, and the two acts that put it in a repository and take it out.
 *
 * NOTHING HERE RUNS UNLESS A PERSON ASKED. `install` is the only thing that writes a file, `init`
 * and `backup setup` never call it, and the hook does nothing where the project has no folder or
 * remote for its backup.
 *
 * WHERE THE HOOK GOES is where git would read it (`commit-hook.ts` decides that), with one more
 * refusal: a `core.hooksPath` inside the working tree is a hooks directory the repository's other
 * people share, so a hook written there would run on their machines, and it is not written.
 *
 * WHAT IS WRITTEN IS A MARKED BLOCK. Where no `post-commit` exists the file is the script below;
 * where one exists and is a shell script, the block is added at its end and nothing else of it
 * changes; any other hook is refused, with its path. `uninstall` takes out exactly the block (and
 * the file only if it is the script `install` wrote, to the byte), so a hook that was there before
 * is left as it was.
 *
 * WHAT THE BLOCK DOES. It runs the backup in the background, with no input and no output, so a
 * commit never waits for a network and never fails because of one, and it first removes every
 * variable named `GIT_*` from the environment git handed the hook (GIT_DIR, GIT_INDEX_FILE and the
 * rest point at the repository being committed in): the backup finds its project by the working
 * directory, and the git that works on the destination never meets those variables.
 */

import { chmodSync, existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { isWithin, realOfMaybeMissing } from '@mnema/core';
import { hooksDirOf } from './commit-hook.js';

/** The hook git runs after a commit. */
export const BACKUP_HOOK_NAME = 'post-commit';

const OPEN =
  '# >>> mnema backup (written by `mnema backup hook install`; `mnema backup hook uninstall` removes it)';
const CLOSE = '# <<< mnema backup';

/** The block, byte for byte: what `install` adds and `uninstall` takes out. */
export const BACKUP_HOOK_BLOCK = [
  OPEN,
  'if command -v mnema >/dev/null 2>&1; then',
  '  (',
  '    for mnema_var in $(env | sed -n \'s/^\\(GIT_[A-Za-z0-9_]*\\)=.*/\\1/p\'); do unset "$mnema_var"; done',
  '    mnema backup run || :',
  '  ) </dev/null >/dev/null 2>&1 &',
  'fi',
  CLOSE,
  '',
].join('\n');

/** The file `install` writes where there was none. */
export const BACKUP_HOOK_SCRIPT = `#!/bin/sh\n${BACKUP_HOOK_BLOCK}`;

/** What the acts need: injected so they are testable. */
export interface BackupHookContext {
  readonly cwd: string;
}

/** What `install` and `uninstall` answer with. */
export type BackupHookActed =
  | { readonly ok: true; readonly path: string; readonly state: 'installed' | 'already' }
  | { readonly ok: true; readonly path: string; readonly state: 'removed' | 'absent' }
  | { readonly ok: false; readonly reason: 'NOT_A_REPOSITORY' }
  | { readonly ok: false; readonly reason: 'HOOKS_PATH_IN_TREE'; readonly dir: string }
  | {
      readonly ok: false;
      readonly reason: 'FOREIGN_HOOK';
      readonly path: string;
      /** True where the hook holds a block of ours that was changed by hand. */
      readonly altered: boolean;
    };

/** Whether `text` begins with a shebang of a shell that reads the block. */
function isShellScript(text: string): boolean {
  return /^#!\s*(?:\/usr\/bin\/env\s+)?\S*\b(?:sh|bash|dash|zsh|ksh)\b/.test(
    text.split('\n')[0] ?? '',
  );
}

/** The hook's place, or the reason there is none. */
function placeOf(
  ctx: BackupHookContext,
): { readonly ok: true; readonly path: string } | Exclude<BackupHookActed, { ok: true }> {
  const found = hooksDirOf(ctx.cwd);
  if (!found.ok) return found;
  if (found.configured) {
    const top = realOfMaybeMissing(found.top);
    const dir = realOfMaybeMissing(found.dir);
    if (isWithin(dir, top)) return { ok: false, reason: 'HOOKS_PATH_IN_TREE', dir: found.dir };
  }
  return { ok: true, path: join(found.dir, BACKUP_HOOK_NAME) };
}

/** Writes the hook, or adds the block to a shell hook that is there; any other hook is refused. */
export function installBackupHook(ctx: BackupHookContext): BackupHookActed {
  const place = placeOf(ctx);
  if (!place.ok) return place;
  if (!existsSync(place.path)) {
    mkdirSync(dirname(place.path), { recursive: true });
    // `wx`: the file appearing between the check and the write is somebody else's, not ours.
    writeFileSync(place.path, BACKUP_HOOK_SCRIPT, { flag: 'wx' });
    chmodSync(place.path, 0o755);
    return { ok: true, path: place.path, state: 'installed' };
  }
  const held = readFileSync(place.path, 'utf-8');
  if (held.includes(BACKUP_HOOK_BLOCK)) return { ok: true, path: place.path, state: 'already' };
  if (held.includes(OPEN) || !isShellScript(held)) {
    return { ok: false, reason: 'FOREIGN_HOOK', path: place.path, altered: held.includes(OPEN) };
  }
  writeFileSync(place.path, `${held}\n${BACKUP_HOOK_BLOCK}`);
  return { ok: true, path: place.path, state: 'installed' };
}

/** Takes out the block, and the file when it is the one `install` wrote. Nothing else of a hook is touched. */
export function uninstallBackupHook(ctx: BackupHookContext): BackupHookActed {
  const place = placeOf(ctx);
  if (!place.ok) return place;
  if (!existsSync(place.path)) return { ok: true, path: place.path, state: 'absent' };
  const held = readFileSync(place.path, 'utf-8');
  if (held === BACKUP_HOOK_SCRIPT) {
    unlinkSync(place.path);
    return { ok: true, path: place.path, state: 'removed' };
  }
  if (!held.includes(BACKUP_HOOK_BLOCK)) {
    return held.includes(OPEN)
      ? { ok: false, reason: 'FOREIGN_HOOK', path: place.path, altered: true }
      : { ok: true, path: place.path, state: 'absent' };
  }
  // `install` added a line break in front of the block, and it goes with it: the hook is as it was, to the byte.
  const withBreak = `\n${BACKUP_HOOK_BLOCK}`;
  const whole = held.includes(withBreak) ? withBreak : BACKUP_HOOK_BLOCK;
  const cut = held.indexOf(whole);
  writeFileSync(place.path, held.slice(0, cut) + held.slice(cut + whole.length));
  return { ok: true, path: place.path, state: 'removed' };
}
