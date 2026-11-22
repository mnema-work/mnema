/**
 * EVERY SURFACE THAT SERVES A RECORD SAYS WHERE A NEWER MNEMA WROTE (ADR-113, ADR-140).
 *
 * A line of a kind this binary does not know is read past: verified, named by `verify`, and left
 * out of every projection. A surface that served the record without it said nothing, so a reading
 * could be out of date by a line that moved a decision, and nothing on the screen showed it. Here
 * a record this binary wrote is given a line of a kind no version declares, appended as a newer
 * mnema on the machine would (`support/a-newer-mnema-writes.ts`), and each surface is asked: status
 * (text and `--json`), the brief (its document and its hook copy), `show` and `read_record` for the
 * record the line names as its subject, `bootstrap`, and `doctor`. The same record without the
 * line is asked the same questions and nothing is said.
 *
 * The sentences are quoted whole below, as literals, and not rebuilt from the function that words
 * them: a test that recomputed its expectation would pass with any sentence.
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { ListRootsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildMcpServer } from '../src/mcp/server.js';
import { renderPlain } from '../src/presentation/plain.js';
import type { CliIo } from '../src/program.js';
import { openSession } from '../src/repl/session.js';
import { REPL_VERB } from '../src/wiring/repl.js';
import { aNewerMnemaWrites, FUTURE } from './support/a-newer-mnema-writes.js';
import {
  ENDS_THE_INPUT,
  fakeTerminal,
  hooksNothing,
  until,
  withoutLayout,
} from './support/console.js';
import { GIT_WITHOUT_MAINTENANCE } from './support/git-without-maintenance.js';
import { codeOnly } from './support/reading-source.js';
import { MNEMA_CLI } from './support/the-cli.js';

const CLI = MNEMA_CLI;

const OF_THE_RECORD =
  'A newer mnema wrote 1 line into this record (1 of "x.from-the-future") that this one does not ' +
  'read or apply, so what it serves from this record may be out of date. Update mnema to read ' +
  'them, and do not guess what they say.';
const ABOUT_THIS_ONE =
  'A newer mnema wrote 1 line about this record (1 of "x.from-the-future") that this one does not ' +
  'read or apply, so what it shows of this record may be out of date. Update mnema to read them, ' +
  'and do not guess what they say.';

const AN_ID = /([0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12})/;

let sandbox: string;
let home: string;
let repo: string;

const ENV = () => ({
  PATH: process.env.PATH ?? '',
  HOME: home,
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_CONFIG_GLOBAL: GIT_WITHOUT_MAINTENANCE,
  GIT_AUTHOR_NAME: 'a',
  GIT_AUTHOR_EMAIL: 'a@example.invalid',
  GIT_COMMITTER_NAME: 'a',
  GIT_COMMITTER_EMAIL: 'a@example.invalid',
});

function mnema(...argv: string[]) {
  const ran = spawnSync(process.execPath, [CLI, ...argv], {
    cwd: repo,
    encoding: 'utf-8',
    env: ENV(),
  });
  return { status: ran.status, out: ran.stdout, err: ran.stderr };
}

/** One line of a kind no version declares, appended as a newer mnema writes it. */
const newerWrites = (line: { kind?: string; subject?: string } = {}) =>
  aNewerMnemaWrites({ record: join(repo, '.mnema'), home }, { means: 'something' }, line);

/** Records one decision and returns its id. */
function aDecision(): string {
  const decided = mnema('decision', 'record', 'Use Postgres', 'The team knows it.');
  expect(decided.status, decided.err).toBe(0);
  const id = AN_ID.exec(`${decided.out}${decided.err}`)?.[1];
  expect(id, decided.out).toBeDefined();
  return id as string;
}

/** Records one memory and returns its id: a record the line below does not name. */
function anotherRecord(): string {
  const wrote = mnema('memory', 'Another record.');
  expect(wrote.status, wrote.err).toBe(0);
  return AN_ID.exec(`${wrote.out}${wrote.err}`)?.[1] as string;
}

