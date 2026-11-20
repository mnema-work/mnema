/**
 * The lines `mnema` prints when it is typed with nothing after it: what the product does in a
 * sentence (the promise, verbatim), where this project stands, what is off and the verb that turns
 * it on, three verbs to go on with, and where the rest is.
 *
 * Outside a project the state lines are not there and the first verb founds one.
 */

import type { Summary } from '../commands/summary.js';
import { oneLine } from '../one-line.js';
import { PRODUCT_PROMISE } from '../promise.js';
import { SWITCH_ON_COMMAND } from '../record-framing.js';
import { acceptedByWords } from './reviewed.js';

/** The summary, one string per line. */
export function summaryLines(summary: Summary): string[] {
  // What was left out of what is counted comes first, as it does on every other surface.
  const lines = [...(summary.left ?? []), PRODUCT_PROMISE];
  const unread = summary.unread ?? [];
  if (unread.length > 0) {
    const record = unread.includes('record');
    const switches = unread.includes('switches');
    if (record && switches) {
      lines.push(
        'The record and the switches here could not be read, so nothing is said of where the project stands or what is off: `mnema verify` says why.',
      );
    } else if (record) {
      lines.push(
        'The record here could not be read, so nothing is said of where the project stands: `mnema verify` says why.',
      );
    } else {
      lines.push(
        'The switches here could not be read, so nothing is said of what is off: `mnema verify` says why.',
      );
    }
  }
  if (summary.founded) {
    lines.push('A mnema project is founded here.');
    if (summary.waiting !== undefined && summary.waiting > 0) {
      lines.push(
        `${summary.waiting} decision(s) await a judgement: \`mnema decision review\` goes through them.`,
      );
    }
    if (summary.notSeen !== undefined) lines.push(...notSeenLines(summary.notSeen));
  }
  if (summary.off.length > 0) {
    lines.push(
      `Off on this machine: ${summary.off.join(', ')}. Turn one on with \`${SWITCH_ON_COMMAND}\`.`,
    );
  }
  lines.push(
    'Next:',
    summary.founded
      ? '  `mnema status`                                where things stand'
      : unread.includes('record')
        ? '  `mnema verify`                                say why the record cannot be read'
        : '  `mnema init`                                  found a project in this directory',
    '  `mnema decision record <title> <rationale>`   record a choice that was settled',
    '  `mnema switch`                                what is on and what is off',
    '`mnema --help` lists every command.',
  );
  return lines;
}

/**
 * The rules in force you did not accept yourself (ADR-623): those that entered force since your
 * last review, one line each, and the older total in one line. Before the first review only the
 * total is said, since a list of every rule ever accepted by an agent is noise, not news.
 */
function notSeenLines(notSeen: NonNullable<Summary['notSeen']>): string[] {
  const review = '`mnema decision review` shows each one and marks it shown.';
  const total = notSeen.since.length + notSeen.older;
  if (total === 0) return [];
  if (notSeen.lastShown === undefined) {
    return [
      `${total} rule(s) in force you did not accept yourself, none shown to you yet: ${review}`,
    ];
  }
  const lines: string[] = [];
  if (notSeen.since.length > 0) {
    lines.push(
      `${notSeen.since.length} rule(s) in force you did not accept yourself entered since your last review or accept at a terminal (${notSeen.lastShown.slice(0, 10)}):`,
    );
    for (const rule of notSeen.since) {
      lines.push(`  ${rule.adr}  ${oneLine(rule.title)} (${acceptedByWords(rule.accepted)})`);
    }
  }
  lines.push(
    notSeen.older > 0
      ? `${notSeen.older} older rule(s) in force you did not accept yourself have not been shown to you. ${review}`
      : review,
  );
  return lines;
}
