// @plants-damage
/**
 * `mnema why <path>` says what the write gate says when the RECORD ITSELF refuses the write: an entry
 * altered after it was written, or a line this mnema cannot read. The verdict is `refuse`, with the
 * gate's own reason (`refusal` in `--json`), whatever the rules at the path say, and no rule decides.
 * The gate (`before-a-write`) is asked in the same record, and the reason `why` gives is the one the
 * gate hands over. Each case runs warm, cold and with a session open before the damage, and the three
 * answer alike.
 */

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  inEveryCacheState,
  type Planted,
  type TheCase,
} from './support/every-cache-state.js';
import { runMerged } from './support/merged-streams.js';

const mnema = (planted: Planted, args: string[], input?: string) =>
  runMerged(args, {
    cwd: planted.repo,
    input,
    timeout: 60_000,
    env: { PATH: process.env.PATH ?? '', HOME: planted.home, GIT_CONFIG_NOSYSTEM: '1' },
  });

const PATH = 'src/governed/a.ts';

function aRecord(dir: string): Planted {
  const planted = { repo: join(dir, 'repo'), home: join(dir, 'home') };
  for (const path of [planted.repo, planted.home, join(planted.repo, 'src', 'governed')]) {
    mkdirSync(path, { recursive: true });
  }
  expect(mnema(planted, ['init', '--yes', '--hosts', 'none']).status).toBe(0);
  const recorded = mnema(planted, ['decision', 'record', 'The batch posts the ledger', 'Why not']);
  const id = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/.exec(
    recorded.stdout,
  )?.[1] as string;
  expect(mnema(planted, ['decision', 'move', 'accept', id, '--note', 'agreed']).status).toBe(0);
  expect(mnema(planted, ['link', id, 'src/governed', '--rel', 'governs']).status).toBe(0);
  return planted;
}

function segmentOf(planted: Planted): string {
  const tails = join(planted.repo, '.mnema', 'tails');
  return join(tails, readdirSync(tails)[0] as string, '000001.jsonl');
}

function judged(damage: (text: string) => string): TheCase<Planted> {
  return {
    found: aRecord,
    damage(planted) {
      const file = segmentOf(planted);
      const held = readFileSync(file, 'utf-8');
      expect(damage(held)).not.toBe(held);
      writeFileSync(file, damage(held));
    },
    run(planted, ctx) {
      ctx.forget(planted.repo);
      const why = mnema(planted, ['why', PATH, '--json']);
      ctx.forget(planted.repo);
      const payload = JSON.stringify({
        tool_name: 'Write',
        tool_input: { file_path: join(planted.repo, PATH), content: 'a' },
        session_id: 's1',
        cwd: planted.repo,
      });
      const gate = mnema(planted, ['before-a-write', '--host', 'cursor'], payload);
      return {
        status: why.status,
        stdout: `@@@ why\n${why.stdout}\n@@@ gate\n${gate.stdout}`,
        stderr: '',
      };
    },
  };
}

const CASES: readonly (readonly [string, (text: string) => string, string])[] = [
  ['an entry altered after it was written', (t) => t.replace('The batch posts', 'The hand posts'), 'altered'],
  ['a line this mnema cannot read', (t) => `<<<<<<< HEAD${t.slice(12)}`, 'cannot be read'],
];

describe('mnema why, when the record refuses the write', () => {
  for (const [name, damage, word] of CASES) {
    it(`says refuse, with the gate's reason, for ${name}, in every cache state`, () => {
      const seen = inEveryCacheState(judged(damage));
      for (const state of [seen.warm, seen.cold, seen.session]) {
        const [whyPart, gatePart] = state.said.replace('@@@ why\n', '').split('\n@@@ gate\n');
        const why = JSON.parse((whyPart as string).slice((whyPart as string).indexOf('{\n')));
        expect(state.status, state.state).toBe(0);
        expect(why.verdict, state.state).toBe('refuse');
        expect(why.refusal, state.state).toContain(word);
        expect(
          why.rules.some((rule: { decided: boolean }) => rule.decided),
          state.state,
        ).toBe(false);
        // The gate in the same record denies, with the reason `why` gave.
        expect(gatePart, state.state).toContain('deny');
        expect(gatePart, state.state).toContain(JSON.stringify(why.refusal).slice(1, -1).split('\\n\\n')[0]);
      }
      expect(seen.warm.said).toBe(seen.cold.said);
      expect(seen.session.said).toBe(seen.cold.said);
    }, 240_000);
  }
});
