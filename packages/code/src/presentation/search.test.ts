import type { RecordSearch } from '@mnema/context';
import { describe, expect, it } from 'vitest';
import { renderPlain } from './plain.js';
import { searchReport } from './search.js';

const hit = (n: number): RecordSearch['hits'][number] => ({
  id: `id-${n}`,
  kind: 'memory',
  scope: 'public',
  at: '2026-07-31T10:00:00.000Z',
  title: `hit ${n}`,
  derived: true,
});

describe('a search that the limit cut says how to reach the rest', () => {
  it('says how many matched and points at a window of dates, never at an offset', () => {
    const lines = searchReport(
      renderPlain,
      { hits: [hit(1), hit(2)], total: 543 },
      'parser',
    );
    expect(lines[0]).toBe('2 of 543 record(s) matching "parser":');
    expect(lines[1]).toBe(
      '543 matched and 2 are shown; to reach the rest, search a window of dates with --from <iso> and --to <iso>.',
    );
    expect(lines.join('\n')).not.toContain('--offset');
  });

  it('says nothing of the kind when everything that matched is shown', () => {
    const lines = searchReport(renderPlain, { hits: [hit(1), hit(2)], total: 2 }, 'parser');
    expect(lines[0]).toBe('2 record(s) matching "parser":');
    expect(lines.join('\n')).not.toContain('--from');
  });
});
