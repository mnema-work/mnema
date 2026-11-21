/**
 * The staging files a killed writer leaves in `locks/`: `<tail>.head.<pid>`, `<tail>.head.sig.<pid>`
 * and `<tail>.cited.<pid>` are written whole and renamed over the note they stage (`kept-head.ts`,
 * `cited-heads.ts`), and a kill between the write and the rename leaves the file for good.
 *
 * They are written only inside the tail's lock, so a writer that holds it and finds one named for
 * a pid that no longer answers is looking at a dead writer's leftover. Only this tail's files are
 * looked at, and a pid that answers is never touched, the lock's own test of a live holder.
 */

import { readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import type { ChainLayout } from './layout.js';
import { alive } from './tail-lock.js';

const STAGING = /^(?:head|head\.sig|cited|covered|citations\.[^.]+)\.(\d+)$/;

/**
 * Removes the staging files of `tailId` whose writer is gone, and names the ones it removed. Call it
 * holding the tail's lock.
 */
export function clearOrphanedStaging(layout: ChainLayout, tailId: string): string[] {
  const dir = join(layout.root, 'locks');
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch {
    return [];
  }
  const removed: string[] = [];
  const own = `${tailId}.`;
  for (const name of names) {
    if (!name.startsWith(own)) continue;
    const match = STAGING.exec(name.slice(own.length));
    if (match === null) continue;
    const pid = Number.parseInt(match[1] as string, 10);
    if (pid === process.pid || alive(pid)) continue;
    try {
      rmSync(join(dir, name), { force: true });
      removed.push(name);
    } catch {
      // Machinery, never proof: a file that stays costs nothing but the sweep of the next write.
    }
  }
  return removed;
}
