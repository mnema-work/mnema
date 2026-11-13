Changed

- **A session is told when the record would not answer it.** The hooks that hand a model a document (the opening, the notes,
  the subagent's start, Gemini CLI's opening and OpenCode's session start) used to open a session with nothing
  when `mnema` refused, so a session that believed it had the rules could have none. They now say it in one line:
  the first paragraph of the refusal (for a stored line the reader cannot read, with its tail named), and that the record
  was not consulted where another process holds it or the run was cut after ten seconds. They stay silent with no project,
  with a channel switched off and with a program on the `PATH` that is not `mnema`. To tell those two apart from the rest,
  `mnema brief --hook` and `mnema recall --hook` open a refusal with its code alone on the first line of the error stream
  (`NO_PROJECT`, `SWITCHED_OFF`, `UNREADABLE_LINE`, or the code of the refusal itself); without `--hook` nothing changes.
