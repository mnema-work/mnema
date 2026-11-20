/**
 * AN AGENT'S ACCEPT RESTS ON THE PERSON'S WORDS, OR IT WAITS FOR THE PERSON.
 *
 * Both doors (the command with `--which` and the MCP tool) look for the passages the note quotes in
 * what the person typed in this session's transcript, whose path the SessionStart hook left beside
 * the session journal, and in the answers given in the host's question tool. Each case reads the
 * record back off the disk and never trusts what a refusal said about itself.
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { ListRootsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { isPureAssent, quotedPassages, whatTheAcceptRestsOn } from '../src/agent-accept-words.js';
import { HOST_NAMES } from '../src/host-names.js';
import { HOST_WORDS, hostOfAgent, hostSessionOf } from '../src/host-words.js';
import { buildMcpServer } from '../src/mcp/server.js';
import { GIT_WITHOUT_MAINTENANCE } from './support/git-without-maintenance.js';
import { MNEMA_CLI } from './support/the-cli.js';
import { held } from './support/the-record-held.js';

const SESSION = '0b6f5a4e-1d2c-4e8a-9f10-5c7d3a2b1e00';

let sandbox: string;
let home: string;
let project: string;
let transcript: string;

const env = (extra: Record<string, string> = {}) => ({
  PATH: process.env.PATH ?? '',
  HOME: home,
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_CONFIG_GLOBAL: GIT_WITHOUT_MAINTENANCE,
  ...extra,
});

function mnema(extra: Record<string, string>, input: string | undefined, ...argv: string[]) {
  const ran = spawnSync(process.execPath, [MNEMA_CLI, ...argv], {
    cwd: project,
    encoding: 'utf-8',
    env: env(extra),
    ...(input === undefined ? {} : { input }),
  });
  return { status: ran.status, out: `${ran.stdout}${ran.stderr}` };
}

const idOf = (printed: string): string => /[0-9a-f]{8}-[0-9a-f-]{27}/.exec(printed)?.[0] as string;

/** A line of Claude Code's transcript: what a person typed. */
const typed = (text: string) =>
  JSON.stringify({
    type: 'user',
    origin: { kind: 'human' },
    message: { role: 'user', content: text },
  });

/** A line of Claude Code's transcript: the answer a person gave in the question tool. */
const chose = (question: string, option: string) =>
  JSON.stringify({
    type: 'user',
    message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 't1', content: 'ok' }] },
    toolUseResult: { answers: { [question]: option } },
  });

/** What the host's SessionStart hook hands the plugin: the session and where its transcript is. */
function theSessionOpens(): void {
  const told = mnema(
    {},
    JSON.stringify({
      hook_event_name: 'SessionStart',
      session_id: SESSION,
      transcript_path: transcript,
    }),
    'tally',
  );
  expect(told.status, told.out).toBe(0);
}

function aProposedDecision(): string {
  expect(mnema({}, undefined, 'init').status).toBe(0);
  const recorded = mnema({}, undefined, 'decision', 'record', 'Keep the cache', 'because');
  expect(recorded.status, recorded.out).toBe(0);
  return idOf(recorded.out);
}

const state = (id: string): string => mnema({}, undefined, 'show', id).out;

function accept(id: string, note: string, extra: Record<string, string> = {}) {
  return mnema(
    { CLAUDE_CODE_SESSION_ID: SESSION, ...extra },
    undefined,
    'decision',
    'move',
    'accept',
    id,
    '--which',
    'claude-code',
    '--note',
    note,
  );
}

beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), 'mnema-words-'));
  home = join(sandbox, 'home');
  project = join(sandbox, 'project');
  mkdirSync(home);
  mkdirSync(project);
  transcript = join(sandbox, `${SESSION}.jsonl`);
});
afterEach(() => {
  rmSync(sandbox, { recursive: true, force: true });
});

describe('the passages a note quotes', () => {
  it('reads straight, curly and Portuguese quotes of twenty characters or more, folded, and no pure assent', () => {
    expect(
      quotedPassages(
        'He said "Keep   The Cache between runs", “use WAL mode for the cache” and «faz assim e depois isso», not "no", not "please", not "sim, pode ir em frente, claro".',
      ),
    ).toEqual([
      'keep the cache between runs',
      'use wal mode for the cache',
      'faz assim e depois isso',
    ]);
  });
});

