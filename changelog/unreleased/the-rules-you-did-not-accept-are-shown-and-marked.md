Added

- **The rules in force you did not accept yourself.** `mnema decision review` shows, after the proposals, each rule in force
  that an agent accepted or whose accept declared no agent, newest first, and marks each one it shows as shown to you; `q`
  stops it, and what it did not show stays on the list. ANY accept made at a terminal with no agent declared (`decision
  move accept`, `decision review`, and `mnema init` answering on its screen whether agents may accept) is marked the same
  way, so it writes a `decision.seen` too; the library (`@mnema/sdk`) marks nothing. `mnema` with nothing after it lists
  the ones that entered force since your last review or accept at a terminal and says how many older ones you have not
  been shown; before a first mark it says the total. `mnema
  show <id>` of a decision says when it was last marked shown. A mark says that your key signed at a terminal with no
  agent declared, not that a person read the rule (`docs/what-it-proves.md`).
- **A new kind, `decision.seen` v1 `{moves?}`**, in the catalog, `event-schema.json` and the published vectors (42). Its
  subject is the decision and `moves` the entry hashes of the accepts it covers, under the envelope's own rule `hashes?`,
  so both readers check it with no new rule (`FORMAT.md` section 4.1). It is written only in the private tree (outside a
  project, the global one), never by the MCP server, and refused (`SEEN_NEEDS_A_PERSON`) with an agent declared or no
  terminal. A rule accepted again on another machine, unseen by the mark, comes back to the list. A binary from 0.1.5 to
  0.1.9 reads the line past and says on its reads of this machine's record that a newer mnema wrote it; 0.1.4 and earlier
  refuse a record that holds one, which the private tree of a machine does once it ran a review, accepted a decision at a
  terminal or answered `mnema init` on its screen. The edit hook of VS Code and Cursor reads such a line past as
  `mnema` from 0.1.5 does, and still starts `mnema` where a line holds an address marker or is a version ahead of a kind it
  reads.
- **Two versions of mnema on one clone share one read cache file.** The cache (`projection.db`) is stamped with the code that
  built it, and only the newer version takes the file over; a binary of an older or the same version (a terminal and an editor
  extension, say) builds the cache in memory for that process and leaves the file alone, so it pays a replay of the record on each
  command: that replay was measured, on a record of 3,449 lines, at 0.64 to 0.84 s a `status` against 0.21 s with the cache (ADR-633).
