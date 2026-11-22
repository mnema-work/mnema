/**
 * A SMALL SLIP IS TOLD WHAT TO TYPE INSTEAD, AND A SMALL SILENCE SAYS WHAT IT LEFT UNDONE.
 *
 * One case for each phrase or refusal of this delivery, driven in process over a real project
 * in a sandbox (a git repository, so what is asked of git is asked of git), asserting on the
 * words a person reads and, where a write could have happened, on what the record holds.
 * Nothing here changes the format: every case is a sentence, a refusal, or a flag that prints.
 */

import { execFileSync } from 'node:child_process';
import {
  appendFileSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeSession, openSession } from '../src/mcp/session.js';
import { runRecordHandoff, runSearchTool } from '../src/mcp/tools.js';
import { type CliIo, run } from '../src/program.js';
import { SWITCHABLE_CHANNELS } from '../src/record-framing.js';
import { labelsOf } from '../src/session-journal.js';

let sandbox: string;
let project: string;
const kept = { cwd: process.cwd(), home: process.env.HOME, data: process.env.XDG_DATA_HOME };

async function mnema(argv: readonly string[]) {
  const out: string[] = [];
  const err: string[] = [];
  let failed = false;
  const io: CliIo = {
    out: (line) => out.push(line),
    err: (line) => err.push(line),
    fail: () => {
      failed = true;
    },
  };
  await run(argv, io);
  return { out: out.join('\n'), err: err.join('\n'), failed };
}

/** Runs a verb that has to succeed (setup, not assertion) and returns what it printed. */
async function did(...argv: string[]): Promise<string> {
  const heard = await mnema(argv);
  expect(heard.failed, `${argv.join(' ')}: ${heard.err}`).toBe(false);
  return heard.out;
}

beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), 'mnema-slip-'));
  mkdirSync(join(sandbox, 'home'));
  project = join(sandbox, 'project');
  mkdirSync(project);
  execFileSync('git', ['init', '-q'], { cwd: project });
  process.env.HOME = join(sandbox, 'home');
  process.env.XDG_DATA_HOME = join(sandbox, 'data');
  process.chdir(project);
});

afterEach(() => {
  process.chdir(kept.cwd);
  const restore = (name: string, value: string | undefined) => {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  };
  restore('HOME', kept.home);
  restore('XDG_DATA_HOME', kept.data);
  rmSync(sandbox, { recursive: true, force: true });
});

describe('a word typed where another goes', () => {
  beforeEach(async () => {
    await did('init');
  });

  it('brief --hook --host claude-code says the Claude Code form has no --host', async () => {
    for (const named of ['claude-code', 'claude']) {
      const heard = await mnema(['brief', '--hook', '--host', named]);
      expect(heard.failed).toBe(true);
      expect(heard.err).toContain(`not "${named}".`);
      expect(heard.err).toContain('Claude Code’s own form is --hook without --host.');
    }
    const other = await mnema(['brief', '--hook', '--host', 'nowhere']);
    expect(other.err).toContain('not "nowhere".');
    expect(other.err).not.toContain('Claude Code’s own form');
  });

  it('recall --hook --host claude-code says the same, from the same sentence', async () => {
    const heard = await mnema(['recall', '--hook', '--host', 'claude-code']);
    expect(heard.err).toContain('Claude Code’s own form is --hook without --host.');
  });

  it('search with several unquoted words says to quote them', async () => {
    const heard = await mnema(['search', 'synthetic', 'load']);
    expect(heard.failed).toBe(true);
    expect(heard.err).toContain('does not take "load".');
    expect(heard.err).toContain(
      'It takes one term: quote several words, as in mnema search "synthetic load".',
    );
  });

  it('task move with the id before the action says the action goes first, and writes nothing', async () => {
    const created = await did('task', 'create', 'A task to move');
    const id = created.match(/\(([0-9a-f-]{36})\)/)?.[1] as string;
    const swapped = await mnema(['task', 'move', id, 'approve']);
    expect(swapped.failed).toBe(true);
    expect(swapped.err).toContain('No task approve here.');
    expect(swapped.err).toContain('The action goes before the id: mnema task move approve <id>.');
    const unknown = await mnema(['task', 'move', 'approve', 'nothing-like-an-id']);
    expect(unknown.err).toContain('No task nothing-like-an-id here.');
    expect(unknown.err).not.toContain('The action goes before the id');
    expect(await did('show', id)).toContain('A task to move');
  });
});