describe('the host table: one row for every host', () => {
  const spellings = (name: string) => [
    name,
    name.toUpperCase(),
    name.replaceAll('-', '_'),
    name.replaceAll('-', ''),
    name
      .split('-')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join('-'),
  ];

  it('has a row for every host the product supports', () => {
    expect(Object.keys(HOST_WORDS).sort()).toEqual([...HOST_NAMES].sort());
  });

  for (const host of HOST_NAMES) {
    const row = HOST_WORDS[host];

    it(`${host}: every name it declares, in any spelling, is that host`, () => {
      for (const name of row.names) {
        for (const spelling of spellings(name)) expect(hostOfAgent(spelling), spelling).toBe(host);
      }
    });

    it(`${host}: ${row.reads ? 'reads the words and needs its session id' : 'is not readable yet and passes as not checked'}`, () => {
      writeFileSync(transcript, `${typed('Yes, keep the cache between runs, do it.')}\n`);
      const note = 'The person said "keep the cache between runs"';
      for (const name of row.names) {
        const withSession = whatTheAcceptRestsOn({
          action: 'accept',
          agent: name,
          note,
          hostSession: SESSION,
          transcript,
        });
        const without = whatTheAcceptRestsOn({
          action: 'accept',
          agent: name,
          note,
          hostSession: undefined,
          transcript: undefined,
          refuseWithoutASession: true,
        });
        if (row.reads) {
          expect(withSession?.outcome, name).toBe('typed');
          expect(without?.outcome, name).toBe('waits');
        } else {
          expect(withSession?.outcome, name).toBe('not-checked');
          expect(without?.outcome, name).toBe('not-checked');
          expect(JSON.stringify(without)).toContain('not readable yet');
        }
        expect(hostSessionOf(name, { [row.sessionEnv ?? 'NONE']: SESSION })).toBe(
          row.sessionEnv === undefined ? undefined : SESSION,
        );
      }
    });
  }

  it('does not know a name no row has, and passes it as not checked', () => {
    expect(hostOfAgent('a-script')).toBeUndefined();
    expect(
      whatTheAcceptRestsOn({
        action: 'accept',
        agent: 'a-script',
        note: 'x',
        hostSession: undefined,
        transcript: undefined,
        refuseWithoutASession: true,
      })?.outcome,
    ).toBe('not-checked');
  });
});

