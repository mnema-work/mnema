Changed

- **A session is told when the record would not answer it.** The hooks that hand a model a document (the opening, the notes,
  the subagent's start, Gemini CLI's opening and OpenCode's session start) used to open a session with nothing
  when `mnema` refused, so a session that believed it had the rules could have none. They now say it in one line:
  the first paragraph of the refusal (for a stored line the reader cannot read, with its tail named), and that the record
  was not consulted where another process holds it or the run was cut after nine seconds (two seconds for `mnema --identify`;
  the generated programs of Gemini CLI and OpenCode share nine seconds between the two verbs of the opening and say it once).
  They stay silent with no project and with a channel switched off. A program on the `PATH` that is not `mnema` is still
  named to the session by the opening and the subagent's start, and the notes and the two generated programs stay silent
  about it. To tell the silent refusals apart from the rest, `mnema brief --hook` and `mnema recall --hook` open a refusal
  with its code alone on the first line of the error stream (`NO_PROJECT`, `SWITCHED_OFF`, `UNREADABLE_LINE`, or the code of
  the refusal itself); a refusal of usage, such as an invalid `--host`, carries none, and the hook is silent for it.
  Without `--hook` nothing changes.
