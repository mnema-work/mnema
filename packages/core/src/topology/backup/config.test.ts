import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ResolvedTrees } from '../resolve.js';
import {
  assignDestination,
  BackupConfigError,
  backupConfigPath,
  destinationOf,
  readBackupConfig,
  whyNotADestination,
} from './config.js';

const NOW = new Date('2026-11-17T10:00:00.000Z');
let base: string;
let path: string;

beforeEach(() => {
  base = mkdtempSync(join(tmpdir(), 'mnema-backup-config-'));
  path = join(base, 'data', 'backup.json');
});

afterEach(() => {
  rmSync(base, { recursive: true, force: true });
});

describe('which folder keeps which project', () => {
  it('lives in the data directory the key root is in', () => {
    expect(backupConfigPath({ keyRoot: join(base, 'data', 'identity') })).toBe(path);
  });

  it('gives a project the folder it was assigned, and a project never set up none', () => {
    assignDestination(path, 'record-a', '/one', NOW);
    assignDestination(path, 'record-b', '/two', NOW);
    const held = readBackupConfig(path);
    expect(destinationOf(held, 'record-a')).toBe('/one');
    expect(destinationOf(held, 'record-b')).toBe('/two');
    expect(destinationOf(held, 'record-c')).toBeUndefined();
  });

  it('says what an assignment replaced, and keeps the others', () => {
    assignDestination(path, 'record-a', '/one', NOW);
    assignDestination(path, 'record-b', '/two', NOW);
    expect(assignDestination(path, 'record-a', '/three', NOW).replaced).toBe('/one');
    expect(destinationOf(readBackupConfig(path), 'record-b')).toBe('/two');
  });

  it('refuses a file it cannot read, and does not overwrite it', () => {
    mkdirSync(join(base, 'data'));
    writeFileSync(path, 'not json');
    expect(() => assignDestination(path, 'record-a', '/one', NOW)).toThrow(BackupConfigError);
    expect(readFileSync(path, 'utf-8')).toBe('not json');
  });

  it('refuses a file with no projects object, and an entry it cannot read', () => {
    mkdirSync(join(base, 'data'));
    writeFileSync(path, '{"format":1}');
    expect(() => readBackupConfig(path)).toThrow(/no "projects" object/);
    writeFileSync(path, '{"projects":{"record-a":{"destination":3}}}');
    expect(() => readBackupConfig(path)).toThrow(/entry for record-a/);
  });

  it('does not read a link', () => {
    mkdirSync(join(base, 'data'));
    writeFileSync(join(base, 'real.json'), '{"projects":{}}');
    symlinkSync(join(base, 'real.json'), path);
    expect(() => readBackupConfig(path)).toThrow(/not a plain file/);
  });
});

describe('where a backup cannot be kept', () => {
  it('refuses a folder inside the working tree, the record or the private tree, and takes one outside', () => {
    const project = join(base, 'project');
    mkdirSync(join(project, '.mnema'), { recursive: true });
    const trees: ResolvedTrees = {
      projectPublic: join(project, '.mnema'),
      projectPrivate: join(project, '.mnema', 'private'),
      global: join(base, 'data', 'global'),
      keyRoot: join(base, 'data', 'identity'),
    };
    expect(whyNotADestination(join(project, 'backup'), trees)).toMatch(/working tree/);
    expect(whyNotADestination(join(project, '.mnema', 'b'), trees)).toMatch(/working tree/);
    expect(whyNotADestination(join(project, '.git', 'b'), trees)).toMatch(/working tree/);
    expect(whyNotADestination(join(base, 'elsewhere'), trees)).toBeUndefined();
    expect(whyNotADestination(join(base, 'data', 'identity', 'b'), trees)).toMatch(
      /data directory/,
    );
    expect(whyNotADestination(join(base, 'data'), trees)).toMatch(/data directory/);
  });

  it('refuses a folder inside the git directory every worktree of the repository shares', () => {
    const main = join(base, 'main');
    const worktree = join(base, 'worktree');
    const shared = join(main, '.git');
    const own = join(shared, 'worktrees', 'worktree');
    mkdirSync(own, { recursive: true });
    mkdirSync(join(worktree, '.mnema'), { recursive: true });
    writeFileSync(join(shared, 'HEAD'), 'ref: refs/heads/main\n');
    writeFileSync(join(own, 'HEAD'), 'ref: refs/heads/other\n');
    writeFileSync(join(own, 'commondir'), '../..\n');
    writeFileSync(join(worktree, '.git'), `gitdir: ${own}\n`);
    const trees: ResolvedTrees = {
      projectPublic: join(worktree, '.mnema'),
      global: join(base, 'data', 'global'),
      keyRoot: join(base, 'data', 'identity'),
    };
    expect(whyNotADestination(join(shared, 'backup'), trees)).toMatch(/git directory/);
    expect(whyNotADestination(join(base, 'elsewhere'), trees)).toBeUndefined();
  });
});