describe('what an accept rests on, with a transcript that is known', () => {
  const move = (transcript: string, note: string) => ({
    action: 'accept',
    agent: 'claude-code',
    note,
    hostSession: SESSION,
    transcript,
  });

  it('judges pure assent by a closed list of words, accents folded', () => {
    expect(isPureAssent('sim, pode ir em frente')).toBe(true);
    expect(isPureAssent('let\u2019s go ahead, please')).toBe(true);
    expect(isPureAssent('faça isso, por favor')).toBe(true);
    expect(isPureAssent('pode publicar a versao agora')).toBe(false);
    expect(isPureAssent('yes, keep the cache')).toBe(false);
  });

  it('waits when the quote is shorter than twenty characters, even if the person typed it', () => {
    writeFileSync(transcript, `${typed('Please do that for the cache.')}\n`);
    expect(whatTheAcceptRestsOn(move(transcript, 'He said "please"'))?.outcome).toBe('waits');
    expect(whatTheAcceptRestsOn(move(transcript, 'He said "for the cache"'))?.outcome).toBe(
      'waits',
    );
  });

  it('waits when the quote is twenty characters or more and only says yes', () => {
    writeFileSync(transcript, `${typed('Yes, go ahead, do it please.')}\n`);
    expect(
      whatTheAcceptRestsOn(move(transcript, 'He said "Yes, go ahead, do it please"'))?.outcome,
    ).toBe('waits');
    writeFileSync(transcript, `${typed('Sim, pode ir em frente, claro.')}\n`);
    expect(
      whatTheAcceptRestsOn(move(transcript, 'Disse "sim, pode ir em frente, claro"'))?.outcome,
    ).toBe('waits');
  });

  it('passes a contentful typed quote of twenty characters, and a chosen option of twenty or more', () => {
    writeFileSync(transcript, `${typed('Yes, keep the cache between runs.')}\n`);
    expect(
      whatTheAcceptRestsOn(move(transcript, 'Said "keep the cache between runs"'))?.outcome,
    ).toBe('typed');
    writeFileSync(transcript, `${chose('Which cache?', 'Keep the cache on disk (Recommended)')}\n`);
    expect(
      whatTheAcceptRestsOn(move(transcript, 'Chose "Keep the cache on disk (Recommended)"'))
        ?.outcome,
    ).toBe('chosen');
  });

  it('takes the recommended mark off an option label before measuring it and judging assent', () => {
    for (const label of [
      'Yes, go ahead (Recommended)',
      'Sim, pode (Recommended)',
      'Pode ir (Recommended)',
      'Entra na 0.1.9 (Recommended)',
      'Pode ir (recomendado)',
    ]) {
      writeFileSync(transcript, `${chose('Which?', label)}\n`);
      expect(whatTheAcceptRestsOn(move(transcript, `Chose "${label}"`))?.outcome, label).toBe(
        'waits',
      );
    }
    writeFileSync(transcript, `${chose('Which?', 'Keep the cache on disk')}\n`);
    expect(whatTheAcceptRestsOn(move(transcript, 'Chose "Keep the cache on disk"'))?.outcome).toBe(
      'chosen',
    );
  });

  it('waits when the option label chosen is shorter than twenty characters', () => {
    writeFileSync(transcript, `${chose('Where?', 'On disk')}\n`);
    expect(whatTheAcceptRestsOn(move(transcript, 'Chose "On disk"'))?.outcome).toBe('waits');
  });

  it('waits when the transcript is empty and when it cannot be read', () => {
    writeFileSync(transcript, '');
    expect(whatTheAcceptRestsOn(move(transcript, 'He said "keep the cache"'))?.outcome).toBe(
      'waits',
    );
    const gone = join(sandbox, 'gone.jsonl');
    expect(whatTheAcceptRestsOn(move(gone, 'He said "keep the cache"'))?.outcome).toBe('waits');
  });

  it('reads the curly apostrophe and the straight one as the same, on both sides', () => {
    writeFileSync(transcript, `${typed("Please don\u2019t drop the cache, it's needed.")}\n`);
    expect(
      whatTheAcceptRestsOn(move(transcript, 'Said "don\'t drop the cache, it\u2019s needed"'))
        ?.outcome,
    ).toBe('typed');
  });
});