/** What the agent's tools answer, each by a client connected afresh. */
async function theTools(id: string, other: string): Promise<Record<string, string[]>> {
  const { server } = buildMcpServer({ cwd: repo, env: { home }, log: () => {} });
  const client = new Client(
    { name: 'claude-code', version: '1.0.0' },
    { capabilities: { roots: {} } },
  );
  client.setRequestHandler(ListRootsRequestSchema, () => ({
    roots: [{ uri: pathToFileURL(repo).href, name: repo }],
  }));
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await Promise.all([client.connect(clientSide), server.connect(serverSide)]);
  const called = async (name: string, args: Record<string, unknown> = {}) => {
    const reply = await client.callTool({ name, arguments: args });
    expect(reply.isError ?? false, `${name}: ${JSON.stringify(reply.content)}`).toBe(false);
    return (reply.content as { text: string }[]).map((block) => block.text);
  };
  const answers = {
    bootstrap: await called('bootstrap'),
    read_record: await called('read_record', { id }),
    read_another: await called('read_record', { id: other }),
    search: await called('search', { term: 'Postgres' }),
    resume: await called('resume'),
    focus: await called('focus'),
    governing_rules: await called('governing_rules', { path: 'src/a.ts' }),
    audit_timeline: await called('audit_timeline', { id }),
    audit_refs: await called('audit_refs', { id }),
    audit_accountability: await called('audit_accountability'),
    audit_exposure: await called('audit_exposure'),
    audit_antipatterns: await called('audit_antipatterns'),
  };
  await client.close();
  return answers;
}

beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), 'mnema-newer-says-'));
  home = join(sandbox, 'home');
  repo = join(sandbox, 'repo');
  mkdirSync(home);
  mkdirSync(repo);
  expect(spawnSync('git', ['init', '-q', '-b', 'main'], { cwd: repo, env: ENV() }).status).toBe(0);
  expect(mnema('init').status).toBe(0);
});

afterEach(() => {
  rmSync(sandbox, { recursive: true, force: true });
});

