Changed

- **The MCP server reads the host's session id from the table of hosts, not from Claude Code's variable alone.** The goal of a run
  (from the session journal) and its outcome now also work in GitHub Copilot CLI, which leaves `COPILOT_AGENT_SESSION_ID` in the
  server's environment (that its value is the session folder name the hook payloads give is not verified). Codex, Gemini CLI, Qwen Code,
  OpenCode and VS Code are still without one: `CODEX_THREAD_ID` and `GEMINI_SESSION_ID` were added to the host contract's list, and
  they are read the day a run of the host shows them.
- **A hook's text ceiling that was never measured is said to be assumed.** For Copilot CLI, Gemini CLI, OpenCode, Qwen Code and VS Code
  the opening stays cut at Claude Code's 10,000 characters, and its closing paragraph now says that the number is Claude Code's, assumed
  for that host. `mnema brief --hook --host` and `mnema recall --hook --host` take those hosts, and the Copilot CLI, Gemini CLI and
  OpenCode hooks name theirs. Qwen Code and VS Code share Claude Code's hooks file, so their opening does not name them yet.
