/**
 * What the table of hosts says about the session an MCP server was started in, and about the
 * hosts whose ceiling for a hook's text was never measured.
 */

import { describe, expect, it } from 'vitest';
import { hookCeilingFor } from './host-hook.js';
import {
  HOOK_TEXT_HOSTS,
  hookTextIsAssumed,
  hostSessionOf,
  SESSION_VARIABLES,
} from './host-names.js';
import { CLAUDE_CODE_CEILING, ceilingInWords } from './presentation/within-a-hook.js';

describe('the session an MCP server reads from its environment', () => {
  it('reads Claude Code’s and Copilot CLI’s variable, and says which hosts they are', () => {
    expect(SESSION_VARIABLES).toEqual([
      { host: 'claude', name: 'CLAUDE_CODE_SESSION_ID' },
      { host: 'copilot', name: 'COPILOT_AGENT_SESSION_ID' },
    ]);
    expect(hostSessionOf({ CLAUDE_CODE_SESSION_ID: 'claude-run-1' })).toBe('claude-run-1');
    expect(hostSessionOf({ COPILOT_AGENT_SESSION_ID: 'copilot-run-2' })).toBe('copilot-run-2');
  });

  it('knows nothing from a variable no run of a real host has shown, or from an empty one', () => {
    expect(hostSessionOf({ CODEX_THREAD_ID: 'thread', GEMINI_SESSION_ID: 'g' })).toBeUndefined();
    expect(hostSessionOf({ CLAUDE_CODE_SESSION_ID: '' })).toBeUndefined();
    expect(hostSessionOf({})).toBeUndefined();
  });
});

describe('a hook ceiling that was never measured', () => {
  it('is assumed, and the opening says so, for the hosts the row marks', () => {
    for (const host of ['vscode', 'copilot', 'opencode', 'gemini', 'qwen'] as const) {
      expect(hookTextIsAssumed(host)).toBe(true);
      expect(HOOK_TEXT_HOSTS).toContain(host);
      const ceiling = hookCeilingFor(host);
      expect(ceiling.most).toBe(10_000);
      expect(ceilingInWords(ceiling)).toContain('assumed');
    }
    expect(ceilingInWords(hookCeilingFor('gemini'))).toBe(
      '10,000 characters (Claude Code’s, assumed: Gemini CLI’s own ceiling has not been measured)',
    );
  });

  it('is not assumed where it was measured, or where no host is named', () => {
    expect(hookTextIsAssumed('codex')).toBe(false);
    expect(ceilingInWords(hookCeilingFor('codex'))).toBe('2,500 tokens of 4 bytes');
    expect(hookCeilingFor(null)).toBe(CLAUDE_CODE_CEILING);
    expect(ceilingInWords(CLAUDE_CODE_CEILING)).toBe('10,000 characters');
  });
});
