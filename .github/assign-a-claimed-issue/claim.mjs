#!/usr/bin/env node
/**
 * A CLAIMED ISSUE IS ASSIGNED, AND FREED AFTER 14 DAYS WITHOUT A PULL REQUEST (ADR-532).
 *
 * Two things run from `.github/workflows/claim-an-issue.yml`, and every decision in them is a pure
 * function here that a test imports:
 *
 *   node .github/assign-a-claimed-issue/claim.mjs claim "$GITHUB_EVENT_PATH"
 *     A comment was created. If it is a claim on an open `good first issue` or `help wanted` issue
 *     (not a pull request) by someone who is not a bot and not OWNER, MEMBER or COLLABORATOR, the
 *     commenter is assigned when nobody holds the issue and holds fewer than 3 issues this workflow
 *     assigned to them; otherwise one reply says why not.
 *   node .github/assign-a-claimed-issue/claim.mjs expire
 *     Daily. An open issue this workflow assigned, 14 days after the assignment, whose assignee has
 *     no open pull request that names the issue, is unassigned and says so.
 *
 * THE TEXT OF THE COMMENT IS DATA. It is read from the event file GitHub wrote, matched against
 * phrases and put nowhere else: not in a shell line, not in a reply. The calls to GitHub go
 * through `gh` with an argument list, never through a shell.
 *
 * HOW IT KNOWS ITS OWN ASSIGNMENTS. The reply that assigns carries a hidden marker with the date
 * and the login, and the reply that frees carries another. Only comments written by the workflow's
 * own account count, and the assignee must still be the one the marker names, so an issue a
 * maintainer assigned by hand, or reassigned afterwards, is never touched.
 *
 * WHAT IT DOES NOT DO. It does not judge a claim (whether the person can do the work), it does not
 * read a pull request beyond who wrote it and whether it names the issue, and a merged pull request
 * needs nothing from it: the merge closes the issue.
 *
 * `--fixture <file>` stands a JSON file in for GitHub and prints what would be written, which is
 * how it is tried without the real repository.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

/** @typedef {any} Json what GitHub's API gave, or what a fixture stands in for it */
/**
 * @typedef {{
 *   issue: (number: number) => Json,
 *   comments: (number: number) => Json[],
 *   assignedTo: (login: string) => Json[],
 *   assignedIssues: () => Json[],
 *   openPulls: () => Json[],
 *   assign: (number: number, login: string) => unknown,
 *   unassign: (number: number, login: string) => unknown,
 *   comment: (number: number, body: string) => unknown,
 * }} Api
 */

export const DAYS_TO_FREE = 14;
export const MOST_HELD = 3;
const DAY = 24 * 60 * 60 * 1000;
const OUR_ACCOUNT = 'github-actions[bot]';

/** The labels that open an issue to a contributor, lower case. */
export const CLAIMABLE_LABELS = ['good first issue', 'help wanted'];

/** Who is a maintainer and so never claims through a comment. */
export const MAINTAINER_ASSOCIATIONS = ['OWNER', 'MEMBER', 'COLLABORATOR'];

/**
 * What a claim says, lower case with `this issue` read as `this`. A phrase matches as whole words.
 * A question about the issue that asks for nothing to take is not in the list.
 */
export const CLAIM_PHRASES = [
  "i'd like to take this",
  'i would like to take this',
  "i'll take this",
  'i will take this',
  'i can take this',
  'can i take this',
  "i'd like to work on this",
  'i would like to work on this',
  "i'll work on this",
  'i will work on this',
  'i want to work on this',
  'can i work on this',
  'could i work on this',
  'assign me',
  'assign this to me',
  '/take',
  '/claim',
];

/** @param {string} text */
const escapeForRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');

const CLAIM_RE = new RegExp(
  CLAIM_PHRASES.map((phrase) => `(?<![\\w/])${escapeForRegExp(phrase)}(?![\\w/])`).join('|'),
);

/** The text a claim is looked for in: no quoted lines, the curly apostrophe made straight, one case. */
/** @param {unknown} text */
const normalise = (text) =>
  String(text ?? '')
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('>'))
    .join(' ')
    .replace(/[‘’]/g, "'")
    .toLowerCase()
    .replace(/this issue/g, 'this')
    .replace(/\s+/g, ' ');

