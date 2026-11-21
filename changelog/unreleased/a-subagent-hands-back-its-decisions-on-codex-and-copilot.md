Added

- **A subagent's decisions come back to the session that started it on Codex and Copilot CLI too.** The `SubagentStop` hook that
  runs `mnema handback` was wired for Claude Code alone; `codex.json` and `copilot.json` now run it, and `mnema handback` takes
  `--host claude|codex|copilot` to read the payload each host documents (Copilot CLI's under either spelling of its event). On
  those two hosts the reply is the decision itself on stdout with exit 0, the form their documentation reads. It is held by a
  test fed the documented payloads, not by a run of either host. Copilot CLI documents no field that says a stop is the second
  one, so there the check is not once per stop; the host's own limit of eight consecutive continuations is the bound. Gemini CLI
  has no hook event for a subagent and OpenCode was not read for one, so the presence map and the plugin's page say that for them.
