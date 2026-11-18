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

/** The phrases as one pattern, whole words, found anywhere (a new one for each reading: it is global). */
const claimPattern = () =>
  new RegExp(
    CLAIM_PHRASES.map((phrase) => `(?<![\\w/])${escapeForRegExp(phrase)}(?![\\w/])`).join('|'),
    'g',
  );

/** What stands right before a phrase and turns it round: "do not", "don't", "never", "no need to". */
const NEGATION = /(?:\bnot|n't|\bnever|\bno need to|\bno need for you to)\s+$/;

/**
 * The text a claim is looked for in: no quoted lines, no fenced code and no inline code (a phrase
 * shown as code is shown, not said), the curly apostrophe made straight, one case.
 *
 * @param {unknown} text
 */
const normalise = (text) =>
  String(text ?? '')
    .replace(/(```|~~~)[\s\S]*?(\1|$)/g, ' ')
    .replace(/`[^`\n]*`/g, ' ')
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('>'))
    .join(' ')
    .replace(/[‘’]/g, "'")
    .toLowerCase()
    .replace(/this issue/g, 'this')
    .replace(/\s+/g, ' ');

/** Whether the comment claims the issue it is on, a negated phrase not counting. @param {string} text */
export const isClaim = (text) => {
  const said = normalise(text);
  for (const found of said.matchAll(claimPattern())) {
    if (!NEGATION.test(said.slice(0, found.index))) return true;
  }
  return false;
};

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
/** @param {string} login */
export const takenMarker = (login) => `<!-- claim-an-issue:taken login=${login} -->`;
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
      takenMarker(login),
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

/**
 * Whether a pull request names the issue: `#N`, `owner/repo#N` or the issue's address, in the title
 * or the body, and only of THIS repository (`repo` is `owner/name`). Another repository's `#N` is not.
 *
 * @param {Json} pull
 * @param {number} number
 * @param {string} repo
 */
export function namesIssue(pull, number, repo) {
  const text = `${pull.title ?? ''}\n${pull.body ?? ''}`;
  const bare = new RegExp(`(?<![\\w/.#-])#${number}(?!\\d)`);
  if (bare.test(text)) return true;
  if (!repo) return false;
  const here = escapeForRegExp(repo);
  const qualified = new RegExp(`(?<![\\w.-])${here}#${number}(?!\\d)`, 'i');
  const address = new RegExp(`https?://github\\.com/${here}/issues/${number}(?!\\d)`, 'i');
  return qualified.test(text) || address.test(text);
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
 *   repo: string,
 * }} input
 * @returns {{ free: boolean, login?: string, why: string }}
 */
export function expiry({ now, number, assignment, assignees, pulls, repo }) {
  if (!assignment) return { free: false, why: 'not assigned by the workflow' };
  const mine = assignment.login.toLowerCase();
  if (assignees.length !== 1 || assignees[0]?.toLowerCase() !== mine) {
    return { free: false, why: 'assigned to someone else since' };
  }
  if (now.getTime() - assignment.at.getTime() < DAYS_TO_FREE * DAY) {
    return { free: false, why: 'not yet' };
  }
  const open = pulls.some(
    (pull) => pull.user?.login?.toLowerCase() === mine && namesIssue(pull, number, repo),
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
    assign: (number, login) => {
      const one = fixture.issues[String(number)];
      one.assignees = [...(one.assignees ?? []), { login }];
      note({ write: 'assign', number, login });
    },
    unassign: (number, login) => {
      const one = fixture.issues[String(number)];
      one.assignees = (one.assignees ?? []).filter(
        (/** @type {Json} */ who) => who.login.toLowerCase() !== login.toLowerCase(),
      );
      note({ write: 'unassign', number, login });
    },
    comment: (number, body) => {
      fixture.comments ??= {};
      const there = fixture.comments;
      there[String(number)] = [
        ...(there[String(number)] ?? []),
        { user: { login: OUR_ACCOUNT }, body },
      ];
      note({ write: 'comment', number, body });
    },
  };
}

/** @param {Json} issue */
const labelsOf = (issue) =>
  (issue.labels ?? []).map((/** @type {Json} */ label) => label.name ?? label);
/** @param {Json} issue @returns {string[]} */
const loginsOf = (issue) => (issue.assignees ?? []).map((/** @type {Json} */ who) => who.login);

/**
 * How many other open issues `login` holds through a claim: this workflow's marker for them, or a
 * claim of their own on an issue they are assigned to (an assignment whose marker is not yet written).
 *
 * @param {Api} api
 * @param {string} login
 * @param {number} [except] the issue being claimed
 */
export function heldBy(api, login, except) {
  const who = login.toLowerCase();
  return api.assignedTo(login).filter((one) => {
    if (one.number === except) return false;
    const comments = api.comments(one.number);
    const mine = assignmentOf(comments);
    if (mine !== null && mine.login.toLowerCase() === who) return true;
    return comments.some((c) => c.user?.login?.toLowerCase() === who && isClaim(c.body ?? ''));
  }).length;
}

/** Whether this workflow already told `login` on this issue that it is taken. @param {Json[]} comments @param {string} login */
const toldTaken = (comments, login) =>
  comments.some(
    (c) => c.user?.login === OUR_ACCOUNT && String(c.body ?? '').includes(takenMarker(login)),
  );

/** Which of two claim comments is older: the time, then the id. @param {Json} a @param {Json} b */
const olderThan = (a, b) => {
  const at = String(a.created_at ?? '').localeCompare(String(b.created_at ?? ''));
  return at !== 0 ? at < 0 : Number(a.id) < Number(b.id);
};

/**
 * The claim of another assignee that came before this one: another login now on the issue that
 * wrote a claim on it, older than ours. A maintainer's hand assignment has no such claim.
 *
 * @param {Json[]} comments
 * @param {Json} ours the comment this run is answering
 * @param {string[]} assignees
 * @param {string} login
 */
const claimedBefore = (comments, ours, assignees, login) => {
  const others = assignees.filter((who) => who.toLowerCase() !== login.toLowerCase());
  return comments.some(
    (c) =>
      others.some((who) => who.toLowerCase() === c.user?.login?.toLowerCase()) &&
      isClaim(c.body ?? '') &&
      olderThan(c, ours),
  );
};

/**
 * One created comment.
 *
 * Two comments can arrive together and GitHub keeps one waiting run per group, so there is no
 * queue: each run assigns, reads the issue back, and puts right what it finds. The older claim keeps
 * the issue, and a login that came to hold more than 3 gives this one back. A run whose assignment
 * did not take says nothing that sounds like success and fails.
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
  if (verdict.action === 'assign') verdict = ask(heldBy(api, login, number));
  if (verdict.action === 'taken' && !toldTaken(api.comments(number), login)) {
    api.comment(number, replies.taken(login));
  }
  if (verdict.action === 'cap') api.comment(number, replies.cap(login));
  if (verdict.action !== 'assign') return verdict;

  api.assign(number, login);
  const after = api.issue(number);
  const assigned = loginsOf(after);
  if (!assigned.some((who) => who.toLowerCase() === login.toLowerCase())) {
    throw new Error(`the assignment of #${number} to ${login} did not take`);
  }
  const comments = api.comments(number);
  if (claimedBefore(comments, comment, assigned, login)) {
    api.unassign(number, login);
    if (!toldTaken(comments, login)) api.comment(number, replies.taken(login));
    return { action: 'taken', why: 'an older claim holds it' };
  }
  if (heldBy(api, login, number) >= MOST_HELD) {
    api.unassign(number, login);
    api.comment(number, replies.cap(login));
    return { action: 'cap', why: `holds ${MOST_HELD} already` };
  }
  api.comment(number, replies.assigned(login, now));
  return verdict;
}

/**
 * The daily run.
 *
 * @param {Api} api
 * @param {Date} [now]
 * @param {string} [repo] `owner/name`, for the pull requests that name an issue
 * @returns {number[]} the issues it freed
 */
export function expire(api, now = new Date(), repo = '') {
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
      repo,
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
  const repo = fixture?.repo ?? process.env.GITHUB_REPOSITORY ?? '';
  const api = fixture ? fixtureApi(fixture) : ghApi(repo);
  const now = fixture?.now ? new Date(fixture.now) : new Date();
  if (mode === 'claim') {
    const event = JSON.parse(readFileSync(String(eventPath), 'utf-8'));
    const verdict = claim(event, api, now);
    console.log(`${verdict.action}: ${verdict.why}`);
  } else if (mode === 'expire') {
    console.log(`freed: ${expire(api, now, repo).join(', ') || 'none'}`);
  } else {
    console.error('usage: claim.mjs claim <event.json> | expire [--fixture <file>]');
    process.exit(2);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(`claim.mjs failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
