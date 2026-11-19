// @reads-the-tree
/**
 * A CLAIMED ISSUE IS ASSIGNED, AND FREED AFTER 14 DAYS WITHOUT A PULL REQUEST: a contributor's comment
 * claiming an open `good first issue` or `help wanted` issue assigns it when nobody holds it and the
 * commenter holds fewer than 3 that way, a maintainer's claim assigns nothing, and a daily run frees an
 * assignment the workflow made once 14 days passed with no open pull request of the assignee that names
 * the issue, leaving an assignment made by hand alone.
 *
 * `.github/assign-a-claimed-issue/claim.mjs` keeps each decision in a pure function, so these cases hand
 * it comments, issues and pull requests the case makes up, and a stand-in for GitHub that records what
 * would be written. The last cases read the workflow and hold the lines that keep a stranger's comment
 * from running anything: the token's permissions, no expression of the event in a shell line and no
 * checkout of a pull request.
 *
 * It also holds the wider rules: more claim phrases (the comment that went unanswered on a real issue
 * among them), one reply on how to claim for a comment that reads as a claim and matches no phrase, the
 * author of a pull request that closes a free issue assigned to it, the 14 days applied to a hand
 * assignment of an outside contributor, and the reminder at 7 days and the note at 14 on an outside pull
 * request that waits on its author, which only comments.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  adopt,
  assignedMarker,
  assignmentOf,
  CLAIM_PHRASES,
  claim,
  closedBy,
  decide,
  expire,
  expiry,
  fixtureApi,
  freedMarker,
  isClaim,
  namesIssue,
  readsAsAClaim,
  remind,
  waitingSince,
} from '../../../.github/assign-a-claimed-issue/claim.mjs';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const NOW = new Date('2026-12-01T12:00:00Z');
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000);
const BOT = 'github-actions[bot]';
const REPO = 'mnema-work/mnema';

const open = {
  state: 'open',
  labels: ['good first issue'],
  assignees: [] as string[],
  isPullRequest: false,
};
const person = { login: 'newcomer', association: 'NONE', body: "I'll take this" };

describe('a claim is read from the words', () => {
  it.each(CLAIM_PHRASES)('%s claims', (phrase) => {
    expect(isClaim(phrase)).toBe(true);
    expect(isClaim(`Hello! ${phrase.toUpperCase()}, thanks.`)).toBe(true);
  });

  it('reads the variants a person writes', () => {
    expect(isClaim('I’d like to take this issue!')).toBe(true);
    expect(isClaim('Hi, can I work on this issue?')).toBe(true);
    expect(isClaim('/take')).toBe(true);
  });

  it.each([
    'How do I run the tests for this?',
    'Is this still open?',
    'I tried it and the build fails on Node 26.',
    "I don't want to work on this",
    'Someone else will take this one, probably',
    '> I will take this\n\nThat was quoted, not said.',
    'Please do not /takeover the build',
  ])('does not take %j for a claim', (text) => {
    expect(isClaim(text)).toBe(false);
  });
});

describe('what is done with a comment', () => {
  it('assigns a contributor who claims a free issue', () => {
    expect(decide({ issue: open, comment: person, held: 0 }).action).toBe('assign');
  });

  it('opens to help wanted as well', () => {
    expect(
      decide({ issue: { ...open, labels: ['Help Wanted'] }, comment: person, held: 2 }).action,
    ).toBe('assign');
  });

  it.each(['OWNER', 'MEMBER', 'COLLABORATOR'])('assigns nothing to a %s', (association) => {
    expect(decide({ issue: open, comment: { ...person, association }, held: 0 }).action).toBe(
      'ignore',
    );
  });

  it('assigns nothing to a bot, a closed issue, a pull request or an issue with no such label', () => {
    const ask = (issue: object, comment: object) =>
      decide({ issue: { ...open, ...issue }, comment: { ...person, ...comment }, held: 0 }).action;
    expect(ask({}, { login: 'a-bot[bot]' })).toBe('ignore');
    expect(ask({}, { type: 'Bot' })).toBe('ignore');
    expect(ask({ state: 'closed' }, {})).toBe('ignore');
    expect(ask({ isPullRequest: true }, {})).toBe('ignore');
    expect(ask({ labels: ['bug'] }, {})).toBe('ignore');
  });

  it('says it is taken when someone holds it, and stays quiet for the one who holds it', () => {
    expect(
      decide({ issue: { ...open, assignees: ['other'] }, comment: person, held: 0 }).action,
    ).toBe('taken');
    expect(
      decide({ issue: { ...open, assignees: ['Newcomer'] }, comment: person, held: 0 }).action,
    ).toBe('ignore');
  });

  it('asks to finish one first at the third', () => {
    expect(decide({ issue: open, comment: person, held: 3 }).action).toBe('cap');
    expect(decide({ issue: open, comment: person, held: 2 }).action).toBe('assign');
  });
});

const issueOf = (number: number, assignees: string[], labels = ['good first issue']) => ({
  number,
  state: 'open',
  labels: labels.map((name) => ({ name })),
  assignees: assignees.map((login) => ({ login })),
});

const eventOn = (number: number, body: string, association = 'NONE', login = 'newcomer') => ({
  action: 'created',
  issue: { number },
  comment: { body, author_association: association, user: { login, type: 'User' } },
});

const assignedBy = (daysBefore: number, login = 'newcomer') => ({
  user: { login: BOT },
  body: `${assignedMarker(daysAgo(daysBefore), login)}\nThis issue is yours.`,
});

describe('the three answers, written', () => {
  it('assigns and replies once with the date hidden in it', () => {
    const api = fixtureApi({ issues: { '7': issueOf(7, []) } }, () => {});
    expect(claim(eventOn(7, "I'd like to take this"), api, NOW).action).toBe('assign');
    expect(api.writes.map((w: { write: string }) => w.write)).toEqual(['assign', 'comment']);
    const reply = (api.writes[1] as { body: string }).body;
    expect(reply).toContain('Done when');
    expect(reply).toContain('How to check');
    expect(reply).toContain('14 days');
    expect(assignmentOf([{ user: { login: BOT }, body: reply }])).toEqual({
      at: NOW,
      login: 'newcomer',
    });
  });

  it('says it is taken and writes no assignment', () => {
    const api = fixtureApi({ issues: { '7': issueOf(7, ['other']) } }, () => {});
    expect(claim(eventOn(7, 'assign me'), api, NOW).action).toBe('taken');
    expect(api.writes).toHaveLength(1);
    expect((api.writes[0] as { write: string; body: string }).body).toContain('14 days');
  });

  it('asks to finish one first when three of this workflow are held, and counts only its own', () => {
    const held = (n: number) => issueOf(n, ['newcomer']);
    const api = fixtureApi(
      {
        issues: { '7': issueOf(7, []), '1': held(1), '2': held(2), '3': held(3), '4': held(4) },
        comments: { '1': [assignedBy(2)], '2': [assignedBy(2)], '3': [assignedBy(2)] },
      },
      () => {},
    );
    // issue 4 was assigned by hand: it does not count, so three are held and the claim is refused
    expect(claim(eventOn(7, 'assign me'), api, NOW).action).toBe('cap');
    expect(api.writes.map((w: { write: string }) => w.write)).toEqual(['comment']);

    const two = fixtureApi(
      {
        issues: { '7': issueOf(7, []), '1': held(1), '2': held(2), '4': held(4) },
        comments: { '1': [assignedBy(2)], '2': [assignedBy(2)] },
      },
      () => {},
    );
    expect(claim(eventOn(7, 'assign me'), two, NOW).action).toBe('assign');
  });

  it('assigns nothing for a MEMBER, whatever the words', () => {
    const api = fixtureApi({ issues: { '7': issueOf(7, []) } }, () => {});
    expect(claim(eventOn(7, 'assign me', 'MEMBER'), api, NOW).action).toBe('ignore');
    expect(api.writes).toEqual([]);
  });
});

describe('an assignment is freed after 14 days with no pull request', () => {
  const at = (days: number) => ({ at: daysAgo(days), login: 'newcomer' });
  const base = { now: NOW, number: 7, assignees: ['newcomer'], pulls: [], repo: REPO };

  it('keeps it at 13 days and frees it at 15', () => {
    expect(expiry({ ...base, assignment: at(13) }).free).toBe(false);
    expect(expiry({ ...base, assignment: at(15) }).free).toBe(true);
    expect(expiry({ ...base, assignment: at(14) }).free).toBe(true);
  });

  it('keeps it at 15 days when an open pull request of theirs names the issue', () => {
    const pulls = [{ user: { login: 'Newcomer' }, title: 'Fix the thing', body: 'Closes #7' }];
    expect(expiry({ ...base, assignment: at(15), pulls }).free).toBe(false);
  });

  it('frees it when the pull request is another person’s, or names another issue', () => {
    const other = [{ user: { login: 'other' }, title: 'x', body: 'Closes #7' }];
    const another = [{ user: { login: 'newcomer' }, title: 'x', body: 'Closes #70 and #8' }];
    expect(expiry({ ...base, assignment: at(15), pulls: other }).free).toBe(true);
    expect(expiry({ ...base, assignment: at(15), pulls: another }).free).toBe(true);
  });

  it('names an issue of this repository by #N, owner/name#N or its address, and of no other', () => {
    const names = (text: string) => namesIssue({ title: 'x', body: text }, 7, REPO);
    expect(namesIssue({ title: 'Fix #7' }, 7, REPO)).toBe(true);
    expect(names(`Fixes ${REPO}#7.`)).toBe(true);
    expect(names('fixes MNEMA-WORK/mnema#7')).toBe(true);
    expect(names(`see https://github.com/${REPO}/issues/7`)).toBe(true);
    expect(names('Fixes another/repo#7.')).toBe(false);
    expect(names('see https://github.com/a/b/issues/7')).toBe(false);
    expect(names(`see https://github.com/${REPO}/issues/70`)).toBe(false);
    expect(names('Closes #17')).toBe(false);
    expect(names('Closes other-mnema-work/mnema#7')).toBe(false);
  });

  it('keeps an issue at 15 days when the open pull request names it as owner/name#N', () => {
    const pulls = [{ user: { login: 'newcomer' }, title: 'x', body: `Fixes ${REPO}#7` }];
    expect(expiry({ ...base, assignment: at(15), pulls }).free).toBe(false);
    const elsewhere = [{ user: { login: 'newcomer' }, title: 'x', body: 'Fixes another/repo#7' }];
    expect(expiry({ ...base, assignment: at(15), pulls: elsewhere }).free).toBe(true);
  });

  it('leaves alone an issue assigned by hand, or reassigned since', () => {
    expect(expiry({ ...base, assignment: null }).free).toBe(false);
    expect(expiry({ ...base, assignment: at(40), assignees: ['maintainer'] }).free).toBe(false);
    expect(expiry({ ...base, assignment: at(40), assignees: ['newcomer', 'other'] }).free).toBe(
      false,
    );
  });

  it('reads only the comments the workflow’s own account wrote, and a freeing cancels', () => {
    const forged = { user: { login: 'stranger' }, body: assignedMarker(daysAgo(40), 'newcomer') };
    expect(assignmentOf([forged])).toBeNull();
    const freed = { user: { login: BOT }, body: freedMarker(daysAgo(10)) };
    expect(assignmentOf([assignedBy(40), freed])).toBeNull();
    expect(assignmentOf([assignedBy(40), freed, assignedBy(3)])?.at).toEqual(daysAgo(3));
  });

  it('frees through the run: unassigns, says so once, and leaves the hand assignment', () => {
    const api = fixtureApi(
      {
        issues: {
          '1': issueOf(1, ['newcomer']),
          '2': issueOf(2, ['newcomer']),
          '3': issueOf(3, ['maintainer']),
          '4': issueOf(4, ['newcomer']),
        },
        comments: {
          '1': [assignedBy(15)],
          '2': [assignedBy(15)],
          '3': [],
          '4': [assignedBy(13)],
        },
        pulls: [{ user: { login: 'newcomer' }, title: 'Work on #2', body: '' }],
      },
      () => {},
    );
    expect(expire(api, NOW)).toEqual([1]);
    expect(api.writes).toEqual([
      { write: 'unassign', number: 1, login: 'newcomer' },
      { write: 'comment', number: 1, body: expect.stringContaining(freedMarker(NOW)) },
    ]);
  });
});

describe('a claim is not read out of code or after a no', () => {
  it.each([
    'Here is how: ```\nassign me\n``` that is the command',
    'Type `/take` on the issue to take it',
    '~~~\nI will take this\n~~~',
    'Please do not assign me',
    "Don't assign me yet",
    'There is no need to assign me, I will not take this',
    'I would never work on this... no need to /take it',
  ])('%j is not a claim', (text) => {
    expect(isClaim(text)).toBe(false);
  });

  it('still reads a claim around code, and a claim after a sentence that said no', () => {
    expect(isClaim('Using `pnpm test` I found it. Assign me please')).toBe(true);
    expect(isClaim('I did not try yet. I will take this')).toBe(true);
    expect(isClaim('Please assign me')).toBe(true);
  });
});

describe('two claims at once, and a quiet answer', () => {
  const claimAt = (id: number, login: string, at: string, body = 'assign me') => ({
    id,
    created_at: at,
    user: { login },
    body,
  });
  const eventOf = (c: ReturnType<typeof claimAt>) => ({
    action: 'created',
    issue: { number: 7 },
    comment: { ...c, author_association: 'NONE', user: { login: c.user.login, type: 'User' } },
  });
  const older = claimAt(10, 'first', '2026-12-01T11:00:00Z');
  const newer = claimAt(11, 'second', '2026-12-01T11:00:05Z');

  /** A free issue where, while this run assigns, the other claimant's run assigns too. */
  const racing = (other: string, comments: object[]) => {
    const api = fixtureApi(
      { issues: { '7': issueOf(7, []) }, comments: { '7': comments } },
      () => {},
    );
    const assign = api.assign;
    api.assign = (number: number, login: string) => {
      assign(number, other);
      return assign(number, login);
    };
    return api;
  };

  it('keeps the older claim and gives the issue back from the newer one', () => {
    const api = racing('first', [older, newer]);
    expect(claim(eventOf(newer), api, NOW).action).toBe('taken');
    expect(api.writes.map((w: { write: string }) => w.write)).toEqual([
      'assign',
      'assign',
      'unassign',
      'comment',
    ]);
    expect(api.writes[2]).toEqual({ write: 'unassign', number: 7, login: 'second' });
    expect((api.writes[3] as { body: string }).body).toContain('already holds this issue');
  });

  it('keeps the issue for the older claim, which says it is theirs', () => {
    const api = racing('second', [older, newer]);
    expect(claim(eventOf(older), api, NOW).action).toBe('assign');
    const writes = api.writes as { write: string; body?: string }[];
    expect(writes.map((w) => w.write)).toEqual(['assign', 'assign', 'comment']);
    expect(writes[2]?.body).toContain('This issue is yours');
  });

  it('breaks a tie of the clock by the comment id', () => {
    const a = claimAt(20, 'first', '2026-12-01T11:00:00Z');
    const b = claimAt(21, 'second', '2026-12-01T11:00:00Z');
    expect(claim(eventOf(b), racing('first', [a, b]), NOW).action).toBe('taken');
    expect(claim(eventOf(a), racing('second', [a, b]), NOW).action).toBe('assign');
  });

  it('does not count an assignee who never claimed it: a hand assignment made meanwhile stays', () => {
    const api = racing('maintainer', [older]);
    expect(claim(eventOf(older), api, NOW).action).toBe('assign');
    expect((api.writes as { write: string }[]).some((w) => w.write === 'unassign')).toBe(false);
  });

  it('gives the issue back when the login came to hold more than 3', () => {
    const held = (n: number) => issueOf(n, ['first']);
    const mine = claimAt(30, 'first', '2026-12-01T11:00:00Z');
    const api = fixtureApi(
      {
        issues: { '7': issueOf(7, []), '1': held(1), '2': held(2), '3': held(3) },
        // two assigned by this workflow, a third whose marker is not written yet but whose claim is there
        comments: {
          '1': [assignedBy(2, 'first')],
          '2': [assignedBy(2, 'first')],
          '3': [claimAt(31, 'first', '2026-12-01T11:59:59Z')],
        },
      },
      () => {},
    );
    // before the assignment the login holds 3 by the count, so the claim is refused at once
    expect(claim(eventOf(mine), api, NOW).action).toBe('cap');
    const writes = api.writes as { write: string }[];
    expect(writes.some((w) => w.write === 'assign')).toBe(false);
  });

  it('unassigns and says so when another claim made the login hold 3 between the check and the call', () => {
    const held = (n: number) => issueOf(n, ['first']);
    const mine = claimAt(30, 'first', '2026-12-01T11:00:00Z');
    const fixture = {
      issues: { '7': issueOf(7, []), '1': held(1), '2': held(2) },
      comments: { '1': [assignedBy(2, 'first')], '2': [assignedBy(2, 'first')] },
    };
    const api = fixtureApi(fixture, () => {});
    const assign = api.assign;
    // the third issue lands on the login while this run assigns
    api.assign = (number: number, login: string) => {
      fixture.issues['3' as '1'] = held(3);
      fixture.comments['3' as '1'] = [assignedBy(1, 'first')];
      return assign(number, login);
    };
    expect(claim(eventOf(mine), api, NOW).action).toBe('cap');
    const writes = (api.writes as { write: string; body?: string }[]).map((w) => w.write);
    expect(writes).toEqual(['assign', 'unassign', 'comment']);
    expect(fixture.issues['7'].assignees).toEqual([]);
  });

  it('fails, and says nothing that sounds like success, when the assignment did not take', () => {
    const api = fixtureApi({ issues: { '7': issueOf(7, []) } }, () => {});
    api.assign = () => undefined;
    expect(() => claim(eventOf(older), api, NOW)).toThrow(/did not take/);
    expect(api.writes).toEqual([]);
  });

  it('answers "taken" to a login once, and stays silent the second time', () => {
    const api = fixtureApi(
      { issues: { '7': issueOf(7, ['other']) }, comments: { '7': [] } },
      () => {},
    );
    expect(claim(eventOf(older), api, NOW).action).toBe('taken');
    expect(claim(eventOf(older), api, NOW).action).toBe('taken');
    expect(api.writes).toHaveLength(1);
    const third = fixtureApi(
      { issues: { '7': issueOf(7, ['other']) }, comments: { '7': [] } },
      () => {},
    );
    claim(eventOf(older), third, NOW);
    claim(eventOf(newer), third, NOW);
    expect(third.writes).toHaveLength(2);
  });
});

