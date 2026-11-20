// Every command line the plugin's hook files hand a host, read from the files themselves, and the
// payload each one is run with in the Windows and macOS job (`smoke.mjs`).
//
// The four files are generated from `packages/code/src/host-names.ts`: `plugin/hooks/hooks.json`
// (Claude Code, VS Code, Cursor and Qwen Code), `codex.json`, `copilot.json` and
// `plugin/gemini/hooks/hooks.json`. A list kept by hand would miss the hook somebody adds
// tomorrow, so this reads each `type: "command"` entry and turns `node "<root>/<script>" <words>` into
// the script and its arguments. A line it cannot read is an error that names the file: it is never
// skipped, because a skipped line is a line the job says nothing about.
//
// `type: "mcp_tool"` entries are not a process: the host calls the server, so they are returned apart
// and the smoke names them as not run.
//
// Held by `packages/code/tests/every-hook-command-runs-on-the-other-systems.test.ts`.

import { readFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

/** The files, with the host each is for and what `<root>` stands for in its commands. */
const FILES = [
  {
    file: 'plugin/hooks/hooks.json',
    hosts: 'claude-code, vscode, cursor, qwen',
    variable: 'CLAUDE_PLUGIN_ROOT',
    root: 'plugin',
  },
  {
    file: 'plugin/hooks/codex.json',
    hosts: 'codex',
    variable: 'CLAUDE_PLUGIN_ROOT',
    root: 'plugin',
  },
  {
    file: 'plugin/hooks/copilot.json',
    hosts: 'copilot',
    variable: 'CLAUDE_PLUGIN_ROOT',
    root: 'plugin',
  },
  {
    file: 'plugin/gemini/hooks/hooks.json',
    hosts: 'gemini',
    variable: 'extensionPath',
    root: 'plugin/gemini',
  },
];

/** The hook files this reads, by path from the root of the repository. */
export const HOOK_FILES = FILES.map((one) => one.file);

/**
 * `node "${<variable>}/<script>" <words>` and, for Copilot, the `; exit 0` that ends the line. A word is
 * plain: no quote, no `$`, no shell operator, so the arguments are the words split on a space.
 *
 * @param {string} variable
 */
const lineOf = (variable) =>
  new RegExp(`^node "\\$\\{${variable}\\}/([^"]+\\.mjs)"((?: [A-Za-z0-9_,.:-]+)*)(?:; exit 0)?$`);

/**
 * @typedef {{
 *   hosts: string,
 *   file: string,
 *   event: string,
 *   matcher: string | undefined,
 *   script: string,
 *   handler: string,
 *   args: string[],
 *   line: string,
 * }} HookCommand
 */

/**
 * @param {string} repository The root of the repository.
 * @returns {{ commands: HookCommand[], mcpTools: { hosts: string, file: string, event: string, matcher: string | undefined, tool: string }[] }}
 */
export function readHookCommands(repository) {
  /** @type {HookCommand[]} */
  const commands = [];
  /** @type {{ hosts: string, file: string, event: string, matcher: string | undefined, tool: string }[]} */
  const mcpTools = [];
  for (const { file, hosts, variable, root } of FILES) {
    const parsed = JSON.parse(readFileSync(join(repository, file), 'utf-8'));
    for (const [event, groups] of Object.entries(parsed.hooks ?? {})) {
      for (const group of /** @type {{ matcher?: string, hooks?: unknown[] }[]} */ (groups)) {
        for (const entry of /** @type {{ type?: string, command?: string, tool?: string }[]} */ (
          group.hooks ?? []
        )) {
          if (entry.type === 'mcp_tool') {
            mcpTools.push({ hosts, file, event, matcher: group.matcher, tool: String(entry.tool) });
            continue;
          }
          const said = entry.type === 'command' ? lineOf(variable).exec(entry.command ?? '') : null;
          if (said === null) {
            throw new Error(
              `a command line this smoke cannot read: ${file} (${event}): ${JSON.stringify(entry)}`,
            );
          }
          const script = resolve(repository, root, said[1] ?? '');
          commands.push({
            hosts,
            file,
            event,
            matcher: group.matcher,
            script,
            handler: (said[1] ?? '').split('/').pop() ?? '',
            args: (said[2] ?? '').split(' ').filter((word) => word !== ''),
            line: entry.command ?? '',
          });
        }
      }
    }
  }
  return { commands, mcpTools };
}

/**
 * The value that follows a flag, or none.
 *
 * @param {string[]} args
 * @param {string} flag
 */
const after = (args, flag) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined);

/**
 * What a line asks of the environment: the variables its `--where` needs set and the ones its
 * `--unless` needs unset. A line with neither runs in the plain environment.
 *
 * @param {HookCommand} command
 */
export function theEnvironmentAsked(command) {
  const where = after(command.args, '--where');
  const unless = after(command.args, '--unless');
  return {
    set: where === undefined ? [] : [where],
    unset: unless === undefined ? [] : unless.split(','),
  };
}

/**
 * The stdin of the line, in the shape measured where `docs/evidence.md` measures it (the lines
 * "What <host> writes on the stdin of the hook", and `packages/code/tests/host-contract/`). Where the
 * handler reads no field of it, or the host's payload for that event was not measured, a payload of
 * the common fields stands in and the comment says which. `file` is the path of a write, spelled the
 * way the system writes it.
 *
 * @param {HookCommand} command
 * @param {{ project: string, file: string }} where
 * @returns {object | undefined} `undefined` for a line this has no payload for.
 */
