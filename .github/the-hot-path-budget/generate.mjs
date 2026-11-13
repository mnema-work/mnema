/**
 * A RECORD OF A GIVEN SIZE, written by the product's own writer, in a sandbox.
 *
 * WHY THE PRODUCT WRITES IT. A hand-built file of lines would measure a record the product cannot
 * produce: every line here is signed and chained by the same functions `mnema decision` and
 * `mnema link` call, so the cost measured later is the cost of a record that exists.
 *
 * THE SHAPE, FIXED BY THE INDEX AND NEVER BY A RANDOM NUMBER, so two runs write the same record
 * up to the ids and the clock:
 * - every decision is recorded and accepted;
 * - one in five governs a directory (`src/area-<k>`), the proportion of the record the fix for
 *   the replaced-rule lookup was measured on (600 rules over 3,003 decisions), and the number of
 *   directories grows with the record (one per fifty decisions) so that a directory is governed by
 *   ten rules at every size: what grows between sizes is the record, not the rules a path meets;
 * - one in ten, the same ones that govern, replaces the decision recorded just before it, so
 *   describing a rule has a replaced decision to name.
 *
 * THE SMALL RECORD IS THE FIRST PART OF THE LARGE ONE, because the shape is a function of the index
 * alone: one record is written to the largest size and a copy is kept as it passes each smaller
 * one. That is what keeps the fixture to the time of the largest (writing is the slow part, about
 * fifty milliseconds a write) instead of the sum of all of them.
 *
 * IT NEVER TOUCHES THE REAL HOME. The home is a directory under the one it is given, passed to
 * every writer as the discovery environment, and a directory that is not under the machine's
 * temporary folder is refused: a sandbox is the only place a generator may write a record.
 */

import { cpSync, mkdirSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const COMMANDS = new URL('../../packages/code/dist/commands/', import.meta.url);

/** How many decisions one directory's rules come from: one in five decisions governs, ten rules per directory. */
export const DECISIONS_PER_DIRECTORY = 50;

/**
 * The directory that decision `index` governs, or `undefined` for one that governs nothing.
 *
 * @param {number} index
 * @returns {string | undefined}
 */
export function governedBy(index) {
  return index % 5 === 0 ? `src/area-${Math.floor(index / DECISIONS_PER_DIRECTORY)}` : undefined;
}

/**
 * The file an edit of the measurement names: in a directory that ten rules govern at every size
 * (every record has at least one).
 */
export const THE_FILE_TO_EDIT = 'src/area-0/module.ts';

/**
 * Writes a record of the largest of `sizes` decisions under `into` and keeps a copy of it, project
 * and home, as it passes each size: `<into>/<size>/repo` and `<into>/<size>/home`.
 *
 * @param {readonly number[]} sizes
 * @param {string} into A directory under the machine's temporary folder.
 * @returns {Promise<{ sizes: Record<number, { repo: string, home: string }>, file: string, writes: number }>}
 */
export async function generate(sizes, into) {
  const sandbox = realpathSync(tmpdir());
  mkdirSync(into, { recursive: true });
  const where = relative(sandbox, realpathSync(into));
  if (where === '' || where.startsWith('..') || where.split(sep)[0] === '..') {
    throw new Error(
      `refused: ${into} is not under ${sandbox}, and a record is only written in a sandbox`,
    );
  }
  const { runInit } = await import(new URL('init.js', COMMANDS).href);
  const { runDecision } = await import(new URL('decision.js', COMMANDS).href);
  const { runDecisionTransition } = await import(new URL('decision-transition.js', COMMANDS).href);
  const { runLink } = await import(new URL('link.js', COMMANDS).href);

  const wanted = [...sizes].sort((a, b) => a - b);
  const largest = wanted[wanted.length - 1] ?? 0;
  const repo = join(into, 'working', 'repo');
  const home = join(into, 'working', 'home');
  for (let k = 0; k < Math.ceil(largest / DECISIONS_PER_DIRECTORY); k += 1) {
    mkdirSync(join(repo, 'src', `area-${k}`), { recursive: true });
    writeFileSync(join(repo, 'src', `area-${k}`, 'module.ts'), `export const area = ${k};\n`);
  }
  const ctx = { cwd: repo, env: { home } };
  const founded = runInit(ctx);
  if ('refused' in founded) throw new Error(`init refused: ${JSON.stringify(founded.refused)}`);

  let writes = 0;
  /**
   * @param {any} result
   * @param {string} what
   * @returns {any}
   */
  const must = (result, what) => {
    if (!result.ok) throw new Error(`${what} refused: ${JSON.stringify(result)}`);
    writes += 1;
    return result;
  };
  /** @type {Record<number, { repo: string, home: string }>} */
  const kept = {};
  let previous;
  for (let i = 0; i < largest; i += 1) {
    const recorded = must(
      runDecision(ctx, {
        title: `Decision ${i}: the module in area ${i % 97} keeps its ${['cache', 'queue', 'parser', 'ledger', 'index'][i % 5]} in one place`,
        rationale: `The read of decision ${i} was weighed against the write, and the one place won because it is the one a reader finds.`,
        alternatives: `Two places, rejected in decision ${i} because a reader would have to find both.`,
      }),
      `decision ${i}`,
    );
    must(
      runDecisionTransition(ctx, {
        id: recorded.id,
        action: 'accept',
        proof: { note: `agreed for ${i}` },
      }),
      `accept ${i}`,
    );
    const address = governedBy(i);
    if (address !== undefined) {
      must(runLink(ctx, { subject: recorded.id, target: address, rel: 'governs' }), `link ${i}`);
      if (i % 10 === 0 && previous !== undefined) {
        must(
          runDecisionTransition(ctx, {
            id: previous,
            action: 'supersede',
            by: recorded.id,
            proof: { reason: `replaced by decision ${i}` },
          }),
          `supersede ${i}`,
        );
      }
    }
    previous = recorded.id;
    if (wanted.includes(i + 1)) {
      const copy = join(into, String(i + 1));
      cpSync(repo, join(copy, 'repo'), { recursive: true });
      cpSync(home, join(copy, 'home'), { recursive: true });
      kept[i + 1] = { repo: join(copy, 'repo'), home: join(copy, 'home') };
    }
  }
  return { sizes: kept, file: THE_FILE_TO_EDIT, writes };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const [sizes, into] = process.argv.slice(2);
  if (!/^[1-9][0-9]*(,[1-9][0-9]*)*$/.test(sizes ?? '') || into === undefined) {
    console.error(
      'usage: node generate.mjs <size[,size...]> <directory under the temporary folder>',
    );
    process.exit(2);
  }
  console.log(JSON.stringify(await generate(String(sizes).split(',').map(Number), into)));
}
