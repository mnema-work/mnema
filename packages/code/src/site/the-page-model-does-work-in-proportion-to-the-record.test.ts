/**
 * THE PAGE MODEL DOES WORK IN PROPORTION TO THE RECORD, NOT TO DECISIONS TIMES NOTES TIMES LINKS.
 *
 * `mnema site` of a record of 3,003 decisions took 230 s because each decision looked through every
 * note, every note through every link, and each recorded or accepted decision through every event.
 * The lookups are counted here: every read of a link edge's `subject` or `target`, and every read of a
 * field of an event, while `pageModel` runs over a record of N decisions, N notes and N links, and
 * again over four times that. The count per item of the record must stay under a constant that does
 * not grow with the record: the nested loop puts it at hundreds per item at the small size and four
 * times that at the large one.
 */

import {
  type CatalogEvent,
  decisionBirth,
  decisionTransitioned,
  knowledgeLinked,
  observationRecorded,
} from '@mnema/chain';
import { describe, expect, it, vi } from 'vitest';

const edgeReads = vi.hoisted(() => ({ count: 0 }));

vi.mock('@mnema/core', async (importOriginal) => {
  const core = await importOriginal<typeof import('@mnema/core')>();
  return {
    ...core,
    projectLinks: (events: readonly CatalogEvent[]) =>
      core.projectLinks(events).map(
        (edge) =>
          new Proxy(edge, {
            get(target, key, receiver) {
              if (key === 'subject' || key === 'target') edgeReads.count += 1;
              return Reflect.get(target, key, receiver);
            },
          }),
      ),
  };
});

const { pageModel } = await import('./model.js');

const ALICE = 'mnid:aaaaaaaaaaaaaaaa';
const FP = 'f'.repeat(64);

function at(n: number, subject: string) {
  const when = new Date(Date.UTC(2026, 0, 1) + n * 1000).toISOString();
  return { at: when, who: ALICE, signerFp: FP, subject };
}

/** N accepted decisions, each with a note about it and a note linked to it: 2N notes, N links. */
function record(n: number): CatalogEvent[] {
  const events: CatalogEvent[] = [];
  let clock = 0;
  const tick = () => {
    clock += 1;
    return clock;
  };
  for (let i = 0; i < n; i += 1) {
    const id = `d-${i}`;
    const [recorded, born] = decisionBirth(at(tick(), id), {
      title: `Decision ${i}`,
      rationale: `why ${i}`,
      adr: `ADR-${i}`,
      initial: 'proposed',
    });
    events.push(recorded as CatalogEvent, born as CatalogEvent);
    events.push(
      decisionTransitioned(at(tick(), id), {
        from: 'proposed',
        to: 'accepted',
        action: 'accept',
        fields: { note: 'agreed' },
      }),
      observationRecorded(at(tick(), `o-${i}`), { about: id, topic: 't', text: `note ${i}` }),
      observationRecorded(at(tick(), `l-${i}`), {
        about: 'a-task',
        topic: 't',
        text: 'loose',
      }),
      knowledgeLinked(at(tick(), `l-${i}`), { target: id, rel: 'relates-to' }),
    );
  }
  return events;
}

/** Reads of an edge's ends and of an event's fields that one `pageModel` call makes. */
function lookups(events: CatalogEvent[]): number {
  let eventReads = 0;
  const watched = events.map(
    (event) =>
      new Proxy(event, {
        get(target, key, receiver) {
          eventReads += 1;
          return Reflect.get(target, key, receiver);
        },
      }),
  );
  edgeReads.count = 0;
  const model = pageModel(watched);
  expect(model.decisions).toHaveLength(events.filter((e) => e.kind === 'decision.recorded').length);
  expect(model.decisions.every((d) => d.notes.length === 2)).toBe(true);
  return edgeReads.count + eventReads;
}

describe('the page model', () => {
  it('reads the record a constant number of times per item, at 50 decisions and at 200', () => {
    const small = record(50);
    const large = record(200);
    const perItemSmall = lookups(small) / small.length;
    const perItemLarge = lookups(large) / large.length;
    // Linear work is a few dozen reads per event at any size; the nested loop is hundreds at 50
    // decisions and four times that at 200.
    expect(perItemSmall).toBeLessThan(60);
    expect(perItemLarge).toBeLessThan(60);
    expect(perItemLarge).toBeLessThan(perItemSmall * 1.5);
  });
});
