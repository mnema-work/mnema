// @reads-the-tree
/**
 * A CHANGE'S CHANGELOG ENTRY IS ITS OWN FILE under `changelog/unreleased/`, not a bullet in the one
 * shared `CHANGELOG.md`, where every pull request wrote at the same line and so collided.
 *
 * What is held here: each file there has a section the release knows on its first line and a
 * non-empty entry after it, and the `Unreleased` section of `CHANGELOG.md` stays empty between
 * releases (an entry written there is one `release:prepare` would not gather, and it would reach
 * the release by a path the files do not guard). The gathering itself is held, on a fixture, by
 * `the-release-prepare-writes-every-number.test.ts`.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const DIR = join(ROOT, 'changelog/unreleased');
const SECTIONS = ['Added', 'Changed', 'Deprecated', 'Removed', 'Fixed', 'Security'];

/** Why a file's text is not an entry, or `undefined` when it is one. */
function whyNotAnEntry(text: string): string | undefined {
  const [first = '', ...rest] = text.split('\n');
  if (!SECTIONS.includes(first.trim())) return `its first line "${first}" is not a section`;
  if (rest.join('\n').trim() === '') return 'its entry is empty';
  return undefined;
}

describe('the changelog entries are files', () => {
  it('has a known section and an entry in every file of changelog/unreleased', () => {
    const files = readdirSync(DIR).filter((name) => name !== '.gitkeep');
    const wrong = files
      .map((name) => ({ name, why: whyNotAnEntry(readFileSync(join(DIR, name), 'utf-8')) }))
      .filter(({ why }) => why !== undefined)
      .map(({ name, why }) => `${name}: ${why}`);
    expect(wrong).toEqual([]);
    expect(files.filter((name) => !name.endsWith('.md'))).toEqual([]);
  });

  it('tells an unknown section and an empty entry from an entry', () => {
    expect(whyNotAnEntry('Added\n\n- A thing.\n')).toBeUndefined();
    expect(whyNotAnEntry('Improved\n\n- A thing.\n')).toContain('not a section');
    expect(whyNotAnEntry('Added\n\n')).toBe('its entry is empty');
  });

  it('keeps Unreleased in CHANGELOG.md empty', () => {
    const log = readFileSync(join(ROOT, 'CHANGELOG.md'), 'utf-8');
    const at = log.indexOf('## [Unreleased]\n');
    expect(at).toBeGreaterThan(-1);
    const rest = log.slice(at + 1);
    const end = rest.search(/^## \[/m);
    expect(rest.slice(0, end).split('\n').slice(1).join('\n').trim()).toBe('');
  });
});
