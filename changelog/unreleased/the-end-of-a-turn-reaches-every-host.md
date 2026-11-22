Added

- **The end-of-turn hook is wired in every host that documents one, and says what each can do.** `mnema tally` and
  `mnema corrections` take `--host` (`claude`, `vscode`, `codex`, `copilot`, `gemini`, `cursor`, `qwen`; Claude Code's
  when it is not given, and VS Code's when the transcript the payload names is in the folder VS Code keeps its own,
  since it sets no variable) and read the end of a turn in the shape the host hands it: `Stop` in Codex, Copilot CLI
  (`agentStop`, configured as `Stop`), Qwen Code and VS Code's agent, `AfterAgent` in Gemini CLI, `stop` in Cursor. The
  plugin wires them: `codex.json` and `copilot.json` at `Stop`, Gemini CLI's extension at `AfterAgent`, and
  `hooks.json` with a pair each for Cursor and Qwen Code, run only where the host says it is there, Claude Code's pair
  yielding to both. State per host, from the table of hosts: Claude Code's transcript is read, and the count, the
  journal and the corrections work; the transcript of VS Code's agent, Codex, Copilot CLI, Gemini CLI, Cursor's
  command-line agent and Qwen Code is not read yet (no reader of its format is built), so for them nothing is counted,
  no journal is kept and no proposal is recorded. Where the row says so, the hooks file carries `--reads no` and the
  handler ends before it starts `mnema` twice a turn (Gemini CLI's script does the same by a constant); run
  by hand, the verbs say it on their second stream. VS Code's agent and Qwen Code, which share Claude Code's hooks file,
  no longer have their transcripts parsed as Claude Code's.
