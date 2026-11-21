/**
 * WHERE EACH HOST KEEPS THE MNEMA MCP SERVER IT STARTS, read the same way for every host: the config file a host
 * reads from the person's home, the mnema entries in it, and which of them are DEAD (the command or the folder
 * they name is no longer there). `mnema doctor` names what it found per host; `mnema upgrade --fix` removes a dead
 * entry where this product can edit that file's format byte for byte (`doctor-mcp.ts`, strict JSON), and says the
 * exact line to remove everywhere else (Codex's TOML, a file with comments, a file a team commits).
 *
 * Reads only. A live entry is never reported as removable, and a bare command name (`mnema`, `npx`) is not judged:
 * whether it resolves depends on the PATH of the host's own process, which this one cannot know.
 */

import { accessSync, constants, lstatSync, readFileSync } from 'node:fs';
import { basename, delimiter, dirname, isAbsolute, join } from 'node:path';
import { planRemoval, type TablePath } from './doctor-mcp.js';
import { objectAt, rootObject, settingsCandidates, Unsafe } from './doctor-vscode.js';

/** The facts the places depend on: what `DoctorContext` carries, without importing it. */
export interface HostMcpPlaces {
  readonly home: string;
  readonly processEnv: NodeJS.ProcessEnv;
  readonly platform: NodeJS.Platform;
  /** The project's root, where a host reads a file of its own from the project. */
  readonly root: string;
  /** Claude Code's `~/.claude.json`, where the doctor already looks for it. */
  readonly claudeJson: string;
}

/** One config file a host reads its MCP servers from. */
export interface HostMcpFile {
  readonly host:
    | 'claude'
    | 'codex'
    | 'gemini'
    | 'qwen'
    | 'copilot'
    | 'opencode'
    | 'cursor'
    | 'vscode';
  readonly title: string;
  readonly file: string;
  readonly format: 'json' | 'toml';
  /** For a JSON file, the table of servers: the keys from the top-level object down. */
  readonly table: TablePath;
  /** A file a team commits: it is named, never edited. */
  readonly shared: boolean;
}

/** One mnema entry of a host's file. */
export interface HostMcpEntry {
  readonly name: string;
  readonly table: TablePath;
  /** Why it is dead, in words, or undefined where it is not. */
  readonly dead: string | undefined;
  /**
   * Verified to work: the command exists and can be run (or is found on the PATH), and the script and folder it names
   * exist. An entry that is neither dead nor verified is UNKNOWN: it is never removed, and never counts as the one that
   * stays when duplicates are resolved.
   */
  readonly verified: boolean;
  /** For TOML, the first and last line (1-based) of the table that declares it. */
  readonly lines?: readonly [number, number];
  /** The entry of a Claude Code project whose folder is gone: the doctor already says those. */
  readonly projectGone?: true;
}

/** What reading one file found. */
export interface HostMcpScan extends HostMcpFile {
  readonly state: 'absent' | 'unreadable' | 'read';
  readonly why?: string;
  readonly entries: readonly HostMcpEntry[];
  /** The `keyOf` of each entry `--fix` can cut from this file; empty for a file it cannot edit. */
  readonly removable: readonly string[];
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

/** What an entry starts: its command and arguments, whichever way the host writes them (OpenCode's is one array). */
function launchOf(entry: unknown): {
  readonly command: string;
  readonly args: readonly string[];
  readonly cwd: string | undefined;
} {
  const one = asRecord(entry);
  const raw = one?.command;
  const list = Array.isArray(raw) ? raw.map(String) : undefined;
  const command = list !== undefined ? (list[0] ?? '') : typeof raw === 'string' ? raw : '';
  const args =
    list !== undefined ? list.slice(1) : Array.isArray(one?.args) ? one.args.map(String) : [];
  return { command, args, cwd: typeof one?.cwd === 'string' ? one.cwd : undefined };
}

function startsMnemaWith(name: string, launch: ReturnType<typeof launchOf>): boolean {
  const command = launch.command === '' ? '' : basename(launch.command);
  if (launch.args.includes('@mnema/code')) return true;
  if (command === 'mnema' && launch.args.includes('mcp')) return true;
  // The name alone is ours only where nothing says the entry starts another program.
  return name === 'mnema' && (command === '' || command === 'mnema' || launch.args.includes('mcp'));
}

/** Whether one entry of an MCP configuration starts this product's server. */
export function startsMnema(name: string, entry: unknown): boolean {
  return startsMnemaWith(name, launchOf(entry));
}

/** Folders where a disk comes and goes: a path under one that is not there today may be back when the disk is. */
const COMES_AND_GOES = /^(\/mnt|\/media|\/run\/media|\/Volumes|\/net|\/mount)(\/|$)/;
/**
 * Version managers and package stores, on every platform (the path is read with its backslashes as slashes): a version
 * removed today is one a person may install again.
 */
const VERSION_MANAGERS = [
  /(^|\/)\.?(nvm|fnm|volta|asdf|nodenv|mise|n)(\/|$)/i,
  /\/fnm_multishells\//i,
  /\/\.local\/share\/(fnm|mise|pnpm\/nodejs)\//,
  /\/pnpm\/nodejs\//i,
  /\/Cellar\//,
  /\/AppData\/(Roaming|Local)\/(nvm|fnm|Volta|fnm_multishells)\//i,
];

/** The mount points `/etc/fstab` names, where a disk that is not mounted leaves an empty folder or none. */
function fstabMounts(): string[] {
  try {
    return readFileSync('/etc/fstab', 'utf-8')
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line !== '' && !line.startsWith('#'))
      .map((line) => line.split(/\s+/)[1] ?? '')
      .filter((mount) => mount.startsWith('/') && mount !== '/');
  } catch {
    return [];
  }
}