describe('a window that holds nothing says so', () => {
  beforeEach(async () => {
    await did('init');
    await did('memory', 'a note recorded today');
  });

  it.each([
    ['search', ['search']],
    ['audit accountability', ['audit', 'accountability']],
    ['export', ['export']],
  ])('%s refuses a --from after its --to, naming both', async (_name, verb) => {
    const heard = await mnema([...verb, '--from', '2026-11-22', '--to', '2026-11-01']);
    expect(heard.failed).toBe(true);
    expect(heard.err).toContain(
      '--from "2026-11-22" is after --to "2026-11-01", so no record can be inside the window: the earlier instant goes in --from.',
    );
    expect(heard.out).toBe('');
  });

  it('accepts a window whose two ends are the same day', async () => {
    const heard = await mnema(['search', '--from', '2026-11-22', '--to', '2026-11-22']);
    expect(heard.failed, heard.err).toBe(false);
  });

  it('search says "in this window" for an empty window, and keeps its old words where there is none', async () => {
    const bare = await did('search', '--from', '2000-01-01', '--to', '2000-01-02');
    expect(bare).toBe('Nothing recorded in this window.');
    const termed = await did('search', 'note', '--from', '2000-01-01', '--to', '2000-01-02');
    expect(termed).toBe('Nothing recorded matching "note" in this window.');
    const none = await did('search', 'zzqxzz');
    expect(none).toBe('Nothing recorded matching "zzqxzz".');
  });

  it('the search tool refuses an inverted window by the field names, with the code', async () => {
    const session = openSession({
      clientName: 'claude-code',
      roots: [pathToFileURL(project).href],
      env: { home: join(sandbox, 'home') },
    });
    try {
      const refused = runSearchTool(session, { from: '2026-11-22', to: '2026-11-01' });
      expect(refused.ok).toBe(false);
      if (!refused.ok) {
        expect(refused.code).toBe('INVALID_WINDOW');
        expect(refused.message).toBe(
          '`from` "2026-11-22" is after `to` "2026-11-01", so no record can be inside the window: the earlier instant goes in `from`.',
        );
      }
    } finally {
      closeSession(session);
    }
  });
});

describe('mnema init says what it left undone', () => {
  it('says the record is not committed where git ignores it, and still says commit where it does not', async () => {
    const plain = await did('init');
    expect(plain).toContain('Commit `.mnema/` with the repository');
    expect(plain).not.toContain('Git ignores `.mnema/`');

    const other = join(sandbox, 'other');
    mkdirSync(other);
    execFileSync('git', ['init', '-q'], { cwd: other });
    appendFileSync(join(other, '.git', 'info', 'exclude'), '.mnema/\n');
    process.chdir(other);
    const local = await did('init');
    expect(local).toContain(
      'Git ignores `.mnema/` here: the record stays on this machine, and no clone gets it.',
    );
    expect(local).not.toContain('Commit `.mnema/`');
  });

  it('says a plain git pull was not set up where nothing asked for it, and not where it was', async () => {
    const left = await did('init');
    expect(left).toContain(
      'A plain `git pull` was not set up for the record: `mnema doctor --fix merge-driver` writes its settings, and `mnema record pull` pulls without them.',
    );
    const other = join(sandbox, 'with-remote');
    mkdirSync(other);
    execFileSync('git', ['init', '-q'], { cwd: other });
    execFileSync('git', ['remote', 'add', 'origin', 'https://example.invalid/x.git'], {
      cwd: other,
    });
    process.chdir(other);
    const done = await did('init', '--yes', '--git-pull', 'yes');
    expect(done).not.toContain('A plain `git pull` was not set up');
  });
});