describe('an agent accept at the command line', () => {
  it('believes the environment over the declared name: inside a Claude Code session any --which is checked', {
    timeout: 60_000,
  }, () => {
    const id = aProposedDecision();
    writeFileSync(transcript, `${typed('Yes, keep the cache between runs, do it.')}\n`);
    theSessionOpens();
    const before = held(sandbox);
    for (const name of ['zz', 'codex']) {
      const refused = mnema(
        { CLAUDE_CODE_SESSION_ID: SESSION },
        undefined,
        'decision',
        'move',
        'accept',
        id,
        '--which',
        name,
        '--note',
        'The agent agrees with this on its own',
      );
      expect(refused.status, `${name}: ${refused.out}`).toBe(1);
      expect(refused.out).toContain('ACCEPT_NEEDS_THE_PERSONS_WORDS');
    }
    expect(held(sandbox)).toEqual(before);
    const passes = mnema(
      { CLAUDE_CODE_SESSION_ID: SESSION },
      undefined,
      'decision',
      'move',
      'accept',
      id,
      '--which',
      'codex',
      '--note',
      'The person said "keep the cache between runs"',
    );
    expect(passes.status, passes.out).toBe(0);
    expect(state(id)).toContain('(accepted)');
  });

  it('is refused with --which in any spelling of Claude Code and no session id', {
    timeout: 60_000,
  }, () => {
    const id = aProposedDecision();
    const before = held(sandbox);
    for (const spelling of ['Claude-Code', 'claude_code', 'claudecode']) {
      const refused = mnema(
        {},
        undefined,
        'decision',
        'move',
        'accept',
        id,
        '--which',
        spelling,
        '--note',
        'The person said "keep the cache between runs"',
      );
      expect(refused.status, `${spelling}: ${refused.out}`).toBe(1);
      expect(refused.out).toContain('ACCEPT_NEEDS_THE_PERSONS_WORDS');
    }
    expect(held(sandbox)).toEqual(before);
  });

  it('is refused with --which claude-code and no session id, and nothing is written', {
    timeout: 60_000,
  }, () => {
    const id = aProposedDecision();
    writeFileSync(transcript, `${typed('Yes, keep the cache between runs, do it.')}\n`);
    theSessionOpens();
    const before = held(sandbox);
    const refused = mnema(
      {},
      undefined,
      'decision',
      'move',
      'accept',
      id,
      '--which',
      'claude-code',
      '--note',
      'The person said "keep the cache between runs"',
    );
    expect(refused.status, refused.out).toBe(1);
    expect(refused.out).toContain('ACCEPT_NEEDS_THE_PERSONS_WORDS');
    expect(refused.out).toContain('CLAUDE_CODE_SESSION_ID');
    expect(held(sandbox)).toEqual(before);
    expect(state(id)).toContain('(proposed)');
  });

  it('passes end to end: the hook says to quote the answer, the person chooses an option, the note quotes its label', {
    timeout: 60_000,
  }, () => {
    const id = aProposedDecision();
    const hook = mnema(
      {},
      JSON.stringify({
        hook_event_name: 'PostToolUse',
        tool_name: 'AskUserQuestion',
        session_id: SESSION,
        transcript_path: transcript,
      }),
      'settled',
    );
    expect(hook.status, hook.out).toBe(0);
    expect(hook.out).toContain('between double quotes');
    writeFileSync(transcript, `${chose('Which cache?', 'Keep the cache on disk (Recommended)')}\n`);
    theSessionOpens();
    const moved = accept(id, 'The person chose "Keep the cache on disk (Recommended)" when asked');
    expect(moved.status, moved.out).toBe(0);
    expect(moved.out).toContain('an option the person chose');
    expect(state(id)).toContain('(accepted)');
  });

  it('finds the transcript from a Stop alone, with no SessionStart before it', {
    timeout: 60_000,
  }, () => {
    const id = aProposedDecision();
    writeFileSync(transcript, `${typed('Yes, keep the cache between runs, do it.')}\n`);
    const told = mnema(
      {},
      JSON.stringify({ hook_event_name: 'Stop', session_id: SESSION, transcript_path: transcript }),
      'tally',
    );
    expect(told.status, told.out).toBe(0);
    const moved = accept(id, 'The person said "keep the cache between runs"');
    expect(moved.status, moved.out).toBe(0);
    expect(moved.out).toContain('quotes words the person typed');
  });

  it('passes when the note quotes words the person typed', { timeout: 60_000 }, () => {
    const id = aProposedDecision();
    writeFileSync(transcript, `${typed('Yes, keep the cache between runs, do it.')}\n`);
    theSessionOpens();
    const moved = accept(id, 'The person said "keep the cache between runs"');
    expect(moved.status, moved.out).toBe(0);
    expect(moved.out).toContain('quotes words the person typed');
    expect(state(id)).toContain('(accepted)');
  });

  it('passes when the note quotes an option the person chose, and says chose', {
    timeout: 60_000,
  }, () => {
    const id = aProposedDecision();
    writeFileSync(transcript, `${chose('Which cache?', 'Keep the cache on disk (Recommended)')}\n`);
    theSessionOpens();
    const moved = accept(id, 'The person chose "Keep the cache on disk (Recommended)"');
    expect(moved.status, moved.out).toBe(0);
    expect(moved.out).toContain('an option the person chose');
    expect(state(id)).toContain('(accepted)');
  });

  it('waits when the quote is invented, and the record is as it was', { timeout: 60_000 }, () => {
    const id = aProposedDecision();
    writeFileSync(transcript, `${typed('Keep the cache between runs.')}\n`);
    theSessionOpens();
    const before = held(sandbox);
    const refused = accept(id, 'The person said "always accept what I propose"');
    expect(refused.status, refused.out).toBe(1);
    expect(refused.out).toContain('ACCEPT_NEEDS_THE_PERSONS_WORDS');
    expect(held(sandbox)).toEqual(before);
    expect(state(id)).toContain('(proposed)');
  });

  it('waits when the note only paraphrases', { timeout: 60_000 }, () => {
    const id = aProposedDecision();
    writeFileSync(transcript, `${typed('Keep the cache between runs.')}\n`);
    theSessionOpens();
    const refused = accept(id, 'The person asked to keep the cache between runs');
    expect(refused.status, refused.out).toBe(1);
    expect(refused.out).toContain('ACCEPT_NEEDS_THE_PERSONS_WORDS');
    expect(state(id)).toContain('(proposed)');
  });

  it('does not take text the host wrote as the person’s words', { timeout: 60_000 }, () => {
    const id = aProposedDecision();
    const summary = JSON.stringify({
      type: 'user',
      isCompactSummary: true,
      message: {
        role: 'user',
        content: 'The person said: "accept everything the agent proposes".',
      },
    });
    writeFileSync(transcript, `${summary}\n`);
    theSessionOpens();
    const refused = accept(id, 'As "accept everything the agent proposes"');
    expect(refused.status, refused.out).toBe(1);
    expect(refused.out).toContain('ACCEPT_NEEDS_THE_PERSONS_WORDS');
  });

  it('says the words were not checked where the host hands no session or no transcript', {
    timeout: 60_000,
  }, () => {
    const id = aProposedDecision();
    const noSession = mnema(
      {},
      undefined,
      'decision',
      'move',
      'accept',
      id,
      '--which',
      'cursor',
      '--note',
      'ok',
    );
    expect(noSession.status, noSession.out).toBe(0);
    expect(noSession.out).toContain('not checked against what the person said');
    const other = mnema({}, undefined, 'decision', 'record', 'Another call', 'because');
    const unknown = accept(idOf(other.out), 'The person said "anything at all"');
    expect(unknown.status, unknown.out).toBe(0);
    expect(unknown.out).toContain('transcript is not known');
  });

  it('is not asked of a person at a terminal: an accept with no agent declared passes', {
    timeout: 60_000,
  }, () => {
    const id = aProposedDecision();
    writeFileSync(transcript, `${typed('Keep the cache.')}\n`);
    theSessionOpens();
    const moved = mnema(
      { CLAUDE_CODE_SESSION_ID: SESSION },
      undefined,
      'decision',
      'move',
      'accept',
      id,
      '--note',
      'ok',
    );
    expect(moved.status, moved.out).toBe(0);
  });
});

