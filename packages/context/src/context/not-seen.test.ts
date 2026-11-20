import { decisionSeen, decisionTransitioned } from '@mnema/chain';
import { describe, expect, it } from 'vitest';
import {
  type Bench,
  birthDecision,
  cloneOf,
  makeBench,
  mergeTailInto,
  supersedeDecision,
} from '../../tests/support/chain.js';
import { rulesNotSeenBy } from './not-seen.js';

/** Accepts a proposed decision, by whoever `actor` says, and answers the accept's entry hash. */
function accept(
  b: Bench,
  id: string,
  actor: { readonly who?: string; readonly which?: string } = {},
): string {
  const entry = b.writer.append(
    decisionTransitioned(
      {
        at: b.now(),
        who: actor.who ?? b.who,
        signerFp: b.writer.signerFingerprint,
        subject: id,
        ...(actor.which !== undefined ? { which: actor.which } : {}),
      },
      { from: 'proposed', to: 'accepted', action: 'accept', fields: { note: 'accepted' } },
    ),
  );
  return entry.link.hash;
}

/** Writes a showing of `id` covering `moves`, by whoever `actor` says. */
function show(
  b: Bench,
  id: string,
  moves: readonly string[],
  actor: { readonly who?: string; readonly which?: string } = {},
): void {
  b.writer.append(
    decisionSeen(
      {
        at: b.now(),
        who: actor.who ?? b.who,
        signerFp: b.writer.signerFingerprint,
        subject: id,
        ...(actor.which !== undefined ? { which: actor.which } : {}),
      },
      { moves },
    ),
  );
}

function listed(b: Bench, identity = b.who): string[] {
  const cache = b.cache();
  try {
    return rulesNotSeenBy([cache], identity).rules.map((rule) => rule.id);
  } finally {
    cache.close();
  }
}

describe('the rules in force a person did not accept themselves', () => {
  it('lists an accept an agent declared, and one no agent declared, alike', () => {
    const b = makeBench();
    birthDecision(b, 'by-agent', 'An agent accepted this');
    accept(b, 'by-agent', { which: 'claude' });
    birthDecision(b, 'undeclared', 'Nobody declared an agent on this');
    accept(b, 'undeclared');
    // Newest accept first.
    expect(listed(b)).toEqual(['undeclared', 'by-agent']);
  });

  it('leaves out what a showing of this identity, with no agent declared, covers', () => {
    const b = makeBench();
    birthDecision(b, 'seen', 'Shown at a terminal');
    show(b, 'seen', [accept(b, 'seen', { which: 'claude' })]);
    birthDecision(b, 'not-seen', 'Never shown');
    accept(b, 'not-seen', { which: 'claude' });
    expect(listed(b)).toEqual(['not-seen']);
  });

  it('keeps a rule whose showing was by another identity, or carried an agent', () => {
    const b = makeBench();
    birthDecision(b, 'other', 'Shown to somebody else');
    show(b, 'other', [accept(b, 'other')], { who: `mnid:${'e'.repeat(64)}` });
    birthDecision(b, 'agent', 'A showing an agent signed');
    show(b, 'agent', [accept(b, 'agent')], { which: 'claude' });
    expect(listed(b).sort()).toEqual(['agent', 'other']);
  });

  it('keeps a rule whose showing names an accept that is not one of its own', () => {
    const b = makeBench();
    birthDecision(b, 'one', 'One');
    const first = accept(b, 'one');
    birthDecision(b, 'two', 'Two');
    accept(b, 'two');
    show(b, 'two', [first]);
    expect(listed(b).sort()).toEqual(['one', 'two']);
  });

  it('brings a rule back when another machine accepted it too, unseen by the showing', () => {
    // Two machines accept one proposed decision without seeing each other: two accepts applied.
    const a = makeBench();
    birthDecision(a, 'shared', 'Accepted on two machines');
    const clone = cloneOf(a);
    const here = accept(a, 'shared');
    show(a, 'shared', [here]);
    expect(listed(a)).toEqual([]);
    accept(clone, 'shared', { which: 'codex' });
    mergeTailInto(a, clone);
    expect(listed(a)).toEqual(['shared']);
  });

  it('a showing that covers both accepts takes it off again', () => {
    const a = makeBench();
    birthDecision(a, 'shared', 'Accepted on two machines');
    const clone = cloneOf(a);
    const here = accept(a, 'shared');
    const there = accept(clone, 'shared', { which: 'codex' });
    mergeTailInto(a, clone);
    show(a, 'shared', [here, there]);
    expect(listed(a)).toEqual([]);
  });

  it('lists nothing that is not in force: proposed, rejected, superseded', () => {
    const b = makeBench();
    birthDecision(b, 'proposed', 'Still proposed');
    birthDecision(b, 'old', 'Replaced');
    accept(b, 'old', { which: 'claude' });
    birthDecision(b, 'new', 'The replacement');
    accept(b, 'new', { which: 'claude' });
    supersedeDecision(b, 'old', 'new');
    expect(listed(b)).toEqual(['new']);
  });

  it('says when this identity last marked a rule shown, and nothing before the first', () => {
    const b = makeBench();
    birthDecision(b, 'd', 'D');
    const hash = accept(b, 'd');
    const cache = b.cache();
    try {
      expect(rulesNotSeenBy([cache], b.who).lastShown).toBeUndefined();
    } finally {
      cache.close();
    }
    show(b, 'd', [hash]);
    show(b, 'd', [hash], { which: 'claude' });
    const after = b.cache();
    try {
      const read = rulesNotSeenBy([after], b.who);
      // The showing an agent signed is no review of this identity's.
      expect(read.lastShown).toBe('2026-01-01T00:00:02.000Z');
    } finally {
      after.close();
    }
  });
});
