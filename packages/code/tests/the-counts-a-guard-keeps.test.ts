import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { holdTheCounts } from './support/the-counts-a-guard-keeps.js';

function ledgerFile(): string {
  const path = join(mkdtempSync(join(tmpdir(), 'counts-')), 'guard.test.ts');
  writeFileSync(
    path,
    ['const A_LEDGER = {', "  'a.md': 4,", "  'b.md': { line: 2, name: 7 },", '};', ''].join('\n'),
  );
  return path;
}

const ledger = (path: string, updating: boolean) => ({
  testFile: pathToFileURL(path).href,
  name: 'A_LEDGER',
  read: { 'a.md': 6, 'b.md': { line: 2, name: 9 }, 'new.md': 1 },
  declared: { 'a.md': 4, 'b.md': { line: 2, name: 7 } },
  updating,
});

describe('a count a guard keeps by hand', () => {
  it('is refused with the line to change and the number to write, the file left as it was', () => {
    const path = ledgerFile();
    const before = readFileSync(path, 'utf8');
    expect(() => holdTheCounts(ledger(path, false))).toThrow(
      /guard\.test\.ts:2: 'a\.md' says 4, the guard read 6/,
    );
    expect(() => holdTheCounts(ledger(path, false))).toThrow(
      /guard\.test\.ts:3: 'b\.md' name says 7, the guard read 9/,
    );
    expect(readFileSync(path, 'utf8')).toBe(before);
  });

  it('is rewritten in place under the update mode, and only the counts of the rows already listed', () => {
    const path = ledgerFile();
    const restated = holdTheCounts(ledger(path, true));
    expect(readFileSync(path, 'utf8')).toBe(
      ['const A_LEDGER = {', "  'a.md': 6,", "  'b.md': { line: 2, name: 9 },", '};', ''].join(
        '\n',
      ),
    );
    expect(restated).toEqual({ 'a.md': 6, 'b.md': { line: 2, name: 9 } });
    expect(Object.keys(restated)).not.toContain('new.md');
  });

  it('says nothing about a ledger that already holds what was read', () => {
    const path = ledgerFile();
    const same = { ...ledger(path, false), read: { 'a.md': 4, 'b.md': { line: 2, name: 7 } } };
    expect(holdTheCounts(same)).toEqual(same.declared);
  });
});
