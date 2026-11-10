import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  awaitingPhrase,
  type CliState,
  CONTAINER_COMMAND,
  describeBar,
  iconFor,
  MIN_CLI_VERSION,
  readChannels,
  readCli,
  readTrees,
  readVerdict,
  TOOLTIP_COMMANDS,
  type TreeLine,
  type Verdict,
  versionNotice,
} from './status.js';

/** What `mnema verify --json` really printed (HOME in a temp folder): an intact record, one with a line altered, and an empty `.mnema`. */
const printed = (name: string): string =>
  readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8');

const SWITCH = [
  '9 channel(s), looked in public, private, global:',
  '  brief-document         on   the document `mnema brief` prints',
  '  edit-first-write-gate  off  the hold on the first write  ·  off until switched on: `mnema switch on edit-first-write-gate`',
  '  user-corrections       off  the proposals recorded from what a person typed',
  '  session-tally          on   the line a session prints',
].join('\n');

describe('the verdict of the record, as `mnema verify --json` says it', () => {
  it('reads a record that verifies, with its level', () => {
    const json = JSON.stringify({ ok: true, record: { ok: true, level: 'fully-signed' } });
    expect(readVerdict(json)).toEqual({ kind: 'verified', level: 'fully-signed' });
  });

  it('reads a record that does not verify, with the level when there is one', () => {
    expect(readVerdict('{"ok": false, "record": {"ok": false, "level": "chained"}}')).toEqual({
      kind: 'failed',
      level: 'chained',
    });
    expect(readVerdict('{"ok": false}')).toEqual({ kind: 'failed', level: undefined });
  });

  it("reads what the command really printed: the verdict is the record's, not the top ok", () => {
    expect(readVerdict(printed('verify-intact'))).toEqual({
      kind: 'verified',
      level: 'fully-signed',
    });
    // `mnema verify` exits 1 on both, and the top ok is false on both.
    expect(readVerdict(printed('verify-tampered'))).toEqual({
      kind: 'failed',
      level: 'unreadable',
    });
    expect(readVerdict(printed('verify-empty-folder'))).toEqual({
      kind: 'failed',
      level: 'broken',
    });
  });

  it('never reads a verdict out of what is not one', () => {
    expect(readVerdict('')).toEqual({ kind: 'unreadable' });
    expect(readVerdict('{"ok": "yes"}')).toEqual({ kind: 'unreadable' });
    expect(readVerdict('{"ok": true}')).toEqual({ kind: 'unreadable' });
    expect(readVerdict('null')).toEqual({ kind: 'unreadable' });
  });
});

describe('the channels, as `mnema switch` lists them', () => {
  it('reads each line that is a channel and nothing else', () => {
    expect(readChannels(SWITCH)).toEqual([
      { name: 'brief-document', on: true },
      { name: 'edit-first-write-gate', on: false },
      { name: 'user-corrections', on: false },
      { name: 'session-tally', on: true },
    ]);
  });

  it('reads none out of a refusal', () => {
    expect(readChannels('No mnema record here.\n')).toEqual([]);
  });
});

const PUBLIC_LINE: TreeLine = {
  scope: 'public',
  headline: 'local integrity verified (T1/T2/T4)',
  short: 'verified, signed',
  newerMnema: undefined,
  mark: undefined,
};
const PRIVATE_LINE: TreeLine = { ...PUBLIC_LINE, scope: 'private' };
const READY = { kind: 'ready' } as const;
const channelsOn = readChannels(SWITCH);
const AT = new Date(2026, 9, 27, 14, 3, 9);

describe('whether the mnema command line can be run at all', () => {
  const answer = (code: number | null, stdout = '', stderr = '') => ({ code, stdout, stderr });

  it('is ready when it answers a version at or above the floor', () => {
    expect(readCli(answer(0, `${MIN_CLI_VERSION}\n`))).toEqual({ kind: 'ready' });
    expect(readCli(answer(0, '0.9.0\n'))).toEqual({ kind: 'ready' });
    expect(readCli(answer(0, '1.0.0-beta.2\n'))).toEqual({ kind: 'ready' });
  });

  it('is missing when it could not be started, and says why in the words the system gave', () => {
    const missing = readCli(answer(null, '', 'spawn mnema ENOENT\n'));
    expect(missing.kind).toBe('missing');
    expect(missing.kind === 'missing' && missing.reason).toContain('spawn mnema ENOENT');
  });

  it('is missing when what ran is not a mnema that names its version', () => {
    expect(readCli(answer(1, '', 'nope')).kind).toBe('missing');
    expect(readCli(answer(0, 'hello\n')).kind).toBe('missing');
    expect(readCli(answer(0, '')).kind).toBe('missing');
  });

  it('says a command that did not answer in time did not answer, not that it was not found', () => {
    const slow = readCli({ code: null, stdout: '', stderr: 'Command failed', timedOut: true });
    expect(slow).toEqual({ kind: 'missing', reason: 'it did not answer in 60 s' });
    const bar = describeBar({
      cli: slow,
      verdict: { kind: 'unreadable' },
      channels: undefined,
      trees: [],
      awaiting: undefined,
      readAt: AT,
    });
    expect(bar.tooltip).toContain('it did not answer in 60 s');
    expect(bar.tooltip).not.toContain('not found');
  });

  it('is missing when the version is below the floor, naming both', () => {
    const old = readCli(answer(0, '0.0.9\n'));
    expect(old.kind).toBe('missing');
    expect(old.kind === 'missing' && old.reason).toContain('0.0.9');
    expect(old.kind === 'missing' && old.reason).toContain(MIN_CLI_VERSION);
  });
});