// Each case runs the binary a dozen times over; under the full suite one takes longer than the default.
describe('a record a newer mnema wrote a line into', { timeout: 120_000 }, () => {
  it('says so in status, the one line, above the lists it qualifies, and in --json', () => {
    aDecision();
    // Read once BEFORE the line: the cache on disk is warm, so what follows is the catch-up
    // reading an arrival, which is the path a session in the middle of work takes.
    expect(mnema('status').status).toBe(0);
    newerWrites();

    const status = mnema('status');
    expect(status.status, status.err).toBe(0);
    const lines = status.out.split('\n');
    expect(lines.filter((line) => line.includes('A newer mnema wrote'))).toEqual([OF_THE_RECORD]);
    expect(lines.indexOf(OF_THE_RECORD)).toBeLessThan(
      lines.findIndex((line) => line.includes('decisions in force')),
    );

    const json = mnema('status', '--json');
    expect(json.status, json.err).toBe(0);
    expect(JSON.parse(json.out).newerLines).toEqual({
      lines: 1,
      kinds: [{ kind: FUTURE, lines: 1 }],
    });
    // Beside the key that says how many events no commit holds yet: the record here is not committed,
    // so both are in the same answer, and neither hides the other.
    expect(JSON.parse(json.out)).toHaveProperty('eventsNotInGit');
    expect(status.out).toContain('Not in git yet:');
  });

  it('keeps saying it after a known line is written behind it, in this process and the next', () => {
    aDecision();
    expect(mnema('status').status).toBe(0);
    newerWrites();
    expect(mnema('status').out).toContain(OF_THE_RECORD);
    // A line this binary reads, appended after the unread one: the catch-up now folds an arrival
    // and must carry what it already knew of the line it read past.
    anotherRecord();
    expect(mnema('status').out).toContain(OF_THE_RECORD);
    expect(JSON.parse(mnema('status', '--json').out).newerLines.lines).toBe(1);
  });

  it('counts each line and each kind, and names no more than three kinds', () => {
    aDecision();
    for (const kind of [FUTURE, 'x.second', 'x.third', 'x.fourth', 'x.second'])
      newerWrites({ kind });
    const status = mnema('status');
    expect(status.out).toContain(
      'A newer mnema wrote 5 lines into this record (1 of "x.from-the-future", 2 of "x.second", ' +
        '1 of "x.third", and 1 more kinds) that this one does not read or apply',
    );
    expect(JSON.parse(mnema('status', '--json').out).newerLines).toEqual({
      lines: 5,
      kinds: [
        { kind: FUTURE, lines: 1 },
        { kind: 'x.second', lines: 2 },
        { kind: 'x.third', lines: 1 },
        { kind: 'x.fourth', lines: 1 },
      ],
    });
  });

  it('says so in the brief on the error stream, and never in the document', () => {
    aDecision();
    newerWrites();
    const document = mnema('brief');
    expect(document.status, document.err).toBe(0);
    expect(document.out).not.toContain('newer mnema');
    expect(document.err).toContain(OF_THE_RECORD);

    const hook = mnema('brief', '--hook');
    expect(hook.status, hook.err).toBe(0);
    expect(hook.out).not.toContain('newer mnema');
    expect(hook.err).toContain(OF_THE_RECORD);
  });

  it('says so in show for the record the line names, and for no other', () => {
    const id = aDecision();
    const otherId = anotherRecord();
    const before = mnema('show', id).out;
    newerWrites({ subject: id });

    const shown = mnema('show', id);
    expect(shown.status, shown.err).toBe(0);
    expect(shown.out).toBe(before);
    expect(shown.err).toContain(ABOUT_THIS_ONE);
    const asJson = mnema('show', id, '--json');
    expect(JSON.parse(asJson.out).id).toBe(id);
    expect(asJson.err).toContain(ABOUT_THIS_ONE);

    expect(mnema('show', otherId).err).not.toContain('newer mnema');
  });

  it('counts the same lines for one record in show and in read_record, whichever tree holds them', async () => {
    const id = aDecision();
    const otherId = anotherRecord();
    // Two lines about the decision in the committed tree, one in the private one: show used to
    // stop at the first tree holding the decision and count two, read_record counted three.
    newerWrites({ subject: id });
    newerWrites({ subject: id });
    expect(mnema('memory', '--scope', 'private', 'A private note.').status).toBe(0);
    aNewerMnemaWrites(
      { record: join(repo, '.git', 'mnema', '%2E', 'private'), home },
      { means: 'something' },
      { subject: id },
    );
    const shown = mnema('show', id);
    expect(shown.err).toContain('A newer mnema wrote 3 lines about this record (3 of ');
    const tools = await theTools(id, otherId);
    expect(tools.read_record?.join('\n')).toContain(
      'A newer mnema wrote 3 lines about this record (3 of ',
    );
  });

  it('keeps kinds that share a long prefix distinguishable in what it says', () => {
    aDecision();
    const prefix =
      'vendor.area.subsystem.module.thing.version-two.of-a-kind-with-a-very-long.name.';
    const kinds = ['created', 'updated', 'retired', 'restored', 'merged'].map((s) => prefix + s);
    for (const kind of kinds) newerWrites({ kind });
    const said = JSON.parse(mnema('status', '--json').out).newerLines.kinds.map(
      (one: { kind: string }) => one.kind,
    );
    expect(said).toEqual(kinds);
    const sentence = mnema('status')
      .out.split('\n')
      .find((l) => l.includes('A newer mnema wrote'));
    // Three kinds are named, and each reads differently from the others by its end.
    const named = [...(sentence ?? '').matchAll(/1 of "([^"]+)"/g)].map((m) => m[1]);
    expect(named).toHaveLength(3);
    expect(new Set(named).size).toBe(3);
    expect(named.map((n) => n?.slice(-7))).toEqual(['created', 'updated', 'retired']);
  });

  it('says so in show for a memory too, which is read over every tree and not the first', () => {
    aDecision();
    const memoryId = anotherRecord();
    newerWrites({ subject: memoryId });
    const shown = mnema('show', memoryId);
    expect(shown.status, shown.err).toBe(0);
    expect(shown.err).toContain(ABOUT_THIS_ONE);
  });

  it('says so in the finding of doctor, and in nothing else of its checklist', () => {
    aDecision();
    newerWrites();
    const doctor = mnema('doctor');
    expect(doctor.status, `${doctor.out}${doctor.err}`).toBe(0);
    expect(doctor.out.split('\n').filter((line) => line.includes('newer-mnema'))).toEqual([
      `to do · newer-mnema: ${OF_THE_RECORD}`,
    ]);
  });

  it('is said by bootstrap and by read_record to the agent, beside the payload', async () => {
    const id = aDecision();
    const otherId = anotherRecord();
    newerWrites({ subject: id });
    const tools = await theTools(id, otherId);
    expect(tools.bootstrap).toContain(OF_THE_RECORD);
    expect(
      JSON.parse(tools.bootstrap?.find((one) => one.startsWith('{')) as string).newerLines,
    ).toEqual({
      lines: 1,
      kinds: [{ kind: FUTURE, lines: 1 }],
    });
    expect(tools.read_record).toContain(ABOUT_THIS_ONE);
    // The sentence about the whole record rides on every read, a record the line does not name
    // included; the one about a single record only where that record is served.
    expect(tools.read_another).toContain(OF_THE_RECORD);
    expect(tools.read_another).not.toContain(ABOUT_THIS_ONE);
  });

  it.each([
    'search',
    'resume',
    'focus',
    'governing_rules',
    'audit_timeline',
    'audit_refs',
    'audit_accountability',
    'audit_exposure',
    'audit_antipatterns',
  ])("is said by the agent's %s, as one block before the payload", async (tool) => {
    const id = aDecision();
    newerWrites({ subject: id });
    const tools = await theTools(id, id);
    const blocks = tools[tool] ?? [];
    expect(blocks.filter((one) => one === OF_THE_RECORD)).toHaveLength(1);
    expect(blocks.indexOf(OF_THE_RECORD)).toBeLessThan(blocks.length - 1);
  });

  it.each([
    [['search', 'Postgres']],
    [['search', 'Postgres', '--json']],
    [['resume', '--actor', 'THE-ACTOR']],
    [['rules', 'src/a.ts']],
    [['rules', 'src/a.ts', '--json']],
    [['why', 'src/a.ts']],
    [['why', 'src/a.ts', '--json']],
  ])('is said by mnema %j on the error stream, and never in its output', (argv) => {
    aDecision();
    const actor = /mnid:[0-9a-f]+/.exec(mnema('audit', 'accountability').out)?.[0] ?? '';
    expect(actor).not.toBe('');
    newerWrites();
    const ran = mnema(...argv.map((one) => (one === 'THE-ACTOR' ? actor : one)));
    expect(ran.err).toContain(OF_THE_RECORD);
    expect(ran.out).not.toMatch(/newer.mnema|newerLines/);
  });
});