describe('mnema switch on says what THIS channel does', () => {
  beforeEach(async () => {
    await did('init');
  });

  it('names the channel’s own effect, one sentence for each, and none says another channel’s', async () => {
    const said = new Map<string, string>();
    for (const channel of SWITCHABLE_CHANNELS.filter((one) => one !== 'agent-accepts')) {
      const out = await did('switch', 'on', channel, '--scope', 'private');
      const line = out.split('\n').find((one) => one.includes(`${channel} is now ON:`));
      expect(line, `${channel}: ${out}`).toBeDefined();
      said.set(channel, line as string);
    }
    expect(new Set(said.values()).size).toBe(said.size);
    expect(said.get('opening-core')).toContain('hands over the decisions the person dictated');
    expect(said.get('tool-call-count')).toContain('keeps a local count of the tool calls');
    expect(said.get('session-journal')).toContain('a file is kept on this machine');
    expect(said.get('record-publish')).toContain('`mnema record publish` can now push');
    for (const line of said.values()) {
      expect(line).not.toContain('it hands the record over as it did before');
    }
  });
});

describe('mnema show --full', () => {
  beforeEach(async () => {
    await did('init');
  });

  /** A task with a description and ten notes of a hundred and fifty words each: the notes are cut to a line otherwise. */
  async function aTaskWithLongNotes(): Promise<{ id: string; words: string[] }> {
    const created = await did(
      'task',
      'create',
      'A task with long notes',
      '--description',
      'what it is',
    );
    const id = created.match(/\(([0-9a-f-]{36})\)/)?.[1] as string;
    const words: string[] = [];
    for (let at = 0; at < 10; at++) {
      const closing = `closing-word-${at}`;
      words.push(closing);
      const text = `${'long '.repeat(150)}${closing}`;
      await did('observe', id, '--topic', `amendment-${at}`, '--text', text);
    }
    return { id, words };
  }

  it('prints every note whole, past the cut of eight, where plain show prints a line each and says how to read them', async () => {
    const { id, words } = await aTaskWithLongNotes();
    const plain = await did('show', id);
    expect(plain).toContain('Notes (8 of 10, newest first):');
    expect(plain).toContain(`Every note whole: mnema show ${id} --full`);
    for (const word of words) expect(plain).not.toContain(word);

    const whole = await did('show', id, '--full');
    expect(whole).toContain('Notes (10, newest first):');
    for (const word of words) expect(whole).toContain(word);
    expect(whole).not.toContain('Every note whole:');
  });

  it('--json carries the whole text of each note with --full, and none without it', async () => {
    const { id } = await aTaskWithLongNotes();
    const cut = JSON.parse(await did('show', id, '--json'));
    expect(cut.story.notes.items.every((note: { text?: string }) => note.text === undefined)).toBe(
      true,
    );
    const whole = JSON.parse(await did('show', id, '--full', '--json'));
    expect(whole.story.notes.items).toHaveLength(10);
    expect(
      whole.story.notes.items.every((note: { text?: string; topic: string }) =>
        (note.text ?? '').endsWith(note.topic.replace('amendment', 'closing-word')),
      ),
    ).toBe(true);
  });

  it('is harmless on a record that has no notes to expand', async () => {
    const note = (await did('memory', 'a plain note')).match(
      /([0-9a-f]{8}-[0-9a-f-]{27})/,
    )?.[1] as string;
    expect(await did('show', note, '--full')).toContain('a plain note');
  });
});

