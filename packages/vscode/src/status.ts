/**
 * The status bar: what `mnema verify --json` says of the record and what `mnema switch` says of
 * the channels. The verdict is the CLI's; nothing is re-derived, and a CLI that cannot be read is
 * shown as unreadable rather than as fine.
 */

import { TIMEOUT_SECONDS } from './cli.js';

/** What the record's verification says, as far as it could be read. */
export type Verdict =
  | { readonly kind: 'verified'; readonly level: string }
  | { readonly kind: 'failed'; readonly level: string | undefined }
  | { readonly kind: 'unreadable' };

/**
 * The reading of `mnema verify --json`. The verdict on the record is `record.ok` (the exit code of
 * `mnema verify` follows it), so that is the one read; the top `ok` says the same, and is
 * what an answer from an older `mnema`, or one with no `record`, falls back to.
 */
export function readVerdict(stdout: string): Verdict {
  let answer: unknown;
  try {
    answer = JSON.parse(stdout);
  } catch {
    return { kind: 'unreadable' };
  }
  if (typeof answer !== 'object' || answer === null) return { kind: 'unreadable' };
  const { ok: top, record } = answer as { ok?: unknown; record?: unknown };
  const rec =
    typeof record === 'object' && record !== null ? (record as Record<string, unknown>) : {};
  const ok = typeof rec.ok === 'boolean' ? rec.ok : top;
  if (typeof ok !== 'boolean') return { kind: 'unreadable' };
  const level = typeof rec.level === 'string' ? rec.level : undefined;
  if (ok && level !== undefined) return { kind: 'verified', level };
  return ok ? { kind: 'unreadable' } : { kind: 'failed', level };
}

/**
 * One tree of the record as `mnema verify --json` says it in a line: the tree's name, the line the
 * command line wrote for it (`short`, in plain words; `headline`, the console's own, where `short` is absent), and, where a newer mnema wrote lines
 * this one does not read, the sentence it says that in. The words are the command line's: nothing
 * here words a verdict.
 */
export interface TreeLine {
  readonly scope: string;
  readonly headline: string;
  /** The same verdict in plain words, when the command line serves it; the tooltip shows this one. */
  readonly short: string | undefined;
  readonly newerMnema: string | undefined;
  /** How the line is marked: a tree that is broken, a level below the signed ones, or neither. */
  readonly mark: 'error' | 'info' | undefined;
}

/** The levels that need no mark: the proof reached a signature and nothing is pending on it. */
const CLEAN_LEVELS: readonly string[] = ['fully-signed', 'externally-witnessed'];

/**
 * The lines of `mnema verify --json`, one per tree that holds a record, in the order the command
 * line gave them. A tree with nothing in it is left out, as the command line leaves it out of its
 * own text, and a tree whose line the command did not write (a command line older than the field)
 * is left out too: the extension does not word one in its place.
 */
export function readTrees(stdout: string): TreeLine[] {
  let answer: unknown;
  try {
    answer = JSON.parse(stdout);
  } catch {
    return [];
  }
  const trees = (answer as { trees?: unknown } | null)?.trees;
  if (!Array.isArray(trees)) return [];
  const lines: TreeLine[] = [];
  for (const tree of trees as Record<string, unknown>[]) {
    if (tree?.kind !== 'verdict') continue;
    if (typeof tree.scope !== 'string' || typeof tree.headline !== 'string') continue;
    const result = (tree.result ?? {}) as { ok?: unknown; level?: unknown };
    lines.push({
      scope: tree.scope,
      headline: tree.headline,
      short: typeof tree.short === 'string' ? tree.short : undefined,
      newerMnema: typeof tree.newerMnema === 'string' ? tree.newerMnema : undefined,
      mark:
        result.ok === false
          ? 'error'
          : typeof result.level === 'string' && !CLEAN_LEVELS.includes(result.level)
            ? 'info'
            : undefined,
    });
  }
  return lines;
}

/** One channel of `mnema switch`, with whether it is on. */
export interface Channel {
  readonly name: string;
  readonly on: boolean;
}

const CHANNEL_LINE = /^ {2}(\S+) +(on|off)(?: |$)/;

/** The channels in the text of `mnema switch`: a line is `  <name>  on|off  <what it carries>`. */
export function readChannels(stdout: string): Channel[] {
  const channels: Channel[] = [];
  for (const line of stdout.split('\n')) {
    const match = CHANNEL_LINE.exec(line);
    if (match?.[1] !== undefined) channels.push({ name: match[1], on: match[2] === 'on' });
  }
  return channels;
}

/**
 * The oldest `mnema` the extension is written against: the commands it starts (`status --json`,
 * `verify --json`, `switch`, `rules --json`, `why`, `stack list --json`, `search ... --json`) are the
 * ones that version has. An older one is treated as not there, because its answers are not read
 * back correctly.
 */
