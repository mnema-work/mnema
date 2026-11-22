/**
 * THE PARAGRAPHS OF `mnema status` THAT WERE RAW STRINGS FOLD LIKE THE OTHER SECTIONS. The two
 * paragraphs under the headings for events not yet committed and for what a pull kept aside were
 * written into the report as a literal two-space indent and a sentence, so they never passed
 * through the renderer that folds, and a terminal cut them in the middle of a word ("an ho" /
 * "ur ago"). They go through `render(fact(...))` now, the same path the sections beside them take.
 *
 * TWO HALVES, and the second is the promise that may not move: on a terminal the paragraph is
 * folded at a space with its continuation indented; in a pipe (the plain renderer) the report is
 * the bytes it always was.
 */
import type { Bootstrap } from '@mnema/context';
import { describe, expect, it } from 'vitest';
import { saysEventsNotInGit } from '../src/events-not-in-git.js';
import { saysForkKeptAside } from '../src/fork-kept-aside.js';
import { foldedAt } from '../src/presentation/folded.js';
import type { Line } from '../src/presentation/line.js';
import { renderPlain } from '../src/presentation/plain.js';
import { statusReport } from '../src/presentation/status.js';

const opening = {
  resume: { lastRun: null },
  work: [],
  workTotal: 0,
  skills: [],
  decisions: [],
  decisionsTotal: 0,
  awaitingJudgement: [],
  awaitingJudgementTotal: 0,
} as unknown as Bootstrap;

const NOT_IN_GIT = {
  events: 12,
  tails: 2,
  oldestAt: '2026-11-20T10:00:00.000Z',
  oldestHours: 50,
  old: true,
  defaultBranch: 'origin/main',
  commitsSinceRecordCommit: 3,
  pullDue: 1,
};
const KEPT_ASIDE = { stashes: 1, conflicted: 2 };

const reportWith = (render: (line: Line) => string): string[] =>
  statusReport(render, opening, 'actor', [], [], [], false, NOT_IN_GIT, KEPT_ASIDE);

const NARROW = 40;

describe('the paragraphs of status that were raw strings', () => {
  it('are the same bytes in a pipe as they were: two spaces and the sentence', () => {
    const lines = reportWith(renderPlain);
    expect(lines).toContain('Not in git yet:');
    expect(lines).toContain(`  ${saysEventsNotInGit(NOT_IN_GIT)}`);
    expect(lines).toContain('Kept aside by a pull:');
    expect(lines).toContain(`  ${saysForkKeptAside(KEPT_ASIDE)}`);
  });

  it('fold at a space on a narrow terminal, with the continuation indented', () => {
    const lines = reportWith(foldedAt(NARROW, renderPlain));
    for (const [heading, sentence] of [
      ['Not in git yet:', saysEventsNotInGit(NOT_IN_GIT)],
      ['Kept aside by a pull:', saysForkKeptAside(KEPT_ASIDE)],
    ] as const) {
      const at = lines.indexOf(heading);
      expect(at, `${heading} is not in the report`).toBeGreaterThan(-1);
      const paragraph = (lines[at + 1] as string).split('\n');
      // THE SENTENCE IS LONGER THAN THE TERMINAL, so a fold is what this asks for: a fixture
      // that fit would pass the checks below saying nothing.
      expect([...sentence].length, `${heading}: the fixture fits the terminal`).toBeGreaterThan(
        NARROW,
      );
      expect(paragraph.length, `${heading} was not folded`).toBeGreaterThan(1);
      for (const row of paragraph) {
        expect(
          [...row].length,
          `a row of ${heading} is wider than the terminal`,
        ).toBeLessThanOrEqual(NARROW);
        expect(row.startsWith('  '), `a row of ${heading} is not indented`).toBe(true);
      }
      // NO WORD IS CUT: the words of the folded rows are the words of the sentence.
      expect(paragraph.join(' ').split(/\s+/).filter(Boolean)).toEqual(
        sentence.split(/\s+/).filter(Boolean),
      );
    }
  });
});