describe('a handoff whose brief is a path under a temporary folder says so', () => {
  beforeEach(async () => {
    await did('init');
  });

  it('the command prints the notice after recording, and records the handoff all the same', async () => {
    const created = await did('task', 'create', 'A task to hand over');
    const id = created.match(/\(([0-9a-f-]{36})\)/)?.[1] as string;
    const gone = await did(
      'task',
      'handoff',
      id,
      'me',
      'you',
      '--brief',
      '/tmp/a-session-scratchpad/brief.md',
    );
    expect(gone).toContain('Recorded handoff on');
    expect(gone).toContain('The brief is observation');
    expect(gone).toContain(
      'The brief is the path /tmp/a-session-scratchpad/brief.md, under a temporary folder, which a reboot or a cleanup can clear',
    );
    const kept = await did(
      'task',
      'handoff',
      id,
      'me',
      'you',
      '--brief',
      join(project, 'docs', 'brief.md'),
    );
    expect(kept).not.toContain('temporary folder');
    const prose = await did(
      'task',
      'handoff',
      id,
      'me',
      'you',
      '--brief',
      'read /tmp/x/brief.md first, then ask',
    );
    expect(prose).not.toContain('temporary folder');
    const none = await did('task', 'handoff', id, 'me', 'you');
    expect(none).not.toContain('temporary folder');
  });

  it('the tool says the same, as data and as a line', async () => {
    const session = openSession({
      clientName: 'claude-code',
      roots: [pathToFileURL(project).href],
      env: { home: join(sandbox, 'home') },
    });
    try {
      const made = await mnema(['task', 'create', 'A task for the tool']);
      const id = made.out.match(/\(([0-9a-f-]{36})\)/)?.[1] as string;
      const temporary = runRecordHandoff(session, {
        task: id,
        from: 'me',
        to: 'you',
        brief: '/tmp/a-session-scratchpad/brief.md',
      });
      expect(temporary.ok && temporary.briefIsTemporary).toBe(true);
      const durable = runRecordHandoff(session, {
        task: id,
        from: 'me',
        to: 'you',
        brief: join(project, 'docs', 'brief.md'),
      });
      expect(durable.ok && durable.briefIsTemporary).toBeUndefined();
      expect(durable.ok).toBe(true);
    } finally {
      closeSession(session);
    }
  });

  it('a link inside the project that leads into a temporary folder counts, by where the file really is', async () => {
    const real = join(tmpdir(), `mnema-slip-link-${process.pid}`);
    mkdirSync(real, { recursive: true });
    try {
      symlinkSync(real, join(project, 'scratch'));
      writeFileSync(join(real, 'brief.md'), 'x');
      const created = await did('task', 'create', 'A task for the link');
      const id = created.match(/\(([0-9a-f-]{36})\)/)?.[1] as string;
      const viaLink = await did(
        'task',
        'handoff',
        id,
        'me',
        'you',
        '--brief',
        join(project, 'scratch', 'brief.md'),
      );
      expect(viaLink).toContain('under a temporary folder');
      const direct = await did(
        'task',
        'handoff',
        id,
        'me',
        'you',
        '--brief',
        join(real, 'brief.md'),
      );
      expect(direct).toContain('under a temporary folder');
    } finally {
      rmSync(real, { recursive: true, force: true });
    }
  });
});

describe('a private decision is read as ADR-n (private), in one spelling', () => {
  /** A tree holding the decisions numbered `adrs`, as far as the journal's labels read it. */
  const tree = (scope: 'public' | 'private' | 'global', adrs: readonly string[]) =>
    ({
      scope,
      cache: { listDecisions: () => adrs.map((adr) => ({ id: `id-${scope}-${adr}`, adr })) },
    }) as never;

  it('the journal labels a decision of a tree outside the public one with its tree, whether or not the number is shared', () => {
    const labels = labelsOf([
      tree('public', ['ADR-1']),
      tree('private', ['ADR-1', 'ADR-7']),
      tree('global', ['ADR-9']),
    ]);
    expect(labels.get('id-public-ADR-1')).toBe('ADR-1');
    expect(labels.get('id-private-ADR-1')).toBe('ADR-1 (private)');
    expect(labels.get('id-private-ADR-7')).toBe('ADR-7 (private)');
    expect(labels.get('id-global-ADR-9')).toBe('ADR-9 (global)');
  });
});