describe('a record no newer mnema wrote into', { timeout: 120_000 }, () => {
  it('is told nothing new by any surface', async () => {
    const id = aDecision();
    for (const argv of [
      ['status'],
      ['status', '--json'],
      ['brief'],
      ['brief', '--hook'],
      ['show', id],
      ['show', id, '--json'],
      ['doctor'],
      ['search', 'Postgres'],
      ['rules', 'src/a.ts'],
      ['why', 'src/a.ts'],
    ]) {
      const ran = mnema(...argv);
      expect(`${ran.out}${ran.err}`, argv.join(' ')).not.toMatch(/newer.mnema/);
    }
    expect(JSON.parse(mnema('status', '--json').out)).not.toHaveProperty('newerLines');
    const tools = await theTools(id, id);
    expect(JSON.stringify(tools)).not.toMatch(/newer.mnema|newerLines/);
  });
});

describe('the gate over a record a newer mnema wrote into', { timeout: 120_000 }, () => {
  const gate = (path: string) =>
    spawnSync(process.execPath, [CLI, 'before-a-write', '--host', 'cursor'], {
      cwd: repo,
      input: JSON.stringify({
        tool_name: 'Write',
        tool_input: { file_path: join(repo, path), content: 'a' },
        session_id: 's1',
        cwd: repo,
      }),
      encoding: 'utf-8',
      env: ENV(),
    });
  const asJson = (text: string) => JSON.stringify(text).slice(1, -1);

  function aRuleRefusingWritesAt(path: string): void {
    const id = aDecision();
    expect(mnema('decision', 'move', 'accept', id, '--note', 'agreed').status).toBe(0);
    expect(mnema('link', id, path, '--rel', 'refuses-a-write').status).toBe(0);
  }

  it('says the lines in the reason of a refusal, where the person is told what to do', () => {
    aRuleRefusingWritesAt('src/ledger');
    newerWrites();
    const refused = gate('src/ledger/a.ts');
    expect(refused.stdout).toContain('deny');
    expect(refused.stdout).toContain(asJson(OF_THE_RECORD));
  });

  it('says nothing of them when it lets a write through', () => {
    aRuleRefusingWritesAt('src/ledger');
    newerWrites();
    const passed = gate('src/free/a.ts');
    expect(passed.stdout).not.toContain('deny');
    expect(`${passed.stdout}${passed.stderr}`).not.toMatch(/newer.mnema|Update mnema/);
  });
});

/**
 * THE SHAPE, AND IT IS KEYED ON THE FILES THAT SAY THE FACT, so a verb that stops saying it lights
 * the file it stopped in. The behaviour above is what the binary prints; this is what a refactor
 * that moves the call away leaves green until a person reads the page.
 */