export function payloadOf(command, { project, file }) {
  const { handler, args } = command;
  const session = { session_id: 'smoke-session', cwd: project };
  const host = after(args, '--host');
  switch (handler) {
    // The handlers that open a session read no stdin field of it (`session-start.mjs`), or
    // `session_id` (`session-recall.mjs`, `session-compacted.mjs`); what any host writes there was
    // not measured (`docs/evidence.md`: "What any host writes on the stdin of the hook that opens a
    // session"), so these carry the fields Claude Code documents.
    case 'session-start.mjs':
    case 'session-recall.mjs':
      return { ...session, hook_event_name: 'SessionStart', source: 'startup' };
    case 'session-compacted.mjs':
      return { ...session, hook_event_name: 'SessionStart', source: 'compact' };
    // `Stop`: `transcript_path` is read, and the file need not exist.
    case 'session-tally.mjs':
    case 'session-corrections.mjs':
      return {
        ...session,
        hook_event_name: 'Stop',
        stop_hook_active: false,
        transcript_path: join(project, 'no-transcript.jsonl'),
      };
    case 'subagent-start.mjs':
      return {
        ...session,
        hook_event_name: 'SubagentStart',
        agent_id: 'smoke-agent',
        agent_type: 'general-purpose',
      };
    // `stop_hook_active: true` is Claude Code's own mark of a stop that was already sent back once:
    // the handler then does not send it back again, so the line exits 0.
    case 'subagent-stop.mjs':
      return {
        ...session,
        hook_event_name: 'SubagentStop',
        stop_hook_active: true,
        agent_id: 'smoke-agent',
        agent_type: 'general-purpose',
        last_assistant_message: 'Done.',
      };
    // `what-the-host-hands-the-hook.test.ts`: Claude Code's payload after a write holds `tool_input`
    // (`content`, `file_path`), `tool_name`, `tool_response`, `transcript_path`.
    case 'after-a-write.mjs':
      return {
        ...session,
        hook_event_name: 'PostToolUse',
        tool_name: 'Write',
        tool_input: { file_path: file, content: 'x\n' },
        tool_response: { type: 'create', filePath: file },
        transcript_path: join(project, 'no-transcript.jsonl'),
      };
    case 'agent-dispatched.mjs':
      return command.event === 'SessionEnd'
        ? { ...session, hook_event_name: 'SessionEnd', reason: 'other' }
        : {
            ...session,
            hook_event_name: 'PostToolUse',
            tool_name: 'Agent',
            tool_input: { description: 'a smoke dispatch', prompt: 'say nothing' },
            tool_response: {},
          };
    // The settled-choice hook reads `hook_event_name` and `tool_name`; what Codex, Copilot and
    // Gemini write after a question tool ran was not measured (`docs/evidence.md`).
    case 'choice-settled.mjs':
      return {
        ...session,
        hook_event_name: 'PostToolUse',
        tool_name: command.hosts === 'codex' ? 'request_user_input' : 'AskUserQuestion',
        tool_input: {},
        tool_response: {},
      };
    // Cursor's is the shape `plugin/captures/cursor-2026-10-22.json` holds.
    case 'edit-refuses-a-write.mjs':
      if (host === 'cursor') {
        return {
          hook_event_name: 'preToolUse',
          cursor_version: '2026.09.18',
          tool_name: 'Write',
          tool_input: { file_path: file, content: 'x\n' },
          workspace_roots: [project],
        };
      }
      if (host === 'codex') {
        // `what-the-host-hands-the-hook.codex.test.ts`: `tool_input.command` is the patch, with the
        // path as the model wrote it: relative, below `cwd`.
        const written = relative(project, file).split(sep).join('/');
        return {
          ...session,
          hook_event_name: 'PreToolUse',
          tool_name: 'apply_patch',
          tool_input: {
            command: `*** Begin Patch\n*** Add File: ${written}\n+x\n*** End Patch`,
          },
        };
      }
      // Qwen Code is handed the name its own tool has, `write_file`, with the path under
      // `file_path` (`packages/code/src/host-hook.ts`, the table of writing tools).
      return {
        ...session,
        hook_event_name: 'PreToolUse',
        tool_name: 'write_file',
        tool_input: { file_path: file, content: 'x\n' },
      };
    case 'edit-asks-a-person.mjs':
      // `what-the-host-hands-the-hook.vscode.test.ts`: `create_file` with `filePath` and `content`;
      // `what-the-host-hands-the-hook.copilot.test.ts`: `Write` with `path` and `file_text`.
      return host === 'copilot'
        ? {
            ...session,
            hook_event_name: 'PreToolUse',
            tool_name: 'Write',
            tool_input: { path: file, file_text: 'x\n' },
          }
        : {
            ...session,
            hook_event_name: 'PreToolUse',
            tool_name: 'create_file',
            tool_input: { filePath: file, content: 'x\n' },
          };
    case 'edit-rules-beside.mjs':
      return {
        ...session,
        hook_event_name: 'PostToolUse',
        tool_name: 'Write',
        tool_input: { path: file, file_text: 'x\n' },
      };
    // `what-the-host-hands-the-hook.gemini.test.ts`: `BeforeTool`, `write_file` with `file_path`.
    case 'mnema.mjs': {
      const mode = args[0];
      if (mode === 'gate') {
        return {
          ...session,
          hook_event_name: 'BeforeTool',
          tool_name: 'write_file',
          tool_input: { file_path: file, content: 'x\n' },
        };
      }
      if (mode === 'beside') {
        return {
          ...session,
          hook_event_name: 'AfterTool',
          tool_name: 'write_file',
          tool_input: { file_path: file, content: 'x\n' },
        };
      }
      if (mode === 'settled') {
        return { ...session, hook_event_name: 'AfterTool', tool_name: 'ask_user', tool_input: {} };
      }
      return { ...session, hook_event_name: 'SessionStart', source: 'startup' };
    }
    default:
      return undefined;
  }
}
