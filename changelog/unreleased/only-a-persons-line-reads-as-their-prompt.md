Fixed

- **Harness text no longer reads as something the person said.** The reading of a Claude Code transcript took a `user`
  line with no `origin` as the person's prompt, so a compaction summary, a local command (`<command-name>`,
  `<local-command-stdout>`) and `[Request interrupted by user]` were counted as a person's words: they could end a
  response in `mnema tally` and be quoted as a correction by the corrections hook. A line is now a person's only when
  the host marks it `origin.kind: human`, and a summary, a command line or the interruption marker is passed over even
  when it carries that mark.
