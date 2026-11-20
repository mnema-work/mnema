Changed

- **An agent's accept rests on the person's words, or it waits for the person.** In Claude Code with the plugin, an
  `accept` by an agent (the `decision_transition` tool, and `mnema decision move accept <id> --which <agent>`) stands
  when its note quotes, between double quotes, words the person typed in the session or an option the person chose in a
  question; otherwise it is refused with `ACCEPT_NEEDS_THE_PERSONS_WORDS`, nothing is written and the decision stays
  `proposed` for `mnema decision review`. The reply says which it found, typed words or a chosen option. The check
  reads the host's transcript, whose path a `SessionStart` hook now leaves beside the session journal (a path, never a
  word; `mnema tally` answers that event with `{}`); other hosts, a session with no path left, and an accept with no
  agent declared are as before and say the words were not checked. It proves the words are in the transcript, not that
  a person typed them. A quoted passage counts only with 20 characters or more after folding and when it is not pure
  assent ("yes", "sim, pode", "go ahead"), so a short option label does not count on its own. The mark "(Recommended)" is taken off an option label before it is measured. The check keeps what it knows of each host in
  one table, a row for every host (names folded for case and separators, the session id variable, whether the words
  can be read): only Claude Code reads today, and the rest pass as "words not checked" until a format is proved. The command with
  `--which` naming Claude Code in any spelling and no `CLAUDE_CODE_SESSION_ID` is refused as well, and writes nothing. See [Recording decisions](docs/recording-decisions.md).
  The block of standing instructions that `mnema instructions` writes into `AGENTS.md` and the host rules files says it
  too, and is now version v6; a v5 block is the product's to replace and is updated, not read as an edit.
