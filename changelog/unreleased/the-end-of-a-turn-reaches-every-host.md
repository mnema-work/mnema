Added

- **The end-of-turn hook runs on every host that documents one.** `mnema tally` and `mnema corrections` take `--host`
  (`claude`, `codex`, `copilot`, `gemini`, `cursor`; Claude Code's when it is not given) and read the end of a turn in
  the shape the host hands it: Codex's `Stop`, Copilot CLI's `agentStop` (configured as `Stop`), Gemini CLI's
  `AfterAgent` and Cursor's `stop`. The plugin wires them: `codex.json` and `copilot.json` run both verbs at `Stop`,
  Gemini CLI's extension runs them at `AfterAgent` (which cannot add context, so a line they say goes to the person as a
  `systemMessage`), and `hooks.json` gives Cursor a pair of its own, run only where Cursor says it is there. Only
  Claude Code's transcript is read today: for every other host the verbs say on their second stream that the
  transcript is in a format this version does not read, or that the payload named none, and count nothing, keep no
  session journal and record no proposal. The cells of the presence map say it, and reading each host's transcript is
  what is left.
