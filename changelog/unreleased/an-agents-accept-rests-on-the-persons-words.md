Changed

- **An agent's accept rests on the person's words, or it waits for the person.** In Claude Code with the plugin, an
  `accept` by an agent (the `decision_transition` tool, and `mnema decision move accept <id> --which <agent>`) stands
  when its note quotes, between double quotes, words the person typed in the session or an option the person chose in a
  question; otherwise it is refused with `ACCEPT_NEEDS_THE_PERSONS_WORDS`, nothing is written and the decision stays
  `proposed` for `mnema decision review`. The reply says which it found, typed words or a chosen option. The check
  reads the host's transcript, whose path a `SessionStart` hook now leaves beside the session journal (a path, never a
  word; `mnema tally` answers that event with `{}`); other hosts, a session with no path left, and an accept with no
  agent declared are as before and say the words were not checked. It proves the words are in the transcript, not that
  a person typed them. See [Recording decisions](docs/recording-decisions.md).
