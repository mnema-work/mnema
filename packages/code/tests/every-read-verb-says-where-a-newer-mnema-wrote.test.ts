/**
 * EVERY VERB THE PROGRAM DECLARES A READ SAYS WHERE A NEWER MNEMA WROTE, OR SAYS WHY IT NEED NOT (ADR-534).
 *
 * `a-record-says-where-a-newer-mnema-wrote.test.ts` proves the sentence for the surfaces somebody listed. A read
 * verb added tomorrow is in no list, and the day one of them serves the record without the sentence is the day a
 * reading is out of date by a line nobody told its reader about. So this guard does not hold a list of verbs: it
 * ENUMERATES them from the registration the program is built from (every leaf of every verb declared `reads`, the
 * members of a group answering one by one), as `every-writer-passes-the-check-that-refuses-a-damaged-record.test.ts`
 * enumerates the writers, and a read verb in neither table below is red.
 *
 * Each verb the first table names is run through the real binary over a record a newer mnema wrote a line into, in
 * a git repository and outside one, and must say the sentence on `err` (or, for the few that carry it in their own
 * report, in it), never on `out` where a pipe or `--json` reads. The same verb over the record without the line says
 * nothing, and its `--json` is byte for byte what it prints once the line is there. The second table holds the verbs that need not, each with its reason.
 *
 * The mutation that lights it: take `newerLinesNotice` out of one audit verb's wiring (`wiring/exposure.ts`), or the
 * field out of its command, and the verb is named.
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Command } from 'commander';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { renderPlain } from '../src/presentation/plain.js';
import { registerVerbs } from '../src/wiring/index.js';
import { aNewerMnemaWrites } from './support/a-newer-mnema-writes.js';
import { GIT_WITHOUT_MAINTENANCE } from './support/git-without-maintenance.js';
import { MNEMA_CLI } from './support/the-cli.js';

const SAID = /A newer mnema wrote 1 line (into|about) this record/;
const AN_ID = /([0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12})/;

interface Ids {
  readonly decision: string;
  readonly task: string;
  readonly actor: string;
}

/** Where the sentence is: on `err`, or in the verb's own report (which the verb prints on `out` or `err`). */
type Says = 'err' | 'in-its-report';

interface Case {
  readonly argv: (ids: Ids) => readonly string[];
  readonly says: Says;
  /** The verb answers with JSON when asked: `out` must stay the JSON and nothing else. */
  readonly json?: boolean;
  /** The words it says it in, where its report has its own (`verify` counts the lines as a census). */
  readonly inItsOwnWords?: RegExp;
}

const aVerbThatAnswers = (
  argv: (ids: Ids) => readonly string[],
  extra: Partial<Case> = {},
): Case => ({
  argv,
  says: 'err',
  ...extra,
});

/** Every read verb that serves what a record holds, by the words a person types. */
const SAYS: Readonly<Record<string, Case>> = {
  status: aVerbThatAnswers(() => ['status'], { says: 'in-its-report', json: true }),
  brief: aVerbThatAnswers(() => ['brief'], { json: false }),
  recall: aVerbThatAnswers(() => ['recall']),
  rules: aVerbThatAnswers(() => ['rules', 'src/a.ts'], { json: true }),
  'rules-file': aVerbThatAnswers(() => ['rules-file', '--host', 'cursor']),
  search: aVerbThatAnswers(() => ['search', 'Postgres'], { json: true }),
  show: aVerbThatAnswers((ids) => ['show', ids.decision], { json: true }),
  timeline: aVerbThatAnswers((ids) => ['timeline', ids.decision], { json: true }),
  refs: aVerbThatAnswers((ids) => ['refs', ids.decision], { json: true }),
  'audit accountability': aVerbThatAnswers(() => ['audit', 'accountability'], { json: true }),
  'audit antipatterns': aVerbThatAnswers(() => ['audit', 'antipatterns'], { json: true }),
  'audit exposure': aVerbThatAnswers(() => ['audit', 'exposure'], { json: true }),
  export: aVerbThatAnswers(() => ['export']),
  usage: aVerbThatAnswers(() => ['usage']),
  resume: aVerbThatAnswers((ids) => ['resume', '--actor', ids.actor], { json: true }),
  why: aVerbThatAnswers(() => ['why', 'src/a.ts'], { json: true }),
  commits: aVerbThatAnswers((ids) => ['commits', ids.decision], { json: true }),
  aging: aVerbThatAnswers(() => ['aging'], { json: true }),
  trailer: aVerbThatAnswers((ids) => ['trailer', ids.decision], { json: true }),
  diagram: aVerbThatAnswers((ids) => ['diagram', 'timeline', ids.decision]),
  site: aVerbThatAnswers(() => ['site']),
  'task next': aVerbThatAnswers((ids) => ['task', 'next', ids.task], { json: true }),
  'task guard': aVerbThatAnswers(
    (ids) => ['task', 'guard', 'start', ids.task, '--actor', ids.actor],
    {
      json: true,
    },
  ),
  'skill provenance': aVerbThatAnswers(() => ['skill', 'provenance'], { json: true }),
  verify: aVerbThatAnswers(() => ['verify'], {
    says: 'in-its-report',
    inItsOwnWords: /a newer mnema wrote them/,
  }),
  doctor: aVerbThatAnswers(() => ['doctor'], { says: 'in-its-report' }),
};

