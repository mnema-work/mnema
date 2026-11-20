Changed

- **`mnema decision import` imports an ADR with no context section and an ADR with a large field, instead of refusing them.** A
  document with no decision, no context and no lead now has its `##` sections read as the why, in order and each under the heading
  its author wrote (the status and the options left out), and the plan says so. A why or a turned-down text over the size a
  recorded field may hold (65,536 bytes) is cut at the last blank line that fits and ends in a note carrying the SHA-256 of the
  whole text, which stays in the file the decision names; the plan says where it was cut. A title over that size is still
  refused, now as `TITLE_TOO_LARGE`, and the credential check still runs over the whole text before the cut. The memory and
  ruling readers of `--format` are cut the same way.
