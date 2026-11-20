#!/usr/bin/env node
/**
 * A CLAIMED ISSUE IS ASSIGNED, AND FREED AFTER 14 DAYS WITHOUT A PULL REQUEST (ADR-582, which
 * replaces ADR-532; the reminders on a stale outside pull request are ADR-555).
 *
 * Four things run from `.github/workflows/claim-an-issue.yml`, and every decision in them is a pure
 * function here that a test imports:
 *
 *   node .github/assign-a-claimed-issue/claim.mjs claim "$GITHUB_EVENT_PATH"
 *     A comment was created. If it is a claim on an open `good first issue` or `help wanted` issue
 *     (not a pull request) by someone who is not a bot and not OWNER, MEMBER or COLLABORATOR, the
 *     commenter is assigned when nobody holds the issue and holds fewer than 3 issues this workflow
 *     assigned to them; otherwise one reply says why not. An issue that says it starts after another
 *     ("Starts after ..." or "do not take this one until ...", with the `#N` of the pieces it waits
 *     on) is not assigned while one of them is open: one reply names them and suggests taking one.
 *     A comment that reads as an intent to take
 *     the issue but matches no phrase gets one reply on how to claim (`/take`), without its text.
 *   node .github/assign-a-claimed-issue/claim.mjs expire
 *     Daily. An open issue assigned to an outside contributor, 14 days after the assignment (this
 *     workflow's or a maintainer's by hand), whose assignee has no open pull request that names the
 *     issue, is unassigned and says so. A maintainer's own assignment is never freed, an issue
 *     without a contributor label is ours and is left alone, and an issue still waiting on an open
 *     blocker keeps its assignee.
 *   node .github/assign-a-claimed-issue/claim.mjs adopt
 *     Daily. The author of an open pull request that closes (fixes, closes, resolves) an open,
 *     unassigned contributor issue is assigned to it, once, with a note on the issue.
 *   node .github/assign-a-claimed-issue/claim.mjs remind
 *     Daily. An open outside pull request whose last event is a maintainer's request gets, at 7 days
 *     without an answer from its author, one reminder that starts with the author's login, and at 14
 *     days one note that the maintainers will finish it on the branch or close it with thanks. It
 *     only comments: it never pushes, merges or closes.
 *
 * THE TEXT OF THE COMMENT IS DATA. It is read from the event file GitHub wrote, matched against
 * phrases and put nowhere else: not in a shell line, not in a reply. The calls to GitHub go
 * through `gh` with an argument list, never through a shell.
 *
 * HOW IT KNOWS ITS OWN ASSIGNMENTS. The reply that assigns carries a hidden marker with the date
 * and the login, and the reply that frees carries another. Only comments written by the workflow's
 * own account count. An assignment with no marker for the assignee (a maintainer's by hand) is dated
 * by the issue's own `assigned` event, and its assignee is freed only when not a collaborator of
 * the repository: when that cannot be told, the assignee is taken for a maintainer.
 *
 * WHAT IT DOES NOT DO. It does not judge a claim (whether the person can do the work), it does not
 * read a pull request beyond who wrote it, what it closes and who last spoke on it, and a merged
 * pull request needs nothing from it: the merge closes the issue. Pull requests are read, never
 * written to except by a comment.
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
 *   pull: (number: number) => Json,
 *   reviews: (number: number) => Json[],
 *   pullCommits: (number: number) => Json[],
 *   assignedAt: (number: number, login: string) => Date | null,
 *   isMaintainer: (login: string) => boolean,
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
  'can i work on it',
  'can i take it',
  'could i work on this',
  'could i work on it',
  'could i take it',
  "i'd like to work on it",
  'i would like to work on it',
  "i'll work on it",
  'i will work on it',
  "i'll take it",
  'i will take it',
  "i'm working on this",
  'i am working on this',
  "i'm claiming this",
  'claiming this',
  'assign me',
  'please assign me',
  'assign this to me',
  'assign it to me',
  '/take',
  '/claim',
];

/**
 * The issues a body says it waits on: the `#N` in the paragraph that starts at "Starts after" or
 * "do not take this one until", so the `Part of #N` before it and any `#N` after the blank line are
 * not read. Only digits are taken from the text, and it is the maintainers' text, never a comment.
 *
 * @param {string | null | undefined} body
 * @returns {number[]}
 */