const NOT_A_RECORD = 'It reads no line of any record.';
const A_HOOK =
  'It is a host hook: it replies to the host in the host’s own reply and serves no record content (it looks up at most a switch or one record by id to judge the hook’s input), where a sentence on err reaches nobody and would repeat after every response; `brief --hook` carries the sentence to the session.';
const ONE_OF_THE = (what: string): string =>
  `It works over ${what} on disk and not over the record, so a line a newer mnema wrote is nothing it reads past.`;

/** The read verbs that need not say it, each with why. A verb here that is also above is red. */
const NEED_NOT: Readonly<Record<string, string>> = {
  repl: 'The console says it on its own door, when a tree is opened (`repl/session.ts`), proven by `a-record-says-where-a-newer-mnema-wrote.test.ts`.',
  instructions:
    'It writes the instructions block into the files of a host and reads no line of a record.',
  upgrade: NOT_A_RECORD,
  report: NOT_A_RECORD,
  tour: NOT_A_RECORD,
  completion: NOT_A_RECORD,
  tally: A_HOOK,
  handback: A_HOOK,
  settled: A_HOOK,
  'witness sigstore-check':
    'It reads the Sigstore bundles beside the checkpoints the verdict proved and no line of a record as content, and names a tree whose chain does not close as not read: where a newer mnema wrote is `mnema verify`\u2019s to say.',
  'stack list': ONE_OF_THE('the stacks installed'),
  'stack index': ONE_OF_THE('the stacks installed'),
  'stack show': ONE_OF_THE('the stacks installed'),
  'stack diff': ONE_OF_THE('the stacks installed'),
  'stack check': ONE_OF_THE('the stacks installed'),
};
const A_COPY =
  'It copies and checks the tails as files, byte for byte, the lines of a newer mnema included, and reads none of them as a record.';

// ---------------------------------------------------------------------------
// What the program declares
// ---------------------------------------------------------------------------

function everyLeaf(command: Command, path: string): string[] {
  if (command.commands.length === 0) return [path];
  return command.commands.flatMap((one) => everyLeaf(one, `${path} ${one.name()}`));
}

/** The invocations the program declares unable to change the record, by the words a person types. */
function theReadsOfTheCommandLine(): string[] {
  const io = { out: () => undefined, err: () => undefined, fail: () => undefined };
  const verbs = registerVerbs(new Command(), {
    io,
    render: renderPlain,
    renderingAt: () => renderPlain,
    pinnedRun: () => undefined,
  });
  const found: string[] = [];
  for (const verb of verbs) {
    const top = verb.act.name();
    if (verb.members === undefined) {
      if (verb.effect === 'reads') found.push(...everyLeaf(verb.act, top));
      continue;
    }
    for (const member of verb.members) {
      if (member.effect === 'reads')
        found.push(...everyLeaf(member.act, `${top} ${member.act.name()}`));
    }
  }
  return found.sort();
}

const needsNot = (path: string): string | undefined =>
  path.startsWith('backup ') ? A_COPY : NEED_NOT[path];

describe('the read verbs the program declares', () => {
  const reads = theReadsOfTheCommandLine();

  it('are each either run below or excused with a reason', () => {
    const unaccounted = reads.filter((path) => !(path in SAYS) && needsNot(path) === undefined);
    expect(unaccounted, 'a read verb that says nothing of where a newer mnema wrote').toEqual([]);
  });

  it('name no verb that is not a read, and none twice', () => {
    const stale = [...Object.keys(SAYS), ...Object.keys(NEED_NOT)].filter(
      (path) => !reads.includes(path),
    );
    expect(stale).toEqual([]);
    expect(Object.keys(SAYS).filter((path) => path in NEED_NOT)).toEqual([]);
  });

  it('are counted, so that a table that decayed into excuses cannot pass', () => {
    expect(Object.keys(SAYS).length).toBeGreaterThanOrEqual(26);
  });
});