/** Whether the comment claims the issue it is on. @param {string} text */
export const isClaim = (text) => CLAIM_RE.test(normalise(text));

/**
 * What to do about one comment. `held` is how many open issues this workflow assigned to the
 * commenter that they still hold.
 *
 * @param {{
 *   issue: { state: string, labels: string[], assignees: string[], isPullRequest: boolean },
 *   comment: { login: string, type?: string, association: string, body: string },
 *   held: number,
 * }} input
 * @returns {{ action: 'assign' | 'taken' | 'cap' | 'ignore', why: string }}
 */
export function decide({ issue, comment, held }) {
  if (issue.isPullRequest) return { action: 'ignore', why: 'a pull request' };
  if (issue.state !== 'open') return { action: 'ignore', why: 'not open' };
  const labels = issue.labels.map((label) => label.toLowerCase());
  if (!CLAIMABLE_LABELS.some((label) => labels.includes(label))) {
    return { action: 'ignore', why: 'not open to contributors' };
  }
  if (comment.type === 'Bot' || comment.login.endsWith('[bot]')) {
    return { action: 'ignore', why: 'a bot' };
  }
  if (MAINTAINER_ASSOCIATIONS.includes(comment.association)) {
    return { action: 'ignore', why: 'a maintainer' };
  }
  if (!isClaim(comment.body)) return { action: 'ignore', why: 'not a claim' };
  const holders = issue.assignees.map((login) => login.toLowerCase());
  if (holders.includes(comment.login.toLowerCase())) {
    return { action: 'ignore', why: 'already theirs' };
  }
  if (holders.length > 0) return { action: 'taken', why: 'someone holds it' };
  if (held >= MOST_HELD) return { action: 'cap', why: `holds ${held} already` };
  return { action: 'assign', why: 'free' };
}

const ASSIGNED_MARKER = /<!-- claim-an-issue:assigned (\S+) login=(\S+) -->/;
const FREED_MARKER = /<!-- claim-an-issue:freed (\S+) -->/;

/** @param {Date} now @param {string} login */
export const assignedMarker = (now, login) =>
  `<!-- claim-an-issue:assigned ${now.toISOString()} login=${login} -->`;
/** @param {Date} now */
export const freedMarker = (now) => `<!-- claim-an-issue:freed ${now.toISOString()} -->`;

/** The replies. Each is one comment, and the one that assigns or frees carries its marker. */
export const replies = {
  /** @param {string} login @param {Date} now */
  assigned: (login, now) =>
    [
      assignedMarker(now, login),
      `This issue is yours, @${login}.`,
      '',
      'What the review looks at is the issue\'s "Done when" and "How to check": a pull request that meets the first and shows the second is what closes it.',
      '',
      `The assignment frees itself after ${DAYS_TO_FREE} days without an open pull request that names this issue (write \`#<number>\` in its description). Open one early, even as a draft, and it stays yours.`,
    ].join('\n'),
  /** @param {string} login */
  taken: (login) =>
    [
      `Thanks, @${login}: someone already holds this issue.`,
      '',
      `If they open no pull request that names it within ${DAYS_TO_FREE} days of taking it, it frees itself and you can ask again then.`,
    ].join('\n'),
  /** @param {string} login */
  cap: (login) =>
    [
      `Thanks, @${login}: you already hold ${MOST_HELD} issues here that were assigned this way.`,
      '',
      'Please finish one, or let one go by saying so on it, before taking another.',
    ].join('\n'),
  /** @param {string} login @param {Date} now */
  freed: (login, now) =>
    [
      freedMarker(now),
      `This issue is free again: no open pull request from @${login} names it ${DAYS_TO_FREE} days after it was assigned.`,
      '',
      'Anyone may ask to take it with a comment.',
    ].join('\n'),
};

/**
 * What this workflow's own comments say about the issue now: the assignment it made, if no freeing
 * came after it. Comments written by anyone else are not read.
 *
 * @param {{ user: { login: string }, body: string }[]} comments in the order written
 * @returns {{ at: Date, login: string } | null}
 */