export const MIN_CLI_VERSION = '0.1.2';

/** Whether the command line can be run at all, and if not, in what words. */
export type CliState =
  | { readonly kind: 'ready' }
  | { readonly kind: 'missing'; readonly reason: string };

const VERSION_LINE = /^(\d+)\.(\d+)\.(\d+)(?:[-+][0-9A-Za-z.+-]*)?$/;

const parts = (version: string): number[] | undefined => {
  const match = VERSION_LINE.exec(version);
  return match === null ? undefined : [Number(match[1]), Number(match[2]), Number(match[3])];
};

/** The reading of `mnema --version`: not started, not a mnema, or older than the floor, is missing. */
export function readCli(result: {
  readonly code: number | null;
  readonly stdout: string;
  readonly stderr: string;
  readonly timedOut?: true;
}): CliState {
  if (result.timedOut === true) {
    return { kind: 'missing', reason: `it did not answer in ${TIMEOUT_SECONDS} s` };
  }
  if (result.code === null) {
    const why = result.stderr.trim().split('\n')[0] ?? '';
    return { kind: 'missing', reason: why === '' ? 'it could not be started' : why };
  }
  const first = result.stdout.trim().split('\n')[0] ?? '';
  const found = result.code === 0 ? parts(first) : undefined;
  const floor = parts(MIN_CLI_VERSION) ?? [0, 0, 0];
  if (found === undefined) {
    return { kind: 'missing', reason: 'it did not answer `--version` as mnema does' };
  }
  for (let i = 0; i < 3; i++) {
    if ((found[i] ?? 0) !== (floor[i] ?? 0)) {
      if ((found[i] ?? 0) > (floor[i] ?? 0)) return { kind: 'ready' };
      return { kind: 'missing', reason: `version ${first} is older than ${MIN_CLI_VERSION}` };
    }
  }
  return { kind: 'ready' };
}

/** The page that says how to install or update the command line. */
export const INSTALL_PAGE = 'https://github.com/mnema-work/mnema/blob/main/docs/install.md';

/**
 * The one sentence for a command line and an extension on different versions, or nothing when they
 * are the same or either is not a version. Major, minor and patch are compared; a pre-release
 * suffix is ignored. It is read from what the machine already has (`mnema --version` and the
 * extension's own manifest) and asks no network.
 */
export function versionNotice(cli: string, extension: string): string | undefined {
  const found = parts(cli.trim());
  const own = parts(extension.trim());
  if (found === undefined || own === undefined) return undefined;
  for (let i = 0; i < 3; i++) {
    const a = found[i] ?? 0;
    const b = own[i] ?? 0;
    if (a === b) continue;
    const shown = `(${found.join('.')}) is ${a < b ? 'older' : 'newer'} than this extension (${own.join('.')})`;
    return a < b
      ? `The mnema command ${shown}: update the command line ([how](${INSTALL_PAGE})) or set ${settingLink('mnema.command', 'mnema.command')} to a newer one.`
      : `The mnema command ${shown}: update the extension.`;
  }
  return undefined;
}

/** The command that opens the extension's container in the side bar: what a click on the bar does. */
export const CONTAINER_COMMAND = 'workbench.view.extension.mnema';

/**
 * The commands a link in the tooltip may run. The list is closed and holds no verb that judges a
 * decision: the tooltip is the one trusted markdown the extension shows, and part of what it
 * carries was written by the command line, which in turn carries what an agent wrote.
 */
export const TOOLTIP_COMMANDS: readonly string[] = [
  CONTAINER_COMMAND,
  'mnema.whatToDo',
  'mnema.refresh',
  'mnema.showVerification',
  'workbench.action.openSettings',
];

/** What is said of the decisions awaiting a judgment, for the badge, the tooltip and the screen reader. */
export const awaitingPhrase = (total: number): string =>
  total === 1 ? '1 decision awaits a judgment' : `${total} decisions await a judgment`;

/** What the status bar item shows and what a click on it does. */
export interface Bar {
  readonly text: string;
  /** Markdown, shown trusted for `TOOLTIP_COMMANDS` only and without HTML. */
  readonly tooltip: string;
  readonly accessibility: { readonly label: string; readonly role: 'button' };
  /** True when `mnema verify` failed: the bar then wears the theme's warning background. */
  readonly warning: boolean;
  readonly command: typeof CONTAINER_COMMAND;
}

/**
 * The icon of the bar for a reading. The M, the mark of mnema, only where `verify` was read: a
 * record that failed or could not be read does not wear the mark as if it were ordinary, so those
 * keep the editor's own error and question icons. `mnema-m` is the glyph of the font the manifest
 * names in `contributes.icons`; the level, strong or weak, stays in the word beside it.
 */