const bar = (
  verdict: Verdict,
  more: Partial<Parameters<typeof describeBar>[0]> = {},
): ReturnType<typeof describeBar> =>
  describeBar({
    cli: READY,
    verdict,
    channels: channelsOn,
    trees: [PUBLIC_LINE, PRIVATE_LINE],
    awaiting: undefined,
    readAt: AT,
    ...more,
  });
const STRONG: Verdict = { kind: 'verified', level: 'fully-signed' };
const WEAK: Verdict = { kind: 'verified', level: 'hash-chain-only' };
const FAILED: Verdict = { kind: 'failed', level: 'broken' };
const UNREADABLE: Verdict = { kind: 'unreadable' };

describe('the status bar item: the level and what awaits, short, with the detail in the tooltip', () => {
  it('says the level, then what awaits a judgment, by the same number as the badge', () => {
    expect(bar(STRONG).text).toBe('$(mnema-m) fully-signed');
    expect(bar(STRONG, { awaiting: 2 }).text).toBe('$(mnema-m) fully-signed · 2 to judge');
    expect(bar({ kind: 'verified', level: 'externally-witnessed' }, { awaiting: 1 }).text).toBe(
      '$(mnema-m) externally-witnessed · 1 to judge',
    );
    expect(bar(WEAK, { awaiting: 3 }).text).toBe('$(mnema-m) hash-chain-only · 3 to judge');
    expect(bar(FAILED).text).toBe('$(error) verify failed');
    expect(bar(FAILED, { awaiting: 2 }).text).toBe('$(error) verify failed · 2 to judge');
    expect(bar(UNREADABLE).text).toBe('$(question) verify unreadable');
    expect(bar(UNREADABLE, { awaiting: 1 }).text).toBe(
      '$(question) verify unreadable · 1 to judge',
    );
    // Nothing to count, or not counted: no suffix.
    expect(bar(STRONG, { awaiting: 0 }).text).toBe('$(mnema-m) fully-signed');
  });

  it('keeps the text short whatever the state: no channel count, at most 40 characters before the icon is drawn', () => {
    const longest = [STRONG, WEAK, FAILED, UNREADABLE]
      .flatMap((v) => [bar(v), bar(v, { awaiting: 250 })])
      .map((b) => b.text.replace(/^\$\([a-z-]+\) /, ''));
    for (const text of longest) expect(text).not.toMatch(/channels? off/);
    expect(Math.max(...longest.map((t) => t.length))).toBeLessThanOrEqual(40);
  });

  it('shows a codicon that follows the verdict, and never a seal of verification', () => {
    expect(bar(STRONG).text).toMatch(/^\$\(mnema-m\) /);
    expect(bar(WEAK).text).toMatch(/^\$\(mnema-m\) /);
    for (const name of ['verify-tampered', 'verify-empty-folder']) {
      expect(bar(readVerdict(printed(name))).text).toMatch(/^\$\(error\) verify failed/);
    }
    expect(bar(UNREADABLE).text).toMatch(/^\$\(question\) /);
    for (const verdict of [
      STRONG,
      { kind: 'verified', level: 'externally-witnessed' },
      FAILED,
      UNREADABLE,
    ] as const) {
      expect(bar(verdict).text).not.toMatch(/\$\((verified|pass|shield|check|workspace-trusted)/);
    }
  });

  it('wears the M of mnema only where verify was read, by value in the six readings of the bar', () => {
    const missing: CliState = { kind: 'missing', reason: 'it could not be started' };
    const icon = (cli: CliState, verdict: Verdict) =>
      /^\$\(([a-z-]+)\) /.exec(bar(verdict, { cli }).text)?.[1];
    const ready: CliState = { kind: 'ready' };
    expect(icon(ready, STRONG)).toBe('mnema-m');
    expect(icon(ready, { kind: 'verified', level: 'externally-witnessed' })).toBe('mnema-m');
    expect(icon(ready, WEAK)).toBe('mnema-m');
    expect(icon(ready, FAILED)).toBe('error');
    expect(icon(ready, UNREADABLE)).toBe('question');
    expect(icon(missing, STRONG)).toBe('warning');
    expect(iconFor(STRONG)).toBe('mnema-m');
    expect(iconFor(FAILED)).toBe('error');
  });

  it('wears the warning background only when mnema verify failed', () => {
    expect(bar(FAILED).warning).toBe(true);
    expect(bar(readVerdict(printed('verify-tampered'))).warning).toBe(true);
    for (const verdict of [STRONG, WEAK, UNREADABLE]) expect(bar(verdict).warning).toBe(false);
  });

  it('opens the container on a click, in every state, the missing command included', () => {
    for (const verdict of [STRONG, WEAK, FAILED, UNREADABLE]) {
      expect(bar(verdict).command).toBe('workbench.view.extension.mnema');
    }
    const missing = describeBar({
      cli: { kind: 'missing', reason: 'spawn mnema ENOENT' },
      verdict: UNREADABLE,
      channels: undefined,
      trees: [],
      awaiting: undefined,
      readAt: AT,
    });
    expect(missing.command).toBe(CONTAINER_COMMAND);
    expect(missing.warning).toBe(false);
  });

  it('gives a screen reader the whole sentence, not the abbreviation', () => {
    expect(bar(STRONG).accessibility).toEqual({ label: 'mnema: fully-signed', role: 'button' });
    expect(bar(STRONG, { awaiting: 2 }).accessibility.label).toBe(
      'mnema: fully-signed, 2 decisions await a judgment',
    );
    expect(bar(WEAK, { awaiting: 1 }).accessibility.label).toBe(
      'mnema: hash-chain-only, 1 decision awaits a judgment',
    );
    expect(bar(FAILED).accessibility.label).toBe('mnema: verify failed');
    expect(bar(UNREADABLE, { awaiting: 3 }).accessibility.label).toBe(
      'mnema: verify unreadable, 3 decisions await a judgment',
    );
  });

  it('says the command is missing instead of a verdict, and says why and what to set', () => {
    const missing = describeBar({
      cli: { kind: 'missing', reason: 'spawn mnema ENOENT' },
      verdict: UNREADABLE,
      channels: undefined,
      trees: [],
      awaiting: undefined,
      readAt: AT,
    });
    expect(missing.text).toBe('$(warning) mnema not found');
    expect(missing.tooltip).toContain('spawn mnema ENOENT');
    expect(missing.tooltip).toContain('command:workbench.action.openSettings?');
    expect(missing.tooltip).toContain(encodeURIComponent('["mnema.command"]'));
    expect(missing.accessibility.label).toBe('mnema: command not found');
  });
});

const json = (trees: unknown[]) => JSON.stringify({ ok: true, trees });
const verdict = (scope: string, level: string, more: object = {}) => ({
  kind: 'verdict',
  scope,
  headline: `the line of ${scope}`,
  short: `the short line of ${scope}`,
  result: { ok: true, level },
  ...more,
});

describe('the lines of the trees, as `mnema verify --json` says them', () => {
  it('reads one line per tree that holds a record, the command line words and nothing else', () => {
    expect(readTrees(printed('verify-lines-intact'))).toEqual([
      {
        scope: 'public',
        headline: 'local integrity verified (T1/T2/T4)',
        short: 'verified, signed',
        newerMnema: undefined,
        mark: undefined,
      },
    ]);
  });

  it('marks a tree that is broken as an error, and gives its line as the command line wrote it', () => {
    expect(readTrees(printed('verify-lines-broken'))).toEqual([
      {
        scope: 'public',
        headline: 'local integrity FAILED: see issues',
        short: 'failed: entry hash mismatch: content or link was altered (and 1 more)',
        newerMnema: undefined,
        mark: 'error',
      },
    ]);
  });

  it('marks a level below the signed ones as information, and the signed ones not at all', () => {
    const marks = (level: string) => readTrees(json([verdict('public', level)]))[0]?.mark;
    expect(marks('fully-signed')).toBeUndefined();
    expect(marks('externally-witnessed')).toBeUndefined();
    expect(marks('hash-chain-only')).toBe('info');
    expect(marks('signed-through-last-checkpoint')).toBe('info');
  });

  it('carries the sentence about a newer mnema on the tree the command line put it on', () => {
    const sentence = 'A newer mnema wrote 1 line into this record (x).';
    const read = readTrees(json([verdict('public', 'fully-signed', { newerMnema: sentence })]));
    expect(read[0]?.newerMnema).toBe(sentence);
  });

  it('leaves out a tree with nothing in it and a tree the command line wrote no line for', () => {
    const older = {
      kind: 'verdict',
      scope: 'private',
      result: { ok: true, level: 'fully-signed' },
    };
    const empty = { kind: 'no-record', scope: 'private', headline: 'no record here' };
    expect(readTrees(json([verdict('public', 'fully-signed'), empty]))).toHaveLength(1);
    expect(readTrees(json([older]))).toEqual([]);
  });

  it('reads none out of what is not a verdict', () => {
    expect(readTrees('')).toEqual([]);
    expect(readTrees('null')).toEqual([]);
    expect(readTrees('{"ok": true}')).toEqual([]);
  });
});

/** How text from the command line reads in the tooltip: every ASCII punctuation mark escaped. */
const inert = (text: string): string => text.replace(/[!-/:-@[-`{-~]/g, '\\$&');

describe('the tooltip', () => {
  const withNewer: TreeLine = {
    ...PUBLIC_LINE,
    newerMnema: 'A newer mnema wrote 1 line into this record ("x.new"). Update mnema to read them.',
  };

  it('lays out the level, one line per tree, what awaits, the channels off, when it was read and the links', () => {
    expect(bar(STRONG, { awaiting: 2 }).tooltip).toBe(
      [
        '**mnema** · fully\\-signed',
        `**public**: ${inert('verified, signed')}\\\n**private**: ${inert('verified, signed')}`,
        `[2 decisions await a judgment](command:${CONTAINER_COMMAND}) · [What to do](command:mnema.whatToDo)`,
        'Channels off: edit\\-first\\-write\\-gate, user\\-corrections',
        `Read at 14:03:09 · [Refresh](command:mnema.refresh) · [Settings](command:workbench.action.openSettings?${encodeURIComponent('["mnema.statusBar"]')}) · [Show the full verification](command:mnema.showVerification)`,
      ].join('\n\n'),
    );
  });

  it('marks a tree that is not clean with the editor icon of its kind, and a clean tree with none', () => {
    const tip = bar(FAILED, {
      trees: [
        { ...PUBLIC_LINE, short: 'failed: entry hash mismatch', mark: 'error' },
        { ...PRIVATE_LINE, mark: 'info' },
        { ...PRIVATE_LINE, scope: 'global' },
      ],
    }).tooltip;
    expect(tip).toContain(`$(error) **public**: ${inert('failed: entry hash mismatch')}`);
    expect(tip).toContain('$(info) **private**: ');
    expect(tip).toMatch(/\n\*\*global\*\*: /);
  });

  it('says a newer mnema wrote lines in the command line own sentence, under the tree it is about', () => {
    const tip = bar(STRONG, { trees: [withNewer, PRIVATE_LINE] }).tooltip;
    expect(tip).toContain(
      `**public**: ${inert('verified, signed')}\\\n$(info) ${inert(withNewer.newerMnema as string)}\\\n**private**: `,
    );
  });

  it('holds no text `mnema verify` printed, no block of code and no id of a tail', () => {
    for (const shown of [bar(STRONG), bar(WEAK), bar(FAILED)]) {
      expect(shown.tooltip).not.toContain('```');
      expect(shown.tooltip).not.toMatch(/[0-9a-f]{40}/);
    }
  });

  it('says only what the command line wrote: every word about a tree is in the field it came from', () => {
    const invented = 'a word the command line never wrote';
    const tip = bar(STRONG, { trees: [{ ...PUBLIC_LINE, short: invented }] }).tooltip;
    expect(tip).toContain(inert(invented));
    const fromTheField = readTrees(printed('verify-lines-intact'))[0]?.short as string;
    const shown = bar(STRONG, { trees: readTrees(printed('verify-lines-intact')) }).tooltip;
    expect(shown).toContain(inert(fromTheField));
  });

  it('says a failure with the line the command line wrote for the tree, and no line of its own that judges', () => {
    const tip = bar(FAILED, {
      trees: [{ ...PUBLIC_LINE, short: 'failed: entry hash mismatch', mark: 'error' }],
    }).tooltip;
    expect(tip).toContain('**mnema** · verify failed');
    expect(tip).toContain(inert('failed: entry hash mismatch'));
  });

  it('says the channels were not read, or that every one is on, and invents nothing', () => {
    expect(bar(STRONG, { channels: undefined }).tooltip).toContain('Channels: not read.');
    expect(
      bar(STRONG, { channels: channelsOn.map((c) => ({ ...c, on: true })) }).tooltip,
    ).toContain('Every channel is on.');
  });

  it('makes text from the command line inert: a channel or a line that carries a command link is not a link', () => {
    const hostile = '[judge](command:mnema.accept)';
    const tip = bar(STRONG, {
      channels: [{ name: hostile, on: false }],
      trees: [
        { ...PUBLIC_LINE, scope: hostile, short: `${hostile} <b>x</b>`, newerMnema: hostile },
      ],
    }).tooltip;
    expect(tip).toContain('\\[judge\\]\\(command\\:mnema\\.accept\\)');
    expect(tip).not.toContain('[judge](command:mnema.accept)');
    expect(tip).not.toContain('<b>');
    const reason = describeBar({
      cli: { kind: 'missing', reason: `${hostile} <i>x</i>\nsecond line` },
      verdict: UNREADABLE,
      channels: undefined,
      trees: [],
      awaiting: undefined,
      readAt: AT,
    }).tooltip;
    expect(reason).not.toContain('[judge](command:mnema.accept)');
    expect(reason).not.toContain('<i>');
  });

  it('lists the commands its links may run, closed, and never one that judges a decision', () => {
    expect(TOOLTIP_COMMANDS).toEqual([
      'workbench.view.extension.mnema',
      'mnema.whatToDo',
      'mnema.refresh',
      'mnema.showVerification',
      'workbench.action.openSettings',
    ]);
    const all = [
      bar(STRONG, { awaiting: 2 }).tooltip,
      bar(FAILED).tooltip,
      describeBar({
        cli: { kind: 'missing', reason: 'x' },
        verdict: UNREADABLE,
        channels: undefined,
        trees: [],
        awaiting: undefined,
        readAt: AT,
      }).tooltip,
    ];
    for (const tip of all) {
      for (const link of tip.matchAll(/\(command:([^)?]+)/g)) {
        expect(TOOLTIP_COMMANDS).toContain(link[1]);
      }
    }
  });

  it('claims nothing the command line did not say: no word of verification once the lines of the trees are taken away', () => {
    const claim = /\b(verified|secure|safe|trusted|proven)\b|\byour record is\b/i;
    const states = [
      bar(STRONG, { awaiting: 2, trees: [] }),
      bar(WEAK, { trees: [] }),
      bar(FAILED, { trees: [] }),
      bar(UNREADABLE, { awaiting: 1, trees: [] }),
      describeBar({
        cli: { kind: 'missing', reason: 'spawn mnema ENOENT' },
        verdict: UNREADABLE,
        channels: undefined,
        trees: [],
        awaiting: undefined,
        readAt: AT,
      }),
    ];
    for (const shown of states) {
      expect(shown.text).not.toMatch(claim);
      expect(shown.tooltip).not.toMatch(claim);
      expect(shown.accessibility.label).not.toMatch(claim);
    }
    // The line the command line wrote for a tree says "verified" itself, and is shown as it came.
    expect(bar(STRONG).tooltip).toMatch(claim);
  });

  it('says the same words as the badge for what awaits', () => {
    expect(awaitingPhrase(1)).toBe('1 decision awaits a judgment');
    expect(awaitingPhrase(250)).toBe('250 decisions await a judgment');
  });
});