export function assignmentOf(comments) {
  /** @type {{ at: Date, login: string } | null} */
  let state = null;
  for (const comment of comments) {
    if (comment.user?.login !== OUR_ACCOUNT) continue;
    const assigned = ASSIGNED_MARKER.exec(comment.body ?? '');
    if (assigned) {
      const at = new Date(String(assigned[1]));
      state = Number.isNaN(at.getTime()) ? null : { at, login: String(assigned[2]) };
    } else if (FREED_MARKER.test(comment.body ?? '')) {
      state = null;
    }
  }
  return state;
}

/** Whether a pull request names the issue: `#N` in the title or the body, or the issue's address. */
/** @param {Json} pull @param {number} number */
export function namesIssue(pull, number) {
  const text = `${pull.title ?? ''}\n${pull.body ?? ''}`;
  return new RegExp(`(?<![\\w/])#${number}(?!\\d)|/issues/${number}(?!\\d)`).test(text);
}

/**
 * Whether an issue this workflow assigned is freed now.
 *
 * @param {{
 *   now: Date,
 *   number: number,
 *   assignment: { at: Date, login: string } | null,
 *   assignees: string[],
 *   pulls: { user: { login: string }, title?: string, body?: string }[],
 * }} input
 * @returns {{ free: boolean, login?: string, why: string }}
 */
export function expiry({ now, number, assignment, assignees, pulls }) {
  if (!assignment) return { free: false, why: 'not assigned by the workflow' };
  const mine = assignment.login.toLowerCase();
  if (assignees.length !== 1 || assignees[0]?.toLowerCase() !== mine) {
    return { free: false, why: 'assigned to someone else since' };
  }
  if (now.getTime() - assignment.at.getTime() < DAYS_TO_FREE * DAY) {
    return { free: false, why: 'not yet' };
  }
  const open = pulls.some(
    (pull) => pull.user?.login?.toLowerCase() === mine && namesIssue(pull, number),
  );
  if (open) return { free: false, why: 'a pull request names it' };
  return { free: true, login: assignment.login, why: 'no pull request' };
}

/** The GitHub calls, through `gh` with an argument list. */
/**
 * @param {string} repo
 * @param {(args: string[]) => string} [run]
 * @returns {Api}
 */
export function ghApi(repo, run = (args) => execFileSync('gh', args, { encoding: 'utf-8' })) {
  /** @param {string} path @returns {Json[]} */
  const list = (path) =>
    run(['api', '--paginate', '--jq', '.[]', path])
      .split('\n')
      .filter((line) => line.trim() !== '')
      .map((line) => JSON.parse(line));
  return {
    issue: (number) => JSON.parse(run(['api', `repos/${repo}/issues/${number}`])),
    comments: (number) => list(`repos/${repo}/issues/${number}/comments?per_page=100`),
    assignedTo: (login) =>
      list(
        `repos/${repo}/issues?state=open&assignee=${encodeURIComponent(login)}&per_page=100`,
      ).filter((one) => !one.pull_request),
    assignedIssues: () =>
      list(`repos/${repo}/issues?state=open&assignee=*&per_page=100`).filter(
        (one) => !one.pull_request,
      ),
    openPulls: () => list(`repos/${repo}/pulls?state=open&per_page=100`),
    assign: (number, login) =>
      run([
        'api',
        '-X',
        'POST',
        `repos/${repo}/issues/${number}/assignees`,
        '-f',
        `assignees[]=${login}`,
      ]),
    unassign: (number, login) =>
      run([
        'api',
        '-X',
        'DELETE',
        `repos/${repo}/issues/${number}/assignees`,
        '-f',
        `assignees[]=${login}`,
      ]),
    comment: (number, body) =>
      run(['api', '-X', 'POST', `repos/${repo}/issues/${number}/comments`, '-f', `body=${body}`]),
  };
}

/** A stand-in for GitHub: reads come from the fixture, writes are printed and kept. */
/**
 * @param {Json} fixture
 * @param {(line: string) => void} [say]
 * @returns {Api & { writes: Json[] }}
 */