export const iconFor = (verdict: Verdict): string =>
  verdict.kind === 'verified' ? 'mnema-m' : verdict.kind === 'failed' ? 'error' : 'question';

/**
 * Text that came from the command line or the record, made inert in markdown: every ASCII
 * punctuation mark is escaped (CommonMark allows it for all of them), so no `[x](command:...)`,
 * emphasis or tag survives, and a line break is a space.
 */
const plain = (text: string): string =>
  text.replace(/\r?\n/g, ' ').replace(/[!-/:-@[-`{-~]/g, '\\$&');

const two = (n: number): string => String(n).padStart(2, '0');

/** A link that opens the settings editor on one setting. */
const settingLink = (label: string, setting: string): string =>
  `[${label}](command:workbench.action.openSettings?${encodeURIComponent(JSON.stringify([setting]))})`;

/** The lines of one tree: its own line with its mark, and the sentence about a newer mnema under it. */
function treeBlock(tree: TreeLine): string[] {
  const icon = tree.mark === undefined ? '' : `$(${tree.mark}) `;
  const own = `${icon}**${plain(tree.scope)}**: ${plain(tree.short ?? tree.headline)}`;
  return tree.newerMnema === undefined ? [own] : [own, `$(info) ${plain(tree.newerMnema)}`];
}

/**
 * The item as a whole. The words about the record are the command line's: the level is what
 * `verify --json` reports and each tree's line is the one the command line wrote for it
 * ({@link TreeLine}); the full text of the verification is behind a link, not in the tooltip. The
 * extension's own words are only about itself (the command is missing, how many decisions await,
 * when it read, the names of its links).
 */
export function describeBar(input: {
  readonly cli: CliState;
  readonly verdict: Verdict;
  readonly channels: readonly Channel[] | undefined;
  /** One line per tree that holds a record, as `verify --json` said them. */
  readonly trees: readonly TreeLine[];
  /** The decisions awaiting a judgment, as the command line counted them; undefined when not read. */
  readonly awaiting: number | undefined;
  readonly readAt: Date;
  /** The sentence `versionNotice` gave, when the command line and the extension differ. */
  readonly notice?: string | undefined;
}): Bar {
  if (input.cli.kind === 'missing') {
    return {
      text: '$(warning) mnema not found',
      tooltip: [
        '**mnema** · command unavailable',
        `The mnema command could not be used: ${plain(input.cli.reason)}. Install @mnema/code, or set ${settingLink('mnema.command', 'mnema.command')} to the executable.`,
      ].join('\n\n'),
      accessibility: { label: 'mnema: command not found', role: 'button' },
      warning: false,
      command: CONTAINER_COMMAND,
    };
  }
  const { verdict } = input;
  const proof =
    verdict.kind === 'verified'
      ? verdict.level
      : verdict.kind === 'failed'
        ? 'verify failed'
        : 'verify unreadable';
  const awaiting = input.awaiting !== undefined && input.awaiting > 0 ? input.awaiting : undefined;
  const off = (input.channels ?? []).filter((c) => !c.on).map((c) => plain(c.name));
  const parts = [`**mnema** · ${plain(proof)}`];
  // Every tree is shown: the number of lines is the number of trees, never a cut of a longer text.
  if (input.trees.length > 0) parts.push(input.trees.flatMap(treeBlock).join('\\\n'));
  if (awaiting !== undefined) {
    parts.push(
      `[${awaitingPhrase(awaiting)}](command:${CONTAINER_COMMAND}) · [What to do](command:mnema.whatToDo)`,
    );
  }
  if (input.channels === undefined || input.channels.length === 0) {
    parts.push('Channels: not read.');
  } else if (off.length > 0) {
    parts.push(`Channels off: ${off.join(', ')}`);
  } else {
    parts.push('Every channel is on.');
  }
  if (input.notice !== undefined) parts.push(input.notice);
  const at = `${two(input.readAt.getHours())}:${two(input.readAt.getMinutes())}:${two(input.readAt.getSeconds())}`;
  parts.push(
    `Read at ${at} · [Refresh](command:mnema.refresh) · ${settingLink('Settings', 'mnema.statusBar')} · [Show the full verification](command:mnema.showVerification)`,
  );
  const tail = awaiting === undefined ? '' : ` · ${awaiting} to judge`;
  return {
    text: `$(${iconFor(verdict)}) ${proof}${tail}`,
    tooltip: parts.join('\n\n'),
    accessibility: {
      label: `mnema: ${proof}${awaiting === undefined ? '' : `, ${awaitingPhrase(awaiting)}`}`,
      role: 'button',
    },
    warning: verdict.kind === 'failed',
    command: CONTAINER_COMMAND,
  };
}
