/**
 * THE PUBLISHED DECLARATIONS ONLY WIDEN IN SHAPE AND ONLY NARROW IN LEGALITY, against the last
 * release.
 *
 * `event-schema.json` is the artifact a stranger's reader is built from, and `@mnema/chain` ships
 * it. Two promises hang on how it changes between releases, and a hand edit of the table in
 * `schema.ts` can break either in silence, because `event-schema.test.ts` only holds the file to
 * the table of the SAME commit:
 *
 *   - SHAPE WIDENS. Every record the last release wrote must still be read by this one, so a
 *     contract the release declared is still declared, every field of it is still declared with
 *     the same rule or a looser one (a field never turns from optional to required, and a rule is
 *     not reworded), and a field added to an existing contract is optional. A new kind is a new
 *     contract and widens nothing.
 *   - LEGALITY NARROWS. A record this release writes must still be applied by the last release's
 *     reader, so a move a workflow allows now was allowed then, to the same state, naming the same
 *     `by`, and asking for every field it asked for (it may ask for more). A move may be taken
 *     away. A workflow of a new kind is new and narrows nothing.
 *
 * The last release is committed beside this file, byte for byte as `npm pack @mnema/chain@0.1.9`
 * delivers it, so the guard reads offline. Each release moves it: replace the file with the one
 * the new release ships and rename it for that version, in the release's own pull request. A
 * change that is really a break goes to a new `v` of the kind or to a new kind, which this guard
 * does not stand in the way of.
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import type { PublishedSchema } from './schema.js';
import { SCHEMA_FILE } from './schema.js';

const LAST_RELEASE = new URL(
  '../../tests/published-schema/event-schema.0.1.9.json',
  import.meta.url,
);

const published = JSON.parse(readFileSync(LAST_RELEASE, 'utf-8')) as PublishedSchema;
const current = JSON.parse(readFileSync(SCHEMA_FILE, 'utf-8')) as PublishedSchema;

type Move = {
  readonly from: string;
  readonly action: string;
  readonly to: string;
  readonly requires: readonly string[];
  readonly by?: boolean;
};
type Flow = {
  readonly states: readonly string[];
  readonly birth: unknown;
  readonly moves: readonly Move[];
};
const flows = (schema: PublishedSchema) =>
  schema.workflows as unknown as { readonly [kind: string]: Flow };

/** What a field's rule accepts is no narrower than what it accepted: the same rule, or its optional spelling. */
function acceptsAtLeast(was: string, now: string): boolean {
  return now === was || now === `${was}?`;
}

/** The problems a change of a table has against the one before it, as sentences; empty when it only widens/narrows rightly. */
function whatBreaks(last: PublishedSchema, now: PublishedSchema): string[] {
  const problems: string[] = [];
  const fieldsOf = (where: string, was: Record<string, string>, is: Record<string, string>) => {
    for (const [field, rule] of Object.entries(was)) {
      const nowRule = is[field];
      if (nowRule === undefined) {
        problems.push(`${where}: the field ${field} is no longer declared`);
      } else if (!acceptsAtLeast(rule, nowRule)) {
        problems.push(`${where}: ${field} was ${rule} and is ${nowRule}`);
      }
    }
    for (const [field, rule] of Object.entries(is)) {
      if (was[field] === undefined && !rule.endsWith('?')) {
        problems.push(`${where}: the new field ${field} is ${rule}, not optional`);
      }
    }
  };

  for (const [rule, text] of Object.entries(last.rules)) {
    if (now.rules[rule] !== text) problems.push(`rules: the meaning of ${rule} changed`);
  }
  fieldsOf('envelope', last.envelope, now.envelope);
  fieldsOf('transitionFields', last.transitionFields, now.transitionFields);
  for (const was of last.contracts) {
    const is = now.contracts.find((row) => row.kind === was.kind && row.v === was.v);
    if (is === undefined) {
      problems.push(`${was.kind} v${was.v}: the contract is no longer declared`);
    } else {
      fieldsOf(`${was.kind} v${was.v}`, was.payload, is.payload);
    }
  }

  const before = flows(last);
  for (const [kind, flow] of Object.entries(flows(now))) {
    const was = before[kind];
    if (was === undefined) continue;
    if (JSON.stringify(flow.birth) !== JSON.stringify(was.birth)) {
      problems.push(`${kind}: the birth changed`);
    }
    for (const state of flow.states) {
      if (!was.states.includes(state)) problems.push(`${kind}: the state ${state} is new`);
    }
    for (const move of flow.moves) {
      const old = was.moves.find((m) => m.from === move.from && m.action === move.action);
      const name = `${kind}: ${move.from} ${move.action}`;
      if (old === undefined) {
        problems.push(`${name} is a move the last release did not allow`);
        continue;
      }
      if (old.to !== move.to) problems.push(`${name} went to ${old.to} and now goes to ${move.to}`);
      if ((old.by ?? false) !== (move.by ?? false)) problems.push(`${name} changed what it says of by`);
      for (const needed of old.requires) {
        if (!move.requires.includes(needed)) {
          problems.push(`${name} no longer requires ${needed}`);
        }
      }
    }
  }
  return problems;
}

describe('the published declarations against the last release', () => {
  it('only widen in shape and only narrow in legality', () => {
    expect(whatBreaks(published, current)).toEqual([]);
  });

  it('say so on the changes it exists for (the guard is not blind)', () => {
    const copy = (): PublishedSchema => JSON.parse(JSON.stringify(current)) as PublishedSchema;

    const dropped = copy();
    const first = dropped.contracts[0];
    expect(first).toBeDefined();
    const field = Object.keys(first?.payload ?? {})[0] ?? '';
    delete (first?.payload as Record<string, string>)[field];
    expect(whatBreaks(published, dropped).join('\n')).toContain('is no longer declared');

    const required = copy();
    const target = required.contracts.find((row) =>
      Object.values(row.payload).some((rule) => rule.endsWith('?')),
    );
    const optional = Object.entries(target?.payload ?? {}).find(([, rule]) => rule.endsWith('?'));
    (target?.payload as Record<string, string>)[optional?.[0] ?? ''] = (optional?.[1] ?? '').slice(0, -1);
    expect(whatBreaks(published, required).join('\n')).toMatch(/was .*\? and is /);

    const newMove = copy();
    const flow = flows(newMove)['task.transitioned'];
    (flow?.moves as Move[]).push({ from: 'DONE', action: 'cancel', to: 'CANCELED', requires: [] });
    expect(whatBreaks(published, newMove).join('\n')).toContain('a move the last release did not allow');

    const looser = copy();
    const move = flows(looser)['decision.transitioned']?.moves.find((m) => m.action === 'accept');
    (move?.requires as string[]).length = 0;
    expect(whatBreaks(published, looser).join('\n')).toContain('no longer requires note');
  });
});