export function fixtureApi(fixture, say = console.log) {
  /** @type {Json[]} */
  const writes = [];
  /** @param {Json} what */
  const note = (what) => {
    writes.push(what);
    say(JSON.stringify(what));
  };
  return {
    writes,
    issue: (number) => fixture.issues[String(number)],
    comments: (number) => fixture.comments?.[String(number)] ?? [],
    assignedTo: (login) =>
      Object.values(fixture.issues).filter((one) =>
        (one.assignees ?? []).some(
          (/** @type {Json} */ who) => who.login.toLowerCase() === login.toLowerCase(),
        ),
      ),
    assignedIssues: () =>
      Object.values(fixture.issues).filter((one) => (one.assignees ?? []).length > 0),
    openPulls: () => fixture.pulls ?? [],
    assign: (number, login) => note({ write: 'assign', number, login }),
    unassign: (number, login) => note({ write: 'unassign', number, login }),
    comment: (number, body) => note({ write: 'comment', number, body }),
  };
}

/** @param {Json} issue */
const labelsOf = (issue) =>
  (issue.labels ?? []).map((/** @type {Json} */ label) => label.name ?? label);
/** @param {Json} issue */
const loginsOf = (issue) => (issue.assignees ?? []).map((/** @type {Json} */ who) => who.login);

/** How many open issues this workflow assigned to `login` that they still hold. */
/** @param {Api} api @param {string} login */
export function heldBy(api, login) {
  return api.assignedTo(login).filter((one) => {
    const mine = assignmentOf(api.comments(one.number));
    return mine !== null && mine.login.toLowerCase() === login.toLowerCase();
  }).length;
}

/**
 * One created comment.
 *
 * @param {Json} event
 * @param {Api} api
 * @param {Date} [now]
 * @returns {{ action: string, why: string }}
 */
export function claim(event, api, now = new Date()) {
  const number = event.issue?.number;
  const comment = event.comment;
  if (event.action !== 'created' || !number || !comment)
    return { action: 'ignore', why: 'not a new comment' };
  // The issue is read again: the event is a moment ago, and who holds it may have changed since.
  const issue = api.issue(number);
  const login = comment.user?.login ?? '';
  /** @param {number} held */
  const ask = (held) =>
    decide({
      issue: {
        state: issue.state,
        labels: labelsOf(issue),
        assignees: loginsOf(issue),
        isPullRequest: Boolean(issue.pull_request),
      },
      comment: {
        login,
        type: comment.user?.type,
        association: comment.author_association ?? '',
        body: comment.body ?? '',
      },
      held,
    });
  let verdict = ask(0);
  // What the commenter already holds is asked of GitHub only for a claim that would be granted.
  if (verdict.action === 'assign') verdict = ask(heldBy(api, login));
  if (verdict.action === 'taken') api.comment(number, replies.taken(login));
  if (verdict.action === 'cap') api.comment(number, replies.cap(login));
  if (verdict.action !== 'assign') return verdict;
  api.assign(number, login);
  api.comment(number, replies.assigned(login, now));
  return verdict;
}

/**
 * The daily run.
 *
 * @param {Api} api
 * @param {Date} [now]
 * @returns {number[]} the issues it freed
 */
export function expire(api, now = new Date()) {
  const freed = [];
  let pulls = null;
  for (const issue of api.assignedIssues()) {
    const assignment = assignmentOf(api.comments(issue.number));
    if (!assignment) continue;
    pulls ??= api.openPulls();
    const verdict = expiry({
      now,
      number: issue.number,
      assignment,
      assignees: loginsOf(issue),
      pulls,
    });
    if (!verdict.free) continue;
    const who = String(verdict.login);
    api.unassign(issue.number, who);
    api.comment(issue.number, replies.freed(who, now));
    freed.push(issue.number);
  }
  return freed;
}

/** @param {string[]} argv */
function main(argv) {
  const [mode, eventPath] = argv;
  const at = argv.indexOf('--fixture');
  const fixture = at === -1 ? null : JSON.parse(readFileSync(String(argv[at + 1]), 'utf-8'));
  const api = fixture ? fixtureApi(fixture) : ghApi(process.env.GITHUB_REPOSITORY ?? '');
  const now = fixture?.now ? new Date(fixture.now) : new Date();
  if (mode === 'claim') {
    const event = JSON.parse(readFileSync(String(eventPath), 'utf-8'));
    const verdict = claim(event, api, now);
    console.log(`${verdict.action}: ${verdict.why}`);
  } else if (mode === 'expire') {
    console.log(`freed: ${expire(api, now).join(', ') || 'none'}`);
  } else {
    console.error('usage: claim.mjs claim <event.json> | expire [--fixture <file>]');
    process.exit(2);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main(process.argv.slice(2));
