/**
 * A COPY MADE BY `mnema backup run` IS READ BY BOTH READERS, AND THEY SAY THE SAME THING.
 *
 * `mnema backup verify` reads a copy with this mnema's reader and says that it is ONE reader: no module
 * of the product starts Python (the floor is held over test files, in CI), so the second reader, written
 * from `FORMAT.md`, is run here, over the same folder, and required to agree: a copy that was made and
 * not touched verifies in both, and a copy with a byte of a tail flipped is refused by both.
 */

// @plants-damage
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runBackupRun, runBackupSetup, runBackupVerify } from '../src/commands/backup.js';
import { runInit } from '../src/commands/init.js';
import { runTask } from '../src/commands/task.js';

const SECOND_READER = fileURLToPath(
  new URL('../../chain/verifier/mnema_verify.py', import.meta.url),
);

let sandbox: string;

beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), 'mnema-copy-second-reader-'));
});

afterEach(() => {
  rmSync(sandbox, { recursive: true, force: true });
});

/** The second reader over `folder`: its exit (0 verified, 1 refused) and the first line it says. */
function secondReader(folder: string): { exit: number | null; says: string } {
  const ran = spawnSync('python3', ['-I', SECOND_READER, 'record', folder], {
    encoding: 'utf-8',
    env: { PATH: process.env.PATH ?? '', HOME: sandbox },
  });
  if (ran.error !== undefined) throw new Error(`python3 could not be run: ${ran.error.message}`);
  return { exit: ran.status, says: ran.stdout.split('\n')[0] ?? '' };
}

describe('the second reader over a backup copy', () => {
  it('verifies an untouched copy, and refuses with this one a copy with a flipped byte', () => {
    const env = { home: join(sandbox, 'home') };
    const cwd = join(sandbox, 'project');
    mkdirSync(cwd);
    runInit({ cwd, env });
    const ctx = { cwd, env };
    expect(runTask(ctx, { title: 'a private one', scope: 'private' }).ok).toBe(true);
    const set = runBackupSetup(ctx, join(sandbox, 'folder'));
    if (!set.ok) throw new Error('setup refused');
    expect(runBackupRun(ctx).ok).toBe(true);
    const copy = join(sandbox, 'folder', set.record, 'private');

    expect(secondReader(copy).exit).toBe(0);
    const verified = runBackupVerify(ctx);
    expect(verified.ok && verified.sound).toBe(true);

    const [tail] = readdirSync(join(copy, 'tails'));
    const segment = join(copy, 'tails', tail as string, '000001.jsonl');
    const bytes = readFileSync(segment);
    bytes[2] = bytes[2] === 0x61 ? 0x62 : 0x61;
    writeFileSync(segment, bytes);

    expect(secondReader(copy).exit).toBe(1);
    const refused = runBackupVerify(ctx);
    expect(refused.ok && refused.sound).toBe(false);
    const reading =
      refused.ok && 'reading' in (refused.trees[0] ?? {}) ? refused.trees[0] : undefined;
    expect(reading && 'reading' in reading && reading.reading.reader.ok).toBe(false);
  });
});