describe('the sentence for a command line and an extension on different versions', () => {
  it('names an older command line and what to do about it', () => {
    const notice = versionNotice('0.6.1', '0.7.3');
    expect(notice).toContain(
      'The mnema command (0.6.1) is older than this extension (0.7.3): update the command line',
    );
    expect(notice).toContain('/docs/install.md');
    expect(notice).toContain('to a newer one.');
  });

  it('names a newer command line and says to update the extension', () => {
    expect(versionNotice('1.0.0', '0.9.9')).toBe(
      'The mnema command (1.0.0) is newer than this extension (0.9.9): update the extension.',
    );
  });

  it('compares number by number, not as text, and by minor and patch too', () => {
    expect(versionNotice('0.10.0', '0.9.0')).toContain('is newer');
    expect(versionNotice('0.1.9', '0.1.10')).toContain('is older');
  });

  it('says nothing for the same version, a pre-release suffix alone, or what is not a version', () => {
    expect(versionNotice('0.7.3', '0.7.3')).toBeUndefined();
    expect(versionNotice('0.7.3-beta.2', '0.7.3')).toBeUndefined();
    expect(versionNotice('mnema', '0.7.3')).toBeUndefined();
    expect(versionNotice('0.7.3', '')).toBeUndefined();
  });
});