// ---------------------------------------------------------------------------
// The binary, over a record a newer mnema wrote into, inside git and outside it
// ---------------------------------------------------------------------------

describe.each([
  { where: 'inside a git repository', git: true },
  { where: 'outside any git repository', git: false },
])('the read verbs $where', ({ git }) => {
  let sandbox: string;
  let home: string;
  let repo: string;
  let ids: Ids;

  const env = () => ({
    PATH: process.env.PATH ?? '',
    HOME: home,
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: GIT_WITHOUT_MAINTENANCE,
    GIT_AUTHOR_NAME: 'a',
    GIT_AUTHOR_EMAIL: 'a@example.invalid',
    GIT_COMMITTER_NAME: 'a',
    GIT_COMMITTER_EMAIL: 'a@example.invalid',
  });
  const mnema = (...argv: readonly string[]) => {
    const ran = spawnSync(process.execPath, [MNEMA_CLI, ...argv], {
      cwd: repo,
      encoding: 'utf-8',
      env: env(),
      timeout: 60_000,
    });
    return { status: ran.status, out: ran.stdout, err: ran.stderr };
  };
  const idOf = (text: string): string => AN_ID.exec(text)?.[1] as string;

  beforeAll(() => {
    sandbox = mkdtempSync(join(tmpdir(), 'mnema-every-read-newer-'));
    home = join(sandbox, 'home');
    repo = join(sandbox, 'repo');
    mkdirSync(home);
    mkdirSync(repo);
    if (git)
      expect(spawnSync('git', ['init', '-q', '-b', 'main'], { cwd: repo, env: env() }).status).toBe(
        0,
      );
    expect(mnema('init').status).toBe(0);
    const decision = mnema('decision', 'record', 'Use Postgres', 'The team knows it.');
    expect(decision.status, decision.err).toBe(0);
    const task = mnema('task', 'create', 'A task');
    expect(task.status, task.err).toBe(0);
    const who = mnema('audit', 'accountability');
    expect(who.status, who.err).toBe(0);
    ids = {
      decision: idOf(decision.out + decision.err),
      task: idOf(task.out + task.err),
      actor: /mnid:[0-9a-f]+/.exec(who.out + who.err)?.[0] as string,
    };
  }, 120_000);

  afterAll(() => {
    rmSync(sandbox, { recursive: true, force: true });
  });

  const cases = Object.entries(SAYS);
  const theJsonBefore: Record<string, string> = {};

  describe('over the record without the line', () => {
    it.each(cases)('%s says nothing of a newer mnema', (path, one) => {
      const ran = mnema(...one.argv(ids));
      expect(`${ran.out}${ran.err}`, `${path}\n${ran.err}`).not.toMatch(/newer mnema/i);
      if (one.json === true) theJsonBefore[path] = mnema(...one.argv(ids), '--json').out;
    });
  });

  describe('over the record a newer mnema wrote a line into', () => {
    beforeAll(() => {
      // About the decision, so that the verbs that serve one record say the sentence about it.
      aNewerMnemaWrites(
        { record: join(repo, '.mnema'), home },
        { means: 'something' },
        { subject: ids.decision },
      );
    });

    it.each(cases)('%s says it', (path, one) => {
      const ran = mnema(...one.argv(ids));
      const said = one.says === 'err' ? ran.err : `${ran.out}${ran.err}`;
      expect(said, `${path}: ${ran.status}\n${ran.err}`).toMatch(one.inItsOwnWords ?? SAID);
      if (one.says === 'err') expect(ran.out, `${path} out`).not.toMatch(SAID);
    });

    it.each(cases.filter(([, one]) => one.json === true))(
      '%s keeps --json the machine-readable thing, the sentence on err',
      (path, one) => {
        const ran = mnema(...one.argv(ids), '--json');
        expect(ran.status, `${path}\n${ran.err}`).toBe(0);
        expect(() => JSON.parse(ran.out), `${path} out`).not.toThrow();
        // Byte for byte what it printed before the line was planted.
        // `status` is the one that carries it in its JSON, by design: it says it in its own report.
        if (one.says === 'err')
          expect(ran.out, `${path} out differs from the record without the line`).toBe(
            theJsonBefore[path],
          );
        if (one.says === 'err') expect(ran.err, path).toMatch(SAID);
      },
    );
  });
});