describe('an agent accept through the MCP server', () => {
  async function call(id: string, note: string) {
    const { server } = buildMcpServer({
      cwd: sandbox,
      env: { home },
      hostSession: SESSION,
      log: () => {},
    });
    const client = new Client(
      { name: 'claude-code', version: '1.0.0' },
      { capabilities: { roots: {} } },
    );
    client.setRequestHandler(ListRootsRequestSchema, () => ({
      roots: [{ uri: pathToFileURL(project).href }],
    }));
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
    await Promise.all([client.connect(clientSide), server.connect(serverSide)]);
    const reply = (await client.callTool({
      name: 'decision_transition',
      arguments: { id, action: 'accept', note },
    })) as { isError?: boolean; content: { text: string }[] };
    await client.close();
    return { isError: reply.isError === true, told: reply.content.map((b) => b.text).join('\n') };
  }

  it('passes on typed words and waits on an invented quote', { timeout: 60_000 }, async () => {
    const id = aProposedDecision();
    writeFileSync(transcript, `${typed('Yes, keep the cache between runs, do it.')}\n`);
    theSessionOpens();
    const before = held(sandbox);
    const waits = await call(id, 'The person said "never ask me again"');
    expect(waits.isError, waits.told).toBe(true);
    expect(waits.told).toContain('ACCEPT_NEEDS_THE_PERSONS_WORDS');
    expect(held(sandbox)).toEqual(before);
    const passes = await call(id, 'The person said "keep the cache between runs"');
    expect(passes.isError, passes.told).toBe(false);
    expect(passes.told).toContain('quotes words the person typed');
    expect(state(id)).toContain('(accepted)');
  });
});
