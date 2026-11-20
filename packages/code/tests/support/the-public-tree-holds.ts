/**
 * Whether the words are anywhere in the files the public tree of a project keeps: what a clone of
 * the repository would receive. It only reads.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export function publicTreeHolds(repo: string, words: string): boolean {
  const record = join(repo, '.mnema', 'tails');
  for (const folder of readdirSync(record)) {
    for (const file of readdirSync(join(record, folder))) {
      if (!file.endsWith('.jsonl')) continue;
      if (
        readFileSync(join(record, folder, file), 'utf-8')
          .toLowerCase()
          .includes(words)
      ) {
        return true;
      }
    }
  }
  return false;
}

/** How many lines the public tree's files hold: a refused write leaves this number as it was. */
export function publicTreeLines(repo: string): number {
  const record = join(repo, '.mnema', 'tails');
  let lines = 0;
  for (const folder of readdirSync(record)) {
    for (const file of readdirSync(join(record, folder))) {
      if (!file.endsWith('.jsonl')) continue;
      lines += readFileSync(join(record, folder, file), 'utf-8')
        .split('\n')
        .filter(Boolean).length;
    }
  }
  return lines;
}
