/**
 * The `mnema prove` wiring: what it declares, and what it prints.
 *
 * `mnema prove <decision>` writes the proof of one decision (FORMAT.md section 9) to standard
 * output, or to `--out <file>`, and says on the other stream what it holds. `mnema prove --check
 * <file>` checks one, from the file alone, and says what it proves AND what it does not: the
 * second list is printed beside every proof accepted, because a proof that verifies is read as
 * more than it is. The words of that list are the chain's (`WHAT_A_PROOF_DOES_NOT_COVER`, handed
 * over by the command), so this surface cannot promise more than the checker does.
 */

import type { ProofManifest } from '@mnema/chain';
import type { Command } from 'commander';
import type { ProveDone, ProveRefused } from '../commands/prove.js';
import { fact } from '../presentation/detail.js';
import { here } from './context.js';
import { noSuchRecord } from './no-such-record.js';
import { onOneLine } from './on-one-line.js';
import { NO_PROJECT, reportRefusal, reportUsage } from './report.js';
import { type Declared, readsTheRecord, type Wiring } from './verb.js';

/** The decision a manifest is about, on one line: its label, its id and its title. */
function headline(manifest: ProofManifest): string {
  return `${manifest.adr} ${manifest.decision}: ${JSON.stringify(manifest.title)}`;
}

/** The state and the moves that reached it, each with its writer's clock and its identity. */
function movesSaid(manifest: ProofManifest): [string, number][] {
  return [
    [`state: ${manifest.state ?? 'none'}, after ${manifest.moves.length} move(s)`, 1],
    ...manifest.moves.map((move): [string, number] => [
      `${move.action} ${move.from ?? 'null'} -> ${move.to}${move.by === undefined ? '' : ` by ${move.by}`}, ` +
        `${move.at} by ${move.who}${move.which === undefined ? '' : ` (${move.which})`}, ${move.tail.slice(0, 12)} seq ${move.seq}`,
      2,
    ]),
    [`record: ${manifest.record ?? 'not named by any carried artifact'}`, 1],
  ];
}

/** The sentence each refusal of `mnema prove <decision>` is said with. */
function refusalWords(result: Exclude<ProveDone | ProveRefused, ProveDone>): string {
  switch (result.reason) {
    case 'NO_PROJECT':
      return NO_PROJECT;
    case 'NO_SUCH_DECISION':
      return noSuchRecord('decision', result.typed);
    case 'AMBIGUOUS_LABEL':
      return result.message;
    case 'PRIVATE_DECISION':
      return (
        onOneLine`${result.id} is in this machine's private tree, which no clone carries, and a proof hands ` +
        'its lines to whoever receives the file. Ask with --private to prove it.'
      );
    case 'RECORD_BROKEN':
      return `The ${result.scope} tree does not verify, so no proof is built from it: mnema verify says where.`;
    case 'NOT_YET_SIGNED':
      return (
        onOneLine`Not yet signed: seq ${result.seq} of the tail ${result.tail} is above its last ` +
        'checkpoint, so no signature covers it yet.'
      );
    case 'NO_TAIL_PROOF':
      return onOneLine`The tail ${result.tail} holds no tail proof that reads, so nothing signs whose tail it is.`;
    case 'READS_OTHERWISE':
      return (
        'The lines a proof would carry read this decision otherwise than the whole record does: a ' +
        'move or a writing the record places by a citation of a line the proof does not carry.'
      );
  }
}

/** Registers `mnema prove` on the program. */
export function registerProve(program: Command, wiring: Wiring): Declared {
  const { io, render } = wiring;
  // Every value printed here came out of a record or out of a file somebody handed over, so each
  // line is made one line before it is printed: a title holding a line feed is not a second line.
  const say = (to: 'out' | 'err', text: string, depth = 1) =>
    io[to](render(fact(onOneLine`${text}`, depth)));
  const proved = program
    .command('prove')
    .description('write the proof of one decision a stranger checks offline, or check one')
    .argument('[decision]', 'the decision: its id or its ADR label')
    .option(
      '--out <file>',
      'write the proof to this file (refused when it exists) instead of standard output',
    )
    .option(
      '--private',
      "prove a decision of this machine's private tree, which no clone carries",
      false,
    )
    .option(
      '--check <file>',
      'check a proof from the file alone, and say what it proves and what it does not',
    )
    .action(
      async (
        decision: string | undefined,
        opts: { out?: string; private: boolean; check?: string },
      ) => {
        const { runProve, runProveCheck, writeProofFile } = await import('../commands/prove.js');
        if (opts.check !== undefined) {
          if (decision !== undefined || opts.out !== undefined || opts.private) {
            reportUsage(wiring, '--check takes a file and nothing else.');
            return;
          }
          const checked = runProveCheck(opts.check);
          if (!checked.ok) {
            reportRefusal(wiring, { reason: checked.reason, message: checked.message });
            return;
          }
          const { verdict } = checked;
          if (!verdict.proven) {
            reportRefusal(wiring, { reason: 'PROOF_REFUSED', message: verdict.refusal });
            return;
          }
          say('out', `proven: ${headline(verdict.manifest)}`, 0);
          for (const [line, depth] of movesSaid(verdict.manifest)) say('out', line, depth);
          for (const { tail, ranges } of verdict.covers) {
            const spans = ranges.map(([from, to]) => (from === to ? `${from}` : `${from}..${to}`));
            say('out', `carries ${tail}, seq ${spans.join(', ')}, each range signed`);
          }
          say('out', `keys: ${verdict.keys.join(', ')}`);
          say('out', 'what it does not prove:', 0);
          for (const line of checked.notCovered) say('out', line);
          return;
        }
        if (decision === undefined) {
          reportUsage(wiring, 'Name a decision to prove, or give --check <file>.');
          return;
        }
        const result = runProve(here(), { decision, private: opts.private });
        if (!result.ok) {
          reportRefusal(wiring, result, { [result.reason]: refusalWords(result) });
          return;
        }
        // The file goes where it was asked to; what it holds is said on the other stream, so a
        // proof piped to a file or a host receives the proof and nothing else.
        const told = opts.out === undefined ? 'err' : 'out';
        if (opts.out === undefined) {
          io.out(result.text.slice(0, -1));
        } else {
          const written = writeProofFile(opts.out, result.text);
          if (!written.ok) {
            reportRefusal(wiring, written);
            return;
          }
        }
        say(told, `proof of ${headline(result.manifest)}`, 0);
        for (const [line, depth] of movesSaid(result.manifest)) say(told, line, depth);
        say(told, `from the ${result.scope} tree, checked by this mnema before it was handed over`);
        if (opts.out !== undefined) {
          say(told, `written to ${opts.out}; check it with mnema prove --check ${opts.out}`);
        }
      },
    );
  return readsTheRecord(proved);
}
