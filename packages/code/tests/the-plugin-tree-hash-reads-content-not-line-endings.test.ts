/**
 * THE PLUGIN TREE HASH READS CONTENT, NOT LINE ENDINGS. The doctor compares the folder a host
 * installed with the one this binary was built from by this digest, so it must move when a byte of
 * a file moves, when a file comes or goes, and not when a checkout turned `LF` into `CR LF`.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { pluginTreeHash } from '../src/plugin-tree-hash.js';

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'mnema-tree-hash-'));
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

function tree(name: string, files: Record<string, string | Buffer>): string {
  const dir = join(root, name);
  for (const [path, body] of Object.entries(files)) {
    mkdirSync(join(dir, path, '..'), { recursive: true });
    writeFileSync(join(dir, path), body);
  }
  return dir;
}

const base = { 'hooks/a.mjs': 'one\ntwo\n', 'README.md': 'text\n' };

describe('the plugin tree hash', () => {
  it('is a sha256 hex digest, the same for the same content in another folder', () => {
    const one = pluginTreeHash(tree('one', base));
    expect(one).toMatch(/^[0-9a-f]{64}$/);
    expect(pluginTreeHash(tree('two', base))).toBe(one);
  });

  it('does not move when every line ends with CR LF', () => {
    const crlf = tree('crlf', { 'hooks/a.mjs': 'one\r\ntwo\r\n', 'README.md': 'text\r\n' });
    expect(pluginTreeHash(crlf)).toBe(pluginTreeHash(tree('lf', base)));
  });

  it('moves when a byte of a file changes, when a file is added and when one is renamed', () => {
    const one = pluginTreeHash(tree('one', base));
    expect(pluginTreeHash(tree('changed', { ...base, 'hooks/a.mjs': 'one\nTWO\n' }))).not.toBe(one);
    expect(pluginTreeHash(tree('added', { ...base, 'extra.txt': '' }))).not.toBe(one);
    expect(
      pluginTreeHash(tree('renamed', { 'hooks/b.mjs': 'one\ntwo\n', 'README.md': 'text\n' })),
    ).not.toBe(one);
  });

  it('moves for a lone CR, which is not a line ending of a checkout', () => {
    expect(
      pluginTreeHash(tree('cr', { 'hooks/a.mjs': 'one\rtwo\n', 'README.md': 'text\n' })),
    ).not.toBe(pluginTreeHash(tree('lf', base)));
  });

  it('does not read what the host marks at the root of the folder, and reads the same name deeper', () => {
    const clean = pluginTreeHash(tree('clean', base));
    expect(pluginTreeHash(tree('inuse', { ...base, '.in_use/4242': '{"pid":4242}' }))).toBe(clean);
    expect(pluginTreeHash(tree('orphan', { ...base, '.orphaned_at': '1' }))).toBe(clean);
    for (const name of ['.git/HEAD', '.claude-plugin-link', '.links_materialized']) {
      expect(pluginTreeHash(tree(`mark${name}`, { ...base, [name]: 'x' }))).toBe(clean);
    }
    expect(pluginTreeHash(tree('deep', { ...base, 'hooks/.in_use': 'x' }))).not.toBe(clean);
    expect(pluginTreeHash(tree('deep2', { ...base, 'hooks/.orphaned_at': 'x' }))).not.toBe(clean);
  });

  it('says nothing for a folder that is not there', () => {
    expect(pluginTreeHash(join(root, 'missing'))).toBeUndefined();
  });
});