export function blockersOf(body) {
  const text = String(body ?? '');
  const start = text.search(/starts after|do not take this one until/i);
  if (start < 0) return [];
  const paragraph = text.slice(start).split(/\r?\n\s*\r?\n/)[0] ?? '';
  const numbers = new Set();
  for (const found of paragraph.matchAll(/(?<![\w/.#-])#(\d+)(?!\d)/g))
    numbers.add(Number(found[1]));
  return [...numbers];
}

/** @param {string} text */
const escapeForRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');

/**
 * The phrases that say what the person is doing ("working on", "claiming"): they claim only as said
 * in the first person and ended at "this" (or "it"), where a bare "working on this" is as often
 * said about someone else or about a file. "claiming this" has no "I", so it claims only where a
 * sentence starts.
 */
const DOING = new Set([
  "i'm working on this",
  'i am working on this',
  "i'm claiming this",
  'claiming this',
]);
const STARTS_A_SENTENCE = new Set(['claiming this']);

/** What may follow a doing phrase: the end, a mark, or the few words that finish the thought. */
const ENDS_THE_THOUGHT = String.raw`(?=\s*(?:[.!?,;:]|$)|\s+(?:to|and|now|today|soon|please|thanks)\b)`;

/**
 * What may follow any other phrase but a command: the end, a mark, or a word that finishes the
 * request. "to" alone is not one ("I can take this to mean ..."), "to this" or "to it" is ("assign
 * me to this"); "into account", "as a no" and "up with the team" are not requests.
 */
const ENDS_THE_REQUEST = String.raw`(?=\s*(?:[.!?,;:]|$)|\s+(?:on|and|now|today|soon|please|thanks|if|first|tomorrow|this week|to (?:this|it))\b)`;

/** The commands, which stand alone and need nothing after them. */
const COMMANDS = new Set(['/take', '/claim']);

/** The phrases as one pattern, whole words, found anywhere (a new one for each reading: it is global). */
const claimPattern = () =>
  new RegExp(
    CLAIM_PHRASES.map((phrase) => {
      const before = STARTS_A_SENTENCE.has(phrase) ? String.raw`(?<=^\s*)` : '';
      const after = DOING.has(phrase)
        ? ENDS_THE_THOUGHT
        : COMMANDS.has(phrase)
          ? ''
          : ENDS_THE_REQUEST;
      return `${before}(?<![\\w/])${escapeForRegExp(phrase)}(?![\\w/])${after}`;
    }).join('|'),
    'g',
  );

/** What stands right before a phrase and turns it round: "do not", "don't", "never", "no need to". */
const NEGATION =
  /(?:\bnot|n't|\bnever|\bno need to|\bno need for you to)(?:\s+(?:be|going to|gonna|planning to|able to))*\s+$/;

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

/** The sentences of a normalised text, each with its closing mark. @param {string} said */
const sentencesOf = (said) => said.match(/[^.!?]+[.!?]*/g) ?? [];

/** A question asks for nothing to take, unless it is the request itself ("can i ..."). */
const ASKS_LEAVE = /^(?:can|could|may) i\b/;

/** Whether the comment claims the issue it is on, a negated phrase not counting. @param {string} text */
export const isClaim = (text) => {
  for (const sentence of sentencesOf(normalise(text))) {
    const question = sentence.trimEnd().endsWith('?');
    for (const found of sentence.matchAll(claimPattern())) {
      if (NEGATION.test(sentence.slice(0, found.index))) continue;
      if (question && !ASKS_LEAVE.test(found[0])) continue;
      return true;
    }
  }
  return false;
};

/**
 * What reads as an intent to take the issue without being one of the phrases: the person ("I", "I'm",
 * "I'd", "let me") right before "claim", "take", "work on", "tackle" or "pick up" with "this" or "it",
 * and the sentence ending there (or after "on", "up", "now", "if ..."): "I'm taking it from here, the
 * crash also happens" is about something else. Or "assign" with "me". Said as a plain sentence, not
 * as a question (but "can I ..." is the request), and not after a no.
 */
const NEAR_MISS = new RegExp(
  String.raw`\b(?:i(?:'m| am|'d|'ll| would| will| can| could| might| may)?|let me)` +
    String.raw`(?:\s+(?:like to|want to|wanna|going to|plan to|planning to))?\s+` +
    String.raw`(?:(?:claim(?:ing)?|tak(?:e|ing)|work(?:ing)? on|tackl(?:e|ing))\s+(?:this|it)|pick(?:ing)?\s+(?:this|it)\s+up|pick(?:ing)?\s+up\s+(?:this|it))` +
    String.raw`(?:\s+(?:on|up))?(?:\s+(?:now|today|soon|tomorrow|this week|first|then|if\b[^.!?]*))?\s*(?:[.!?,;:]|$)` +
    String.raw`|\bassign\b[^.!?]{0,20}\bme\b|\bassign\s+(?:this|it)\s+to\s+me\b`,
);

/**
 * Whether the comment reads as an intent to take the issue that no phrase matches, for the one
 * reply that says how to claim. @param {string} text
 */
export const readsAsAClaim = (text) => {
  if (isClaim(text)) return false;
  for (const sentence of sentencesOf(normalise(text))) {
    const found = NEAR_MISS.exec(sentence);
    if (!found || NEGATION.test(sentence.slice(0, found.index))) continue;
    const question = sentence.trimEnd().endsWith('?');
    if (!question || /\b(?:can|could|may|might|shall) i\b/.test(sentence)) return true;
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
 * @returns {{ action: 'assign' | 'taken' | 'cap' | 'hint' | 'ignore', why: string }}
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
  const said = isClaim(comment.body);
  if (!said && !readsAsAClaim(comment.body)) return { action: 'ignore', why: 'not a claim' };
  const holders = issue.assignees.map((login) => login.toLowerCase());
  if (holders.includes(comment.login.toLowerCase())) {
    return { action: 'ignore', why: 'already theirs' };
  }
  if (!said) {
    return holders.length > 0
      ? { action: 'ignore', why: 'someone holds it' }
      : { action: 'hint', why: 'reads as a claim, matches no phrase' };
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
/** @param {string} login */
export const blockedMarker = (login) => `<!-- claim-an-issue:blocked login=${login} -->`;
/** @param {string} login */
export const hintMarker = (login) => `<!-- claim-an-issue:hint login=${login} -->`;
/** @param {number} pull @param {string} since */
export const remindedMarker = (pull, since) =>
  `<!-- claim-an-issue:reminded pull=${pull} since=${since} -->`;
/** @param {number} pull @param {string} since */
export const finishMarker = (pull, since) =>
  `<!-- claim-an-issue:finish pull=${pull} since=${since} -->`;
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
  /** @param {string} login @param {number[]} blockers */
  blocked: (login, blockers) => {
    const names = blockers.map((one) => `#${one}`);
    const list =
      names.length === 1
        ? String(names[0])
        : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
    return [
      blockedMarker(login),
      `Thanks, @${login}: this issue starts only after ${list} ${blockers.length === 1 ? 'is' : 'are'} done, so it is not assigned yet.`,
      '',
      `${blockers.length === 1 ? 'That one is' : 'Those are'} open to take now: comment \`/take\` on ${blockers.length === 1 ? 'it' : 'one of them'}. This issue can be taken once ${blockers.length === 1 ? 'it is' : 'they are'} merged.`,
    ].join('\n');
  },
  /** @param {string} login */
  cap: (login) =>
    [
      `Thanks, @${login}: you already hold ${MOST_HELD} issues here that were assigned this way.`,
      '',
      'Please finish one, or let one go by saying so on it, before taking another.',
    ].join('\n'),
  /** @param {string} login */
  hint: (login) =>
    [
      hintMarker(login),
      `Thanks, @${login}. To take this issue, comment \`/take\` on it, on a line of its own.`,
      '',
      `If nobody holds it and you hold fewer than ${MOST_HELD} issues assigned this way, it is assigned to you.`,
    ].join('\n'),
  /** @param {string} login @param {number} pull @param {Date} now */
  adopted: (login, pull, now) =>
    [
      assignedMarker(now, login),
      `This issue is yours, @${login}: your pull request #${pull} closes it.`,
      '',
      `The assignment frees itself after ${DAYS_TO_FREE} days without an open pull request that names this issue.`,
    ].join('\n'),
  /** @param {string} login @param {number} pull @param {string} since */
  reminder: (login, pull, since) =>
    [
      remindedMarker(pull, since),
      `@${login}, this pull request has been waiting for your answer for 7 days.`,
      '',
      'A maintainer asked for a change. Push it, or reply here if you need more time or help with it. If you cannot finish, say so: that is fine, and nothing is lost.',
    ].join('\n'),
  /** @param {string} login @param {number} pull @param {string} since @param {boolean} canModify */
  finish: (login, pull, since, canModify) =>
    [
      finishMarker(pull, since),
      `@${login}, it has been 14 days without an answer on this pull request.`,
      '',
      canModify
        ? 'The maintainers will finish it on your branch, merge it and thank you here; the credit stays yours.'
        : 'The maintainers cannot push to your branch, so they will close this pull request with thanks and free its issue. Reopening it, or opening a new one, is always welcome.',
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
    pull: (number) => JSON.parse(run(['api', `repos/${repo}/pulls/${number}`])),
    reviews: (number) => list(`repos/${repo}/pulls/${number}/reviews?per_page=100`),
    pullCommits: (number) => list(`repos/${repo}/pulls/${number}/commits?per_page=100`),
    assignedAt: (number, login) => {
      const events = list(`repos/${repo}/issues/${number}/events?per_page=100`).filter(
        (one) =>
          one.event === 'assigned' &&
          String(one.assignee?.login ?? '').toLowerCase() === login.toLowerCase(),
      );
      const last = events.at(-1);
      return last ? new Date(last.created_at) : null;
    },
    // A collaborator answers 204 and a stranger 404. Any other answer (a token that may not ask)
    // is taken for a maintainer, so that what cannot be told is never freed.
    isMaintainer: (login) => {
      try {
        run(['api', `repos/${repo}/collaborators/${encodeURIComponent(login)}`]);
        return true;
      } catch (error) {
        const said = `${(/** @type {Json} */ (error)).stderr ?? ''}${(/** @type {Json} */ (error)).message ?? ''}`;
        return !/\b404\b/.test(said);
      }
    },
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
    pull: (number) =>
      (fixture.pulls ?? []).find((/** @type {Json} */ one) => one.number === number),
    reviews: (number) => fixture.reviews?.[String(number)] ?? [],
    pullCommits: (number) => fixture.commits?.[String(number)] ?? [],
    assignedAt: (number, login) => {
      const at = fixture.assignedAt?.[`${number}:${login.toLowerCase()}`];
      return at ? new Date(at) : null;
    },
    isMaintainer: (login) =>
      (fixture.maintainers ?? []).some(
        (/** @type {string} */ one) => one.toLowerCase() === login.toLowerCase(),
      ),
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

/** Whether this workflow already told `login` on this issue that it is blocked. @param {Json[]} comments @param {string} login */
const toldBlocked = (comments, login) =>
  comments.some(
    (c) => c.user?.login === OUR_ACCOUNT && String(c.body ?? '').includes(blockedMarker(login)),
  );

/**
 * The issues `issue` waits on that are still open. One that cannot be read counts as open: the
 * safe answer for an issue that says it must wait.
 *
 * @param {Api} api
 * @param {Json} issue
 * @returns {number[]}
 */
export function openBlockers(api, issue) {
  return blockersOf(issue.body).filter((number) => {
    if (number === issue.number) return false;
    try {
      const one = api.issue(number);
      return one?.state !== 'closed';
    } catch {
      return true;
    }
  });
}

/** Whether this workflow already told `login` on this issue how to claim. @param {Json[]} comments @param {string} login */
const toldHint = (comments, login) =>
  comments.some(
    (c) => c.user?.login === OUR_ACCOUNT && String(c.body ?? '').includes(hintMarker(login)),
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
  // The blockers and what the commenter already holds are asked of GitHub only for a claim that would be granted.
  if (verdict.action === 'assign') {
    const waiting = openBlockers(api, issue);
    if (waiting.length > 0) {
      if (!toldBlocked(api.comments(number), login))
        api.comment(number, replies.blocked(login, waiting));
      return { action: 'blocked', why: `waits on ${waiting.join(', ')}` };
    }
    verdict = ask(heldBy(api, login, number));
  }
  if (verdict.action === 'taken' && !toldTaken(api.comments(number), login)) {
    api.comment(number, replies.taken(login));
  }
  if (verdict.action === 'cap') api.comment(number, replies.cap(login));
  if (verdict.action === 'hint' && !toldHint(api.comments(number), login)) {
    api.comment(number, replies.hint(login));
  }
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
 * The daily run: what has no pull request after 14 days is freed. An assignment this workflow made
 * is dated by its marker; one a maintainer made by hand, to a person who is not a collaborator, by
 * the issue's `assigned` event. An issue with no contributor label is ours and is left alone.
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
    const assignees = loginsOf(issue);
    if (assignees.length !== 1) continue;
    const only = String(assignees[0]);
    let assignment = assignmentOf(api.comments(issue.number));
    if (assignment?.login.toLowerCase() !== only.toLowerCase()) {
      // Not this workflow's: a hand assignment, to a contributor, on an issue open to contributors.
      const labels = labelsOf(issue).map((/** @type {string} */ one) => one.toLowerCase());
      if (!CLAIMABLE_LABELS.some((one) => labels.includes(one))) continue;
      if (api.isMaintainer(only)) continue;
      const at = api.assignedAt(issue.number, only);
      if (!at) continue;
      assignment = { at, login: only };
    }
    pulls ??= api.openPulls();
    const verdict = expiry({
      now,
      number: issue.number,
      assignment,
      assignees,
      pulls,
      repo,
    });
    if (!verdict.free) continue;
    if (openBlockers(api, issue).length > 0) continue;
    const who = String(verdict.login);
    api.unassign(issue.number, who);
    api.comment(issue.number, replies.freed(who, now));
    freed.push(issue.number);
  }
  return freed;
}

const CLOSING =
  /\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s*:?\s+(?:([\w.-]+\/[\w.-]+)?#(\d+)|https?:\/\/github\.com\/([\w.-]+\/[\w.-]+)\/issues\/(\d+))(?!\d)/gi;

/**
 * The issues of this repository a pull request closes with a closing keyword in its title or body.
 *
 * @param {Json} pull
 * @param {string} repo
 * @returns {number[]}
 */
export function closedBy(pull, repo) {
  const text = `${pull.title ?? ''}\n${pull.body ?? ''}`;
  const numbers = new Set();
  for (const found of text.matchAll(CLOSING)) {
    const where = found[1] ?? found[3];
    if (where && where.toLowerCase() !== repo.toLowerCase()) continue;
    numbers.add(Number(found[2] ?? found[4]));
  }
  return [...numbers];
}

/** Whether a pull request is from someone outside: not a bot, not OWNER, MEMBER or COLLABORATOR. @param {Json} pull */
const fromOutside = (pull) =>
  pull.user?.type !== 'Bot' &&
  !String(pull.user?.login ?? '').endsWith('[bot]') &&
  !MAINTAINER_ASSOCIATIONS.includes(pull.author_association);

/**
 * The daily run that assigns the author of an open pull request that closes an open, unassigned
 * contributor issue, once, with a note on the issue. The per-person limit holds: an author at it is
 * left as they are, and nothing is said.
 *
 * @param {Api} api
 * @param {Date} [now]
 * @param {string} [repo]
 * @returns {number[]} the issues it assigned
 */
export function adopt(api, now = new Date(), repo = '') {
  const assigned = [];
  for (const pull of api.openPulls()) {
    if (!fromOutside(pull)) continue;
    const login = String(pull.user?.login ?? '');
    for (const number of closedBy(pull, repo)) {
      /** @type {Json} */
      let issue = null;
      try {
        issue = api.issue(number);
      } catch {
        continue; // a number that is not an issue here
      }
      if (!issue || issue.pull_request || issue.state !== 'open') continue;
      if (loginsOf(issue).length > 0) continue;
      const labels = labelsOf(issue).map((/** @type {string} */ one) => one.toLowerCase());
      if (!CLAIMABLE_LABELS.some((one) => labels.includes(one))) continue;
      if (heldBy(api, login, number) >= MOST_HELD) continue;
      api.assign(number, login);
      api.comment(number, replies.adopted(login, pull.number, now));
      assigned.push(number);
    }
  }
  return assigned;
}

export const REMIND_AFTER_DAYS = 7;
export const FINISH_AFTER_DAYS = 14;

/**
 * When an outside pull request began waiting on its author: the time of the maintainer's last
 * request if nothing came after it, else null. A request is a review that asks for changes, or a
 * maintainer's comment that names the author by @login (a review that only comments, or a plain
 * comment, is not one). The author answers with a comment or a review of theirs, or with any commit
 * pushed after it, whatever its author field says (a commit whose e-mail is linked to no account has
 * none); a maintainer's approval ends the wait.
 *
 * @param {Json} pull
 * @param {Json[]} comments
 * @param {Json[]} reviews
 * @param {Json[]} commits
 * @returns {Date | null}
 */
export function waitingSince(pull, comments, reviews, commits) {
  const author = String(pull.user?.login ?? '').toLowerCase();
  const names = new RegExp(`(?<![\\w-])@${escapeForRegExp(author)}(?![\\w-])`, 'i');
  /** @type {{ at: Date, kind: 'ask' | 'author' | 'approved' }[]} */
  const events = [];
  /** @param {string|undefined} when @param {'ask' | 'author' | 'approved'} kind */
  const add = (when, kind) => {
    const at = new Date(String(when));
    if (!Number.isNaN(at.getTime())) events.push({ at, kind });
  };
  for (const c of comments) {
    const who = String(c.user?.login ?? '').toLowerCase();
    if (who === author) add(c.created_at, 'author');
    else if (
      MAINTAINER_ASSOCIATIONS.includes(c.author_association) &&
      c.user?.type !== 'Bot' &&
      names.test(String(c.body ?? ''))
    ) {
      add(c.created_at, 'ask');
    }
  }
  for (const r of reviews) {
    const who = String(r.user?.login ?? '').toLowerCase();
    if (who === author) add(r.submitted_at, 'author');
    else if (MAINTAINER_ASSOCIATIONS.includes(r.author_association)) {
      if (r.state === 'CHANGES_REQUESTED') add(r.submitted_at, 'ask');
      else if (r.state === 'APPROVED') add(r.submitted_at, 'approved');
    }
  }
  for (const c of commits) add(c.commit?.committer?.date ?? c.commit?.author?.date, 'author');
  events.sort((a, b) => a.at.getTime() - b.at.getTime());
  const last = events.at(-1);
  return last?.kind === 'ask' ? last.at : null;
}

/**
 * The daily run over the open outside pull requests that wait on their author: one reminder that
 * starts with their login at 7 days, one note at 14. Each is said once for each request it follows.
 * It only comments.
 *
 * @param {Api} api
 * @param {Date} [now]
 * @returns {{ pull: number, said: string }[]}
 */
export function remind(api, now = new Date()) {
  const said = [];
  for (const listed of api.openPulls()) {
    if (!fromOutside(listed) || listed.draft) continue;
    const number = listed.number;
    const comments = api.comments(number);
    const since = waitingSince(listed, comments, api.reviews(number), api.pullCommits(number));
    if (!since) continue;
    const days = (now.getTime() - since.getTime()) / DAY;
    if (days < REMIND_AFTER_DAYS) continue;
    const login = String(listed.user?.login ?? '');
    const stamp = since.toISOString();
    const ours = comments.filter((c) => c.user?.login === OUR_ACCOUNT);
    const has = (/** @type {string} */ marker) =>
      ours.some((c) => String(c.body ?? '').includes(marker));
    if (days >= FINISH_AFTER_DAYS) {
      if (has(finishMarker(number, stamp))) continue;
      const canModify = Boolean(api.pull(number)?.maintainer_can_modify);
      api.comment(number, replies.finish(login, number, stamp, canModify));
      said.push({ pull: number, said: 'finish' });
    } else if (!has(remindedMarker(number, stamp))) {
      api.comment(number, replies.reminder(login, number, stamp));
      said.push({ pull: number, said: 'reminder' });
    }
  }
  return said;
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
  } else if (mode === 'adopt') {
    console.log(`assigned: ${adopt(api, now, repo).join(', ') || 'none'}`);
  } else if (mode === 'remind') {
    const said = remind(api, now);
    console.log(`said: ${said.map((one) => `${one.said} on #${one.pull}`).join(', ') || 'none'}`);
  } else {
    console.error(
      'usage: claim.mjs claim <event.json> | expire | adopt | remind [--fixture <file>]',
    );
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