/**
 * Whether a path is GONE: the system said it is not there (ENOENT, ENOTDIR) and nothing says it may be back. Any other
 * answer (EACCES, a disk that is slow or not mounted, a version a manager can install again) is "not known", never
 * dead: a path that does not exist today may come back, and the copy `--fix` keeps restores the entry.
 */
export function isGone(path: string): boolean {
  // A host expands `$VAR`, `${env:VAR}` and `${userHome}` before it starts the command: this product does not.
  if (path.includes('$')) return false;
  try {
    lstatSync(path);
    return false;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== 'ENOENT' && code !== 'ENOTDIR') return false;
  }
  const slashed = path.replace(/\\/g, '/');
  if (COMES_AND_GOES.test(slashed) || VERSION_MANAGERS.some((one) => one.test(slashed))) return false;
  return !fstabMounts().some((mount) => path === mount || path.startsWith(`${mount}/`));
}

type Launch = ReturnType<typeof launchOf>;

/** Whether a file is there and can be run. */
function runnable(path: string): boolean {
  try {
    accessSync(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/** Whether a folder or file is there. */
function there(path: string): boolean {
  try {
    lstatSync(path);
    return true;
  } catch {
    return false;
  }
}

/** Whether a bare command name resolves on this process's PATH. */
function onThePath(command: string): boolean {
  return (process.env.PATH ?? '')
    .split(delimiter)
    .filter((dir) => dir !== '')
    .some((dir) => runnable(join(dir, command)));
}

/**
 * What can be said of an entry, in three states: DEAD (an absolute path the system says is not there, with the reason),
 * VERIFIED (everything it names is there and the command can be run or is on the PATH) and UNKNOWN (neither). A path
 * with `$` in it, one that cannot be read, one under a disk or a version manager that may come back, and a bare name that
 * is not on the PATH are unknown.
 */
function judge(launch: Launch): { dead: string | undefined; verified: boolean } {
  const { command, args, cwd } = launch;
  const program = basename(command).replace(/\.exe$/i, '');
  const script = args[0];
  const runsScript = (program === 'node' || program === 'nodejs') && script !== undefined && isAbsolute(script);
  if (command !== '' && isAbsolute(command) && isGone(command)) {
    return { dead: `its command ${command} no longer exists`, verified: false };
  }
  if (runsScript && isGone(script)) {
    return { dead: `the script ${script} it runs no longer exists`, verified: false };
  }
  if (cwd !== undefined && isAbsolute(cwd) && isGone(cwd)) {
    return { dead: `its folder ${cwd} no longer exists`, verified: false };
  }
  const commandWorks =
    command !== '' &&
    !command.includes('$') &&
    (isAbsolute(command) ? runnable(command) : !/[\\/]/.test(command) && onThePath(command));
  const verified =
    commandWorks &&
    (!runsScript || (!script.includes('$') && there(script))) &&
    (cwd === undefined || (!cwd.includes('$') && isAbsolute(cwd) && there(cwd)));
  return { dead: undefined, verified };
}

/** The config files of every host, read from the person's home. Claude Code's is the one table of `~/.claude.json`. */
export function hostMcpFiles(at: HostMcpPlaces): readonly HostMcpFile[] {
  const dotted = (folder: string, file: string): string => join(at.home, folder, file);
  const xdg = at.processEnv.XDG_CONFIG_HOME;
  const config = xdg === undefined || xdg === '' ? join(at.home, '.config') : xdg;
  const own = (variable: string, folder: string): string => {
    const moved = at.processEnv[variable];
    return moved === undefined || moved === '' ? join(at.home, folder) : moved;
  };
  const vscode = settingsCandidates(at.home, at.platform, at.processEnv).map(
    (settings): HostMcpFile => ({
      host: 'vscode',
      title: 'VS Code',
      file: join(dirname(settings), 'mcp.json'),
      format: 'json',
      table: ['servers'],
      shared: false,
    }),
  );
  return [
    {
      host: 'codex',
      title: 'Codex',
      file: join(own('CODEX_HOME', '.codex'), 'config.toml'),
      format: 'toml',
      table: ['mcp_servers'],
      shared: false,
    },
    {
      host: 'gemini',
      title: 'Gemini CLI',
      file: dotted('.gemini', 'settings.json'),
      format: 'json',
      table: ['mcpServers'],
      shared: false,
    },
    {
      host: 'qwen',
      title: 'Qwen Code',
      file: dotted('.qwen', 'settings.json'),
      format: 'json',
      table: ['mcpServers'],
      shared: false,
    },
    {
      host: 'copilot',
      title: 'Copilot CLI',
      file: join(own('COPILOT_HOME', '.copilot'), 'mcp-config.json'),
      format: 'json',
      table: ['mcpServers'],
      shared: false,
    },
    {
      host: 'opencode',
      title: 'OpenCode',
      file: join(config, 'opencode', 'opencode.json'),
      format: 'json',
      table: ['mcp'],
      shared: false,
    },
    {
      host: 'opencode',
      title: 'OpenCode (this project)',
      file: join(at.root, 'opencode.json'),
      format: 'json',
      table: ['mcp'],
      shared: true,
    },
    {
      host: 'cursor',
      title: 'Cursor',
      file: dotted('.cursor', 'mcp.json'),
      format: 'json',
      table: ['mcpServers'],
      shared: false,
    },
    ...vscode,
  ];
}

/** The header of a TOML table of an MCP server: `[mcp_servers.name]`, with the name bare or quoted. */
const TOML_HEADER =
  /^\s*\[\s*mcp_servers\s*\.\s*(?:"([^"]+)"|'([^']+)'|([A-Za-z0-9_-]+))\s*(\.[^\]]*)?\]\s*(?:#.*)?$/;
const ANY_HEADER = /^\s*\[/;

function tomlString(lines: readonly string[], key: string): string | undefined {
  for (const line of lines) {
    const found = new RegExp(`^\\s*${key}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`).exec(line);
    if (found !== null) return found[1] ?? found[2];
  }
  return undefined;
}

/** The mnema tables of a Codex `config.toml`: read by header and by the lines under it, never rewritten. */
function readToml(text: string): HostMcpEntry[] {
  const lines = text.split(/\r?\n/);
  const found: HostMcpEntry[] = [];
  const spans = new Map<string, { first: number; last: number; body: string[] }>();
  let open: string | undefined;
  lines.forEach((line, at) => {
    const header = TOML_HEADER.exec(line);
    if (header !== null) {
      const name = header[1] ?? header[2] ?? header[3] ?? '';
      open = name;
      const span = spans.get(name) ?? { first: at + 1, last: at + 1, body: [] };
      span.last = at + 1;
      if (header[4] === undefined) span.body = [];
      spans.set(name, span);
      return;
    }
    if (ANY_HEADER.test(line)) {
      open = undefined;
      return;
    }
    const span = open === undefined ? undefined : spans.get(open);
    if (span !== undefined) {
      span.body.push(line);
      if (line.trim() !== '') span.last = at + 1;
    }
  });
  for (const [name, span] of spans) {
    const args = /^\s*args\s*=\s*\[(.*)\]/m.exec(span.body.join('\n'));
    const launch = {
      command: tomlString(span.body, 'command') ?? '',
      args:
        args === null
          ? []
          : [...(args[1] ?? '').matchAll(/"([^"]*)"|'([^']*)'/g)].map((m) => m[1] ?? m[2] ?? ''),
      cwd: tomlString(span.body, 'cwd'),
    };
    if (!startsMnemaWith(name, launch)) continue;
    found.push({
      name,
      table: ['mcp_servers', name],
      ...judge(launch),
      lines: [span.first, span.last],
    });
  }
  return found;
}

function entriesOf(table: unknown, path: TablePath): HostMcpEntry[] {
  const servers = asRecord(table);
  if (servers === undefined) return [];
  return Object.entries(servers)
    .filter(([name, entry]) => startsMnema(name, entry))
    .map(([name, entry]) => ({ name, table: path, ...judge(launchOf(entry)) }));
}

function tableAt(json: unknown, path: TablePath): unknown {
  let at: unknown = json;
  for (const key of path) at = asRecord(at)?.[key];
  return at;
}

/**
 * The table of servers of a JSON file with comments or a trailing comma, which `JSON.parse` refuses: found by the same
 * scanner the edits use, and each entry parsed alone. An entry that still does not parse is left out, and a file the
 * scanner cannot follow is `undefined`.
 */
function lenientTable(text: string, path: TablePath): Record<string, unknown> | undefined {
  try {
    let scan = rootObject(text);
    for (const key of path) {
      const member = scan?.members.find((one) => one.key === key);
      if (member === undefined || text[member.valueStart] !== '{') return {};
      scan = objectAt(text, member.valueStart);
    }
    const table: Record<string, unknown> = {};
    for (const member of scan?.members ?? []) {
      try {
        table[member.key] = JSON.parse(text.slice(member.valueStart, member.valueEnd));
      } catch {
        // An entry with a comment inside it is not read: the file is still named when another entry is.
      }
    }
    return table;
  } catch (error) {
    if (error instanceof Unsafe) return undefined;
    throw error;
  }
}

/** Reads one file: absent, unreadable (with why), or its mnema entries. */
export function scanHostMcp(one: HostMcpFile): HostMcpScan {
  let text: string;
  try {
    text = readFileSync(one.file, 'utf-8');
  } catch {
    return { ...one, state: 'absent', entries: [], removable: [] };
  }
  if (one.format === 'toml') {
    return { ...one, state: 'read', entries: readToml(text), removable: [] };
  }
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    const table = lenientTable(text, one.table);
    if (table === undefined) {
      return {
        ...one,
        state: 'unreadable',
        why: 'it is not JSON this product can follow',
        entries: [],
        removable: [],
      };
    }
    return { ...one, state: 'read', entries: entriesOf(table, one.table), removable: [] };
  }
  const entries = entriesOf(tableAt(json, one.table), one.table);
  const removable = one.shared
    ? []
    : entries
        .filter((entry) => entry.dead !== undefined)
        .filter((entry) => planRemoval(text, one.table, [entry.name]).kind === 'change')
        .map((entry) => keyOf(entry));
  return { ...one, state: 'read', entries, removable };
}

/** Every host's file, read. */
export function scanEveryHost(at: HostMcpPlaces): readonly HostMcpScan[] {
  return hostMcpFiles(at).map(scanHostMcp);
}

/**
 * Claude Code's `~/.claude.json`: the user table, and the table of each project it lists. An entry of a project
 * whose folder is gone is dead whatever its command says: the host will never start it from there again.
 */
export function scanClaudeJson(file: string): HostMcpScan {
  const base: HostMcpFile = {
    host: 'claude',
    title: 'Claude Code',
    file,
    format: 'json',
    table: ['mcpServers'],
    shared: false,
  };
  let text: string;
  try {
    text = readFileSync(file, 'utf-8');
  } catch {
    return { ...base, state: 'absent', entries: [], removable: [] };
  }
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return {
      ...base,
      state: 'unreadable',
      why: 'it is not strict JSON, which is all this reads',
      entries: [],
      removable: [],
    };
  }
  const entries: HostMcpEntry[] = [...entriesOf(asRecord(json)?.mcpServers, ['mcpServers'])];
  const projects = asRecord(asRecord(json)?.projects) ?? {};
  for (const [dir, project] of Object.entries(projects)) {
    const path: TablePath = ['projects', dir, 'mcpServers'];
    for (const entry of entriesOf(asRecord(project)?.mcpServers, path)) {
      const gone = isAbsolute(dir) && isGone(dir);
      entries.push(
        gone
          ? {
              ...entry,
              dead: `its project folder ${dir} no longer exists`,
              verified: false,
              projectGone: true,
            }
          : { ...entry, verified: entry.verified && isAbsolute(dir) && there(dir) },
      );
    }
  }
  const removable = entries
    .filter((entry) => entry.dead !== undefined)
    .filter((entry) => planRemoval(text, entry.table, [entry.name]).kind === 'change')
    .map((entry) => keyOf(entry));
  return { ...base, state: 'read', entries, removable };
}

/** An entry told apart from the others of the same file: its table and its name. */
export function keyOf(entry: HostMcpEntry): string {
  return `${JSON.stringify(entry.table)}#${entry.name}`;
}

/** What to say a person does by hand where this product does not edit the file. */
export function byHand(scan: HostMcpScan, entry: HostMcpEntry): string {
  if (scan.format === 'toml' && entry.lines !== undefined) {
    return `delete the [mcp_servers.${entry.name}] table, lines ${entry.lines[0]} to ${entry.lines[1]} of ${scan.file} (and any [mcp_servers.${entry.name}.…] table under it)`;
  }
  return `delete the “${entry.name}” member of the ${entry.table.map((key) => `“${key}”`).join(' > ')} object in ${scan.file}`;
}
