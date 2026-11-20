Added

- **The rules in force you did not accept yourself.** `mnema decision review` shows, after the proposals, each rule in force
  that an agent accepted or whose accept declared no agent, newest first, and marks each one it shows as shown to you; `q`
  stops it, and what it did not show stays on the list. Your own accept at a terminal (no `--which`, standard input and
  standard error terminals) is marked the same way. `mnema` with nothing after it lists the ones that entered force since
  your last review and says how many older ones you have not been shown; before a first review it says the total. `mnema
  show <id>` of a decision says when it was last marked shown. A mark says that your key signed at a terminal with no
  agent declared, not that a person read the rule (`docs/what-it-proves.md`).
- **A new kind, `decision.seen` v1 `{moves?}`**, in the catalog, `event-schema.json` and the published vectors (42). Its
  subject is the decision and `moves` the entry hashes of the accepts it covers, under the envelope's own rule `hashes?`,
  so both readers check it with no new rule (`FORMAT.md` section 4.1). It is written only in the private tree (outside a
  project, the global one), never by the MCP server, and refused (`SEEN_NEEDS_A_PERSON`) with an agent declared or no
  terminal. A rule accepted again on another machine, unseen by the mark, comes back to the list. A binary from 0.1.5 to
  0.1.9 reads the line past and says on its reads of this machine's record that a newer mnema wrote it; 0.1.4 and earlier
  refuse a record that holds one, which only the private tree of a machine that ran a review does.