describe('the workflow runs nothing of a stranger’s comment', () => {
  const text = readFileSync(join(ROOT, '.github/workflows/claim-an-issue.yml'), 'utf-8');
  const code = text
    .split('\n')
    .filter((line) => !/^\s*#/.test(line))
    .join('\n');

  it('holds issues write, pull requests read and the contents read for the checkout, and no more', () => {
    expect(code).toMatch(/^permissions: \{\}$/m);
    const grants = [...code.matchAll(/^ {6}(\w[\w-]*): (read|write)$/gm)].map(
      (m) => `${m[1]}: ${m[2]}`,
    );
    expect(grants.sort()).toEqual([
      'contents: read',
      'contents: read',
      'issues: write',
      'issues: write',
      'pull-requests: read',
      'pull-requests: read',
    ]);
  });

  it('puts no expression in a shell line and checks out no pull request', () => {
    const runs = code.split('\n').filter((line) => /^\s+run:/.test(line));
    expect(runs).toEqual([
      '        run: node .github/assign-a-claimed-issue/claim.mjs claim "$GITHUB_EVENT_PATH"',
      '        run: node .github/assign-a-claimed-issue/claim.mjs adopt',
      '        run: node .github/assign-a-claimed-issue/claim.mjs expire',
      '        run: node .github/assign-a-claimed-issue/claim.mjs remind',
    ]);
    expect(code).not.toMatch(/^\s+(ref|repository):/m);
    expect(code).not.toMatch(/event\.(comment|issue)\.(body|title)/);
    expect(code).toMatch(/!github\.event\.issue\.pull_request/);
  });
});

describe('more ways to claim, and the comment that went unanswered', () => {
  it.each([
    "Claiming this issue to work on it. I'll open a PR soon.",
    "I'm claiming this",
    "I'm working on this",
    'I am working on this.',
    "I'm working on this now",
    'Hello! Claiming this, thanks.',
    "I'll take it",
    'I will take it!',
    "I'll work on it",
    'I will work on it',
    'please assign me',
    'Assign this to me',
    "I'd like to work on it",
    'Can I work on it?',
  ])('%j is a claim', (text) => {
    expect(isClaim(text)).toBe(true);
  });

  it.each([
    'Is anyone working on this?',
    'Has someone claimed this yet?',
    'Not claiming this, just reading.',
    "I won't be working on this",
    'Does this take it into account?',
    '> claiming this\n\nquoted',
    'Thanks for working on this!',
    'Someone is already working on this.',
    '@bob is working on this, see his PR.',
    'I was working on this file when it crashed.',
    "I'd claim this is a regression.",
    "I'm working on this file",
    'Thanks for claiming this',
    'claim this please',
  ])('%j is not a claim', (text) => {
    expect(isClaim(text)).toBe(false);
  });
});

describe('a comment that reads as a claim and matches no phrase', () => {
  it.each([
    'I would take this on if nobody minds',
    "I'll tackle it this week",
    'Let me pick this up',
    'Would you mind if I take this on',
    'May I take it?',
  ])('%j reads as a claim', (text) => {
    expect(isClaim(text)).toBe(false);
    expect(readsAsAClaim(text)).toBe(true);
  });

  it.each([
    "I'll take this",
    'How do I take it from here to the build?',
    'What would take this long?',
    "I'm not going to tackle it",
    'The build fails on Node 26.',
    'We should take this into account',
    'I hit this too while working on it locally',
    "I'm taking it from here, the crash also happens on Windows",
    'Happy to tackle it this week',
  ])('%j does not', (text) => {
    expect(readsAsAClaim(text)).toBe(false);
  });

  it('is answered once with how to claim, never with the comment, and by nothing else', () => {
    const text = 'Let me pick this up, SECRET-WORDS';
    const api = fixtureApi({ issues: { '7': issueOf(7, []) } }, () => {});
    expect(claim(eventOn(7, text), api, NOW).action).toBe('hint');
    expect(claim(eventOn(7, text), api, NOW).action).toBe('hint');
    expect(api.writes).toHaveLength(1);
    const body = (api.writes[0] as { body: string }).body;
    expect(body).toContain('`/take`');
    expect(body).toContain('@newcomer');
    expect(body).not.toContain('SECRET-WORDS');
  });

  it('says nothing on a maintainer, an issue someone holds, or a comment that is no intent', () => {
    const quiet = (issue: object, body: string, association = 'NONE') => {
      const api = fixtureApi({ issues: { '7': issue } }, () => {});
      claim(eventOn(7, body, association), api, NOW);
      return api.writes;
    };
    expect(quiet(issueOf(7, []), 'Let me pick this up', 'MEMBER')).toEqual([]);
    expect(quiet(issueOf(7, ['other']), 'Let me pick this up')).toEqual([]);
    expect(quiet(issueOf(7, []), 'The build fails on Node 26.')).toEqual([]);
    expect(quiet(issueOf(7, [], ['bug']), 'Let me pick this up')).toEqual([]);
  });
});

describe('the author of a pull request that closes a free issue is assigned', () => {
  const pull = (number: number, body: string, who = 'newcomer', association = 'NONE') => ({
    number,
    title: 'Change',
    body,
    user: { login: who, type: 'User' },
    author_association: association,
  });

  it('reads the closing keywords of this repository only', () => {
    expect(closedBy({ title: 'x', body: 'Fixes #7 and closes #8' }, REPO)).toEqual([7, 8]);
    expect(closedBy({ title: 'Resolves: #9', body: '' }, REPO)).toEqual([9]);
    expect(closedBy({ title: 'x', body: `fixed ${REPO}#10, see #11` }, REPO)).toEqual([10]);
    expect(closedBy({ title: 'x', body: 'Fixes another/repo#12. Related to #13' }, REPO)).toEqual(
      [],
    );
    expect(
      closedBy({ title: 'x', body: `Closes https://github.com/${REPO}/issues/14` }, REPO),
    ).toEqual([14]);
  });

  it('assigns the author and says so once on the issue, with the marker that dates it', () => {
    const api = fixtureApi(
      { issues: { '7': issueOf(7, []) }, pulls: [pull(30, 'Fixes #7')] },
      () => {},
    );
    expect(adopt(api, NOW, REPO)).toEqual([7]);
    expect(api.writes.map((w: { write: string }) => w.write)).toEqual(['assign', 'comment']);
    const body = (api.writes[1] as { body: string }).body;
    expect(body).toContain('@newcomer');
    expect(body).toContain('#30');
    expect(assignmentOf([{ user: { login: BOT }, body }])).toEqual({ at: NOW, login: 'newcomer' });
    expect(adopt(api, NOW, REPO)).toEqual([]);
    expect(api.writes).toHaveLength(2);
  });

  it('leaves alone an issue that is held, closed, not open to contributors, or not an issue here', () => {
    const api = fixtureApi(
      {
        issues: {
          '1': issueOf(1, ['other']),
          '2': { ...issueOf(2, []), state: 'closed' },
          '3': issueOf(3, [], ['bug']),
          '4': { ...issueOf(4, []), pull_request: {} },
        },
        pulls: [pull(30, 'Fixes #1, fixes #2, fixes #3, fixes #4, fixes #5, fixes other/repo#6')],
      },
      () => {},
    );
    expect(adopt(api, NOW, REPO)).toEqual([]);
    expect(api.writes).toEqual([]);
  });

  it('leaves alone a maintainer, a bot and an author at the limit', () => {
    const held = (n: number) => issueOf(n, ['newcomer']);
    const api = fixtureApi(
      {
        issues: {
          '7': issueOf(7, []),
          '8': issueOf(8, []),
          '1': held(1),
          '2': held(2),
          '3': held(3),
        },
        comments: { '1': [assignedBy(2)], '2': [assignedBy(2)], '3': [assignedBy(2)] },
        pulls: [
          pull(30, 'Fixes #7', 'owner', 'OWNER'),
          pull(31, 'Fixes #7', 'dependabot[bot]'),
          pull(32, 'Fixes #8'),
        ],
      },
      () => {},
    );
    expect(adopt(api, NOW, REPO)).toEqual([]);
    expect(api.writes).toEqual([]);
  });
});

describe('a hand assignment of an outside contributor is freed too', () => {
  const run = (extra: object, assignee = 'newcomer', labels = ['good first issue']) => {
    const api = fixtureApi(
      {
        issues: { '7': issueOf(7, [assignee], labels) },
        assignedAt: { [`7:${assignee.toLowerCase()}`]: daysAgo(15).toISOString() },
        ...extra,
      },
      () => {},
    );
    return { api, freed: expire(api, NOW, REPO) };
  };

  it('frees it after 14 days with no pull request, and says so', () => {
    const { api, freed } = run({});
    expect(freed).toEqual([7]);
    expect(api.writes[0]).toEqual({ write: 'unassign', number: 7, login: 'newcomer' });
    expect((api.writes[1] as { body: string }).body).toContain('free again');
  });

  it('keeps it while an open pull request of theirs names the issue, and before 14 days', () => {
    expect(
      run({ pulls: [{ user: { login: 'newcomer' }, title: 'x', body: 'Fixes #7' }] }).freed,
    ).toEqual([]);
    const fresh = fixtureApi(
      {
        issues: { '7': issueOf(7, ['newcomer']) },
        assignedAt: { '7:newcomer': daysAgo(13).toISOString() },
      },
      () => {},
    );
    expect(expire(fresh, NOW, REPO)).toEqual([]);
  });

  it('never frees a maintainer, or an issue that is ours (no contributor label)', () => {
    expect(run({ maintainers: ['Maintainer'] }, 'maintainer').freed).toEqual([]);
    expect(run({}, 'newcomer', ['area: record']).freed).toEqual([]);
  });

  it('does nothing when the date of the assignment cannot be read', () => {
    const api = fixtureApi({ issues: { '7': issueOf(7, ['newcomer']) } }, () => {});
    expect(expire(api, NOW, REPO)).toEqual([]);
  });
});

describe('an outside pull request that waits on its author', () => {
  const pr = {
    number: 40,
    user: { login: 'newcomer', type: 'User' },
    author_association: 'NONE',
    draft: false,
    maintainer_can_modify: true,
  };
  const ask = (days: number, state = 'CHANGES_REQUESTED') => ({
    user: { login: 'maintainer' },
    author_association: 'OWNER',
    state,
    submitted_at: daysAgo(days).toISOString(),
  });
  const commit = (days: number, login: string | null = 'newcomer') => ({
    author: login ? { login } : null,
    commit: { committer: { date: daysAgo(days).toISOString() } },
  });
  const run = (parts: {
    reviews?: object[];
    commits?: object[];
    comments?: object[];
    pull?: object;
  }) => {
    const pull = { ...pr, ...parts.pull };
    const api = fixtureApi(
      {
        pulls: [pull],
        reviews: { '40': parts.reviews ?? [] },
        commits: { '40': parts.commits ?? [] },
        comments: { '40': parts.comments ?? [] },
      },
      () => {},
    );
    return { api, said: remind(api, NOW) };
  };

  it('says nothing before 7 days, reminds at 7 starting with the login, notes at 14', () => {
    expect(run({ reviews: [ask(6)] }).said).toEqual([]);
    const seven = run({ reviews: [ask(8)] });
    expect(seven.said).toEqual([{ pull: 40, said: 'reminder' }]);
    expect((seven.api.writes[0] as { body: string }).body).toMatch(/^<!-- [^\n]*-->\n@newcomer,/);
    const fourteen = run({ reviews: [ask(15)] });
    expect(fourteen.said).toEqual([{ pull: 40, said: 'finish' }]);
    const note = (fourteen.api.writes[0] as { body: string }).body;
    expect(note).toContain('finish it on your branch');
    expect(note).toContain('@newcomer,');
  });

  it('says the pull request will be closed with thanks when the branch cannot be edited', () => {
    const note = (
      run({ reviews: [ask(15)], pull: { maintainer_can_modify: false } }).api.writes[0] as {
        body: string;
      }
    ).body;
    expect(note).toContain('close this pull request with thanks');
    expect(note).not.toContain('on your branch');
  });

  it('counts a maintainer comment after the last commit as the request, and a commit as the answer', () => {
    const comment = {
      user: { login: 'maintainer' },
      author_association: 'MEMBER',
      body: 'Thanks @Newcomer, could you rebase this?',
      created_at: daysAgo(9).toISOString(),
    };
    expect(run({ comments: [comment], commits: [commit(12)] }).said).toEqual([
      { pull: 40, said: 'reminder' },
    ]);
    expect(run({ comments: [comment], commits: [commit(2)] }).said).toEqual([]);
    expect(
      run({
        reviews: [ask(9)],
        comments: [{ user: { login: 'newcomer' }, created_at: daysAgo(1).toISOString() }],
      }).said,
    ).toEqual([]);
  });

  it('says nothing when a maintainer approved last, for a draft, a maintainer or a bot', () => {
    expect(run({ reviews: [ask(9), ask(8, 'APPROVED')] }).said).toEqual([]);
    expect(run({ reviews: [ask(9)], pull: { draft: true } }).said).toEqual([]);
    expect(run({ reviews: [ask(9)], pull: { author_association: 'MEMBER' } }).said).toEqual([]);
    expect(
      run({ reviews: [ask(9)], pull: { user: { login: 'x[bot]', type: 'Bot' } } }).said,
    ).toEqual([]);
  });

  it('says each thing once for one request, and again for a later one', () => {
    const first = run({ reviews: [ask(9)] });
    expect(first.said).toEqual([{ pull: 40, said: 'reminder' }]);
    expect(first.api.writes).toHaveLength(1);
    // the fixture keeps what was written as the workflow's own comment, so a second run adds nothing
    expect(remind(first.api, NOW)).toEqual([]);
    expect(first.api.writes).toHaveLength(1);
    const later = run({ reviews: [ask(30), ask(8)] });
    expect(later.said).toEqual([{ pull: 40, said: 'reminder' }]);
  });

  it('only comments: it never pushes, merges or closes', () => {
    const { api } = run({ reviews: [ask(30)] });
    expect(api.writes.map((w: { write: string }) => w.write)).toEqual(['comment']);
    const code = readFileSync(join(ROOT, '.github/assign-a-claimed-issue/claim.mjs'), 'utf-8');
    expect(code).not.toMatch(/\/merge|'PUT'|state=closed|-f',\s*'state/);
  });

  it('reads waiting from the last event alone', () => {
    expect(waitingSince(pr, [], [ask(3)], [])).toEqual(daysAgo(3));
    expect(waitingSince(pr, [], [ask(3)], [commit(1)])).toBeNull();
    expect(waitingSince(pr, [], [ask(3)], [commit(1, 'maintainer')])).toBeNull();
    // a commit whose e-mail is not linked to an account has no author, and is an answer all the same
    expect(waitingSince(pr, [], [ask(3)], [commit(1, null)])).toBeNull();
    // a commit from before the request answers nothing
    expect(waitingSince(pr, [], [ask(3)], [commit(5, null)])).toEqual(daysAgo(3));
  });

  it('counts only a real request: changes requested, or a maintainer comment that names the author', () => {
    expect(waitingSince(pr, [], [ask(3, 'COMMENTED')], [])).toBeNull();
    expect(waitingSince(pr, [], [ask(3, 'APPROVED')], [])).toBeNull();
    const said = (body: string, association = 'MEMBER') => ({
      user: { login: 'maintainer' },
      author_association: association,
      body,
      created_at: daysAgo(3).toISOString(),
    });
    expect(waitingSince(pr, [said('Looks fine, thanks.')], [], [])).toBeNull();
    expect(waitingSince(pr, [said('@newcomerish please rebase')], [], [])).toBeNull();
    expect(waitingSince(pr, [said('@newcomer please rebase', 'NONE')], [], [])).toBeNull();
    expect(waitingSince(pr, [said('@newcomer please rebase')], [], [])).toEqual(daysAgo(3));
    expect(run({ reviews: [ask(9, 'COMMENTED')] }).said).toEqual([]);
  });

  it('counts the author’s comment or review after the request as the answer', () => {
    const mine = (days: number) => ({
      user: { login: 'Newcomer' },
      created_at: daysAgo(days).toISOString(),
      submitted_at: daysAgo(days).toISOString(),
    });
    expect(waitingSince(pr, [mine(1)], [ask(3)], [])).toBeNull();
    expect(waitingSince(pr, [], [ask(3), mine(1)], [])).toBeNull();
  });
});

describe('no reply repeats what a stranger wrote', () => {
  const CANARY = 'ZQX-STRANGER-WORDS';
  const bodies = (api: { writes: object[] }) =>
    (api.writes as { write: string; body?: string }[])
      .filter((w) => w.write === 'comment')
      .map((w) => String(w.body));

  it('writes the assigned, taken, cap and hint replies without the comment', () => {
    const said: string[] = [];
    const run = (issues: Record<string, object>, text: string, extra: object = {}) => {
      const api = fixtureApi({ issues, ...extra }, () => {});
      claim(eventOn(7, text), api, NOW);
      said.push(...bodies(api));
    };
    run({ '7': issueOf(7, []) }, `I'll take this ${CANARY}`);
    run({ '7': issueOf(7, ['other']) }, `I'll take this ${CANARY}`);
    run({ '7': issueOf(7, []) }, `Let me pick this up. ${CANARY}`);
    const held = (n: number) => issueOf(n, ['newcomer']);
    run({ '7': issueOf(7, []), '8': held(8), '9': held(9), '10': held(10) }, `I'll take this ${CANARY}`, {
      comments: {
        '8': [{ user: { login: BOT }, body: assignedMarker(daysAgo(1), 'newcomer') }],
        '9': [{ user: { login: BOT }, body: assignedMarker(daysAgo(1), 'newcomer') }],
        '10': [{ user: { login: BOT }, body: assignedMarker(daysAgo(1), 'newcomer') }],
      },
    });
    expect(said.length).toBeGreaterThanOrEqual(4);
    for (const body of said) expect(body).not.toContain(CANARY);
  });

  it('writes the adopted, freed, reminder and note replies without a title, a body or a comment', () => {
    const said: string[] = [];
    const adopting = fixtureApi(
      {
        issues: { '7': issueOf(7, []) },
        pulls: [
          {
            number: 30,
            title: `Fix ${CANARY}`,
            body: `Fixes #7 ${CANARY}`,
            user: { login: 'newcomer', type: 'User' },
            author_association: 'NONE',
          },
        ],
      },
      () => {},
    );
    adopt(adopting, NOW, REPO);
    said.push(...bodies(adopting));

    const freeing = fixtureApi(
      {
        issues: { '7': issueOf(7, ['newcomer']) },
        comments: {
          '7': [
            { user: { login: BOT }, body: assignedMarker(daysAgo(20), 'newcomer') },
            { user: { login: 'newcomer' }, body: CANARY },
          ],
        },
        pulls: [{ number: 31, title: CANARY, body: 'Fixes #8', user: { login: 'newcomer' } }],
      },
      () => {},
    );
    expire(freeing, NOW, REPO);
    said.push(...bodies(freeing));

    const waiting = (days: number) => {
      const api = fixtureApi(
        {
          pulls: [
            {
              number: 40,
              title: CANARY,
              body: CANARY,
              user: { login: 'newcomer', type: 'User' },
              author_association: 'NONE',
              maintainer_can_modify: true,
            },
          ],
          reviews: {
            '40': [
              {
                user: { login: 'maintainer' },
                author_association: 'OWNER',
                state: 'CHANGES_REQUESTED',
                body: CANARY,
                submitted_at: daysAgo(days).toISOString(),
              },
            ],
          },
          comments: { '40': [] },
        },
        () => {},
      );
      remind(api, NOW);
      return bodies(api);
    };
    said.push(...waiting(8), ...waiting(15));
    expect(said).toHaveLength(4);
    for (const body of said) expect(body).not.toContain(CANARY);
  });
});
