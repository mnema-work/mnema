import { describe, expect, it } from 'vitest';
import type { DecisionProjection } from '../projections/decision.js';
import { madrOf } from './madr.js';
import { readAdr } from './read.js';

const BASE: DecisionProjection = {
  id: '01a18004-3879-7000-9381-b4ce235e3c7f',
  adr: 'ADR-97',
  title: 'Use SQLite for the cache',
  rationale: 'It is in the standard library.\n\nNo second dependency to audit.',
  alternatives: 'Postgres: a server to run.\nFlat files: no index.',
  state: 'accepted',
  createdAt: '2026-10-28T00:58:56.240Z',
  updatedAt: '2026-10-28T00:58:56.240Z',
};

describe('madrOf', () => {
  it('says in the file that it is derived from the record, and names the decision', () => {
    const { text } = madrOf(BASE);
    expect(text).toContain('mnema-decision: 01a18004-3879-7000-9381-b4ce235e3c7f');
    expect(text).toContain('not the source of truth');
    expect(text).toContain('status: accepted');
    expect(text).toContain('date: 2026-10-28');
  });

  it('reads back as the same title, rationale and alternatives', () => {
    const made = madrOf(BASE);
    expect(made.faithful).toBe(true);
    expect(readAdr(made.text)).toMatchObject({
      ok: true,
      title: 'Use SQLite for the cache',
      rationale: 'It is in the standard library.\n\nNo second dependency to audit.',
      alternatives: 'Postgres: a server to run.\nFlat files: no index.',
    });
  });

  it('writes a superseded decision with its status and the link, by label', () => {
    const made = madrOf(
      {
        ...BASE,
        state: 'superseded',
        supersededBy: 'new-id',
        supersedes: 'older-id',
      },
      (id) => (id === 'new-id' ? 'ADR-120' : id === 'older-id' ? 'ADR-3' : id),
    );
    expect(made.text).toContain('status: superseded by ADR-120');
    expect(made.text).toContain('superseded-by: ADR-120');
    expect(made.text).toContain('supersedes: ADR-3');
    // The reader sees the status as retired.
    expect(readAdr(made.text)).toMatchObject({ ok: true, status: 'superseded by ADR-120' });
  });

  it('names the decisions a link points at by their ids when it is given no way to label them', () => {
    const made = madrOf({
      ...BASE,
      state: 'superseded',
      supersededBy: 'new-id',
      supersedes: 'older-id',
    });
    expect(made.text).toContain('status: superseded by new-id');
    expect(made.text).toContain('superseded-by: new-id');
    expect(made.text).toContain('supersedes: older-id');
  });

  it('leaves the alternatives section out when the decision has none', () => {
    const { alternatives: _gone, ...bare } = BASE;
    const made = madrOf(bare);
    expect(made.text).not.toContain('Alternatives Considered');
    expect(made.faithful).toBe(true);
  });

  it('says so when a rationale holds a heading line the reader would cut', () => {
    const made = madrOf({ ...BASE, rationale: 'First part.\n\n## A heading\n\nsecond part' });
    expect(made.faithful).toBe(false);
  });
});