describe('the surfaces that say where a newer mnema wrote carry the fact where they read', () => {
  const SRC = join(import.meta.dirname, '..', 'src');
  const code = (relative: string) => codeOnly(readFileSync(join(SRC, relative), 'utf-8'));

  it.each(['search', 'resume', 'rules', 'why'])(
    '%s reads it with the sources it opened and prints it',
    (verb) => {
      expect(code(`commands/${verb}.ts`), `commands/${verb}.ts`).toContain('newerLinesIn(');
      expect(code(`wiring/${verb}.ts`), `wiring/${verb}.ts`).toContain('newerLinesNotice(');
    },
  );

  it('the agent hears it from the one door every read leaves by, and never from a write', () => {
    const server = code('mcp/server.ts');
    const door = server.slice(server.indexOf('function replied('));
    expect(door.slice(0, door.indexOf('\n}\n'))).toMatch(
      /wrote\s*\?\s*\[\]\s*:\s*newerLinesNotes\(session\)/,
    );
  });

  it('the gate carries it in the reason of a refusal or an asking, and nowhere else', () => {
    const meets = code('what-a-write-meets.ts');
    expect(meets).toContain('newerLinesOf(');
    expect(code('commands/before-a-write.ts')).not.toContain('newerLines');
  });
});

describe('the console over a record a newer mnema wrote into', { timeout: 120_000 }, () => {
  const opened = async (): Promise<string> => {
    const before = { cwd: process.cwd(), home: process.env.HOME };
    process.chdir(repo);
    process.env.HOME = home;
    try {
      const terminal = fakeTerminal({ columns: 200 });
      const io: CliIo = { out: () => undefined, err: () => undefined, fail: () => undefined };
      const closed = openSession({
        io,
        renderingAt: () => renderPlain,
        self: REPL_VERB,
        input: terminal.stdin,
        output: terminal.stdout,
        interactive: true,
        leaving: hooksNothing,
      });
      await until(() => terminal.bytes().includes('mnema>'), 'opened');
      terminal.type(ENDS_THE_INPUT);
      await closed;
      return withoutLayout(terminal.bytes());
    } finally {
      process.chdir(before.cwd);
      if (before.home === undefined) delete process.env.HOME;
      else process.env.HOME = before.home;
    }
  };

  it('says it under the tree that holds the lines, and says nothing over a record with none', async () => {
    aDecision();
    expect(await opened()).not.toMatch(/newer mnema/);
    newerWrites();
    expect(await opened()).toContain(OF_THE_RECORD);
  });
});

describe('the gate through the agent tool over a record a newer mnema wrote into', {
  timeout: 120_000,
}, () => {
  async function asked(path: string): Promise<string> {
    const { server } = buildMcpServer({ cwd: repo, env: { home }, log: () => {} });
    const client = new Client(
      { name: 'claude-code', version: '1.0.0' },
      { capabilities: { roots: {} } },
    );
    client.setRequestHandler(ListRootsRequestSchema, () => ({
      roots: [{ uri: pathToFileURL(repo).href, name: repo }],
    }));
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
    await Promise.all([client.connect(clientSide), server.connect(serverSide)]);
    const reply = await client.callTool({ name: 'rules_before_an_edit', arguments: { path } });
    await client.close();
    const text = (reply.content as { text: string }[]).map((one) => one.text).join('\n');
    const said = JSON.parse(text.slice(text.indexOf('{'))) as {
      hookSpecificOutput?: { permissionDecision?: string; permissionDecisionReason?: string };
    };
    return `${said.hookSpecificOutput?.permissionDecision ?? 'none'}\n${
      said.hookSpecificOutput?.permissionDecisionReason ?? ''
    }`;
  }

  function aRule(path: string, rel: string): void {
    const decided = mnema('decision', 'record', `Rule at ${path}`, 'Because.');
    const id = AN_ID.exec(`${decided.out}${decided.err}`)?.[1] as string;
    expect(mnema('decision', 'move', 'accept', id, '--note', 'agreed').status).toBe(0);
    expect(mnema('link', id, path, '--rel', rel).status).toBe(0);
  }

  it('says the lines in the reason of a deny and of an ask, and nothing when it lets a path through', async () => {
    aRule('src/ledger', 'refuses-a-write');
    aRule('src/billing', 'asks-for-a-person');
    newerWrites();
    const denied = await asked('src/ledger/a.ts');
    expect(denied).toMatch(/^deny/);
    expect(denied).toContain(OF_THE_RECORD);
    const held = await asked('src/billing/a.ts');
    expect(held).toMatch(/^(ask|deny)/);
    expect(held).toContain(OF_THE_RECORD);
    const passed = await asked('src/free/a.ts');
    expect(passed).not.toMatch(/newer mnema/);
  });
});
