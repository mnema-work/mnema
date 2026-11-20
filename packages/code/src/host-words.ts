/**
 * What the check of the person's words (`agent-accept-words.ts`) knows of each host, in ONE table
 * keyed by host: the names an agent of that host declares, the environment variable that gives its
 * session, and whether its conversation can be read here for the words a person typed.
 *
 * NOTHING IN THE PROJECT IS EXCLUSIVE TO ONE HOST, so the check is a row for every host of
 * {@link HOST_NAMES} (a row missing does not compile) and not a branch for one of them. A row says
 * `reads: true` only where this tree holds the host's conversation format with a fixture; the rest
 * say `not readable yet` and why, and an accept from them passes as "words not checked", which the
 * reply, `docs/recording-decisions.md` and `mnema audit antipatterns` say. A format is never
 * guessed: a row becomes readable the day a real session of that host is read and held by a test.
 *
 * The names are folded (case and separators) before they are compared, so `claude-code`,
 * `Claude-Code`, `claude_code` and `claudecode` are one host.
 */

import type { HostName } from './host-names.js';

/** What the check knows of one host. */
export interface HostWords {
  /** The names an agent of this host declares with `--which` or in an MCP handshake, as written. */
  readonly names: readonly string[];
  /** The environment variable that gives the host's session id, where the host leaves one. */
  readonly sessionEnv: string | undefined;
  /** Whether the words a person typed can be read from this host's conversation here. */
  readonly reads: boolean;
  /** Why, in a clause: what is held where it reads, what is missing where it does not. */
  readonly why: string;
}

const NO_FORMAT = 'its conversation file format has not been proved here with a fixture';

/** The table, one row per host. */
export const HOST_WORDS: Readonly<Record<HostName, HostWords>> = {
  claude: {
    names: ['claude-code', 'claude'],
    sessionEnv: 'CLAUDE_CODE_SESSION_ID',
    reads: true,
    why: 'the transcript the plugin’s hooks name (`transcript_path`), read for the lines the host marks as typed by a person',
  },
  vscode: {
    names: ['vscode', 'vs-code', 'visual-studio-code'],
    sessionEnv: undefined,
    reads: false,
    why: `it leaves no session id in the environment mnema reads, and ${NO_FORMAT}`,
  },
  cursor: {
    names: ['cursor', 'cursor-agent', 'cursor-cli'],
    sessionEnv: undefined,
    reads: false,
    why: `it leaves no session id in the environment mnema reads, and ${NO_FORMAT}`,
  },
  codex: {
    names: ['codex', 'codex-cli', 'codex-mcp-client'],
    sessionEnv: undefined,
    reads: false,
    why: `${NO_FORMAT}, and no session id in its environment was read`,
  },
  copilot: {
    names: ['copilot', 'copilot-cli', 'github-copilot-cli', 'github-copilot'],
    sessionEnv: 'COPILOT_AGENT_SESSION_ID',
    reads: false,
    why: `it leaves COPILOT_AGENT_SESSION_ID in the environment (docs/evidence.md), but ${NO_FORMAT}`,
  },
  opencode: {
    names: ['opencode'],
    sessionEnv: undefined,
    reads: false,
    why: `it leaves no session id in the environment mnema reads, and ${NO_FORMAT}`,
  },
  gemini: {
    names: ['gemini', 'gemini-cli'],
    sessionEnv: undefined,
    reads: false,
    why: `it leaves no session id in the environment mnema reads, and ${NO_FORMAT}`,
  },
  qwen: {
    names: ['qwen', 'qwen-code'],
    sessionEnv: undefined,
    reads: false,
    why: `it leaves no session id in the environment mnema reads, and ${NO_FORMAT}`,
  },
  antigravity: {
    names: ['antigravity', 'agy'],
    sessionEnv: undefined,
    reads: false,
    why: `it leaves no session id in the environment mnema reads, and ${NO_FORMAT}`,
  },
  droid: {
    names: ['droid', 'factory-droid'],
    sessionEnv: undefined,
    reads: false,
    why: `it leaves no session id in the environment mnema reads, and ${NO_FORMAT}`,
  },
  goose: {
    names: ['goose'],
    sessionEnv: undefined,
    reads: false,
    why: `it leaves no session id in the environment mnema reads, and ${NO_FORMAT}`,
  },
};

/** A name folded to compare: case and every separator taken off. */
export function foldedAgentName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** The host an agent name belongs to, in any spelling, or `undefined` for a name no row knows. */
export function hostOfAgent(name: string): HostName | undefined {
  const folded = foldedAgentName(name);
  for (const [host, row] of Object.entries(HOST_WORDS)) {
    if (row.names.some((one) => foldedAgentName(one) === folded)) return host as HostName;
  }
  return undefined;
}

/**
 * The session id the environment gives for an agent of that name: the variable its host's row names,
 * or `undefined` where the host has none or the variable is not set.
 */
export function hostSessionOf(
  name: string | undefined,
  env: Readonly<Record<string, string | undefined>>,
): string | undefined {
  if (name === undefined) return undefined;
  const host = hostOfAgent(name);
  const variable = host === undefined ? undefined : HOST_WORDS[host].sessionEnv;
  return variable === undefined ? undefined : env[variable];
}
