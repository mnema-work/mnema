import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { decorationFor, RECORD_BADGE, RECORD_COLOR, recordFolderOf } from './record-mark.js';

const FOLDER = join('/work', 'project');
const file = (fsPath: string) => ({ scheme: 'file', fsPath });

describe('the mark on the folder of the record', () => {
  it('is the .mnema folder of the workspace folder', () => {
    expect(recordFolderOf(FOLDER)).toBe(join(FOLDER, '.mnema'));
  });

  it('is the fisheye, one character, so the Explorer, which takes two, shows it whole', () => {
    expect(RECORD_BADGE).toBe('\u25C9');
    expect([...Buffer.from(RECORD_BADGE, 'utf8')]).toEqual([0xe2, 0x97, 0x89]);
    expect(RECORD_BADGE.length).toBe(1);
    expect(RECORD_BADGE).not.toMatch(/\p{Extended_Pictographic}/u);
  });

  it('decorates the folder with the badge, the colour the manifest declares and what the folder is', () => {
    expect(decorationFor(file(join(FOLDER, '.mnema')), FOLDER)).toEqual({
      badge: '\u25C9',
      tooltip: 'The mnema record of this project. mnema verify reads it.',
      color: RECORD_COLOR,
    });
  });

  it('decorates nothing else: a file the rules reach, a folder beside it, a copy of the name, or another scheme', () => {
    for (const fsPath of [
      FOLDER,
      join(FOLDER, 'src', 'a.ts'),
      join(FOLDER, '.mnema', 'public'),
      join(FOLDER, 'src', '.mnema'),
      join(FOLDER, '.mnema.old'),
      join('/elsewhere', '.mnema'),
    ]) {
      expect(decorationFor(file(fsPath), FOLDER), fsPath).toBeUndefined();
    }
    expect(
      decorationFor({ scheme: 'mnema-decision', fsPath: join(FOLDER, '.mnema') }, FOLDER),
    ).toBeUndefined();
  });
});
