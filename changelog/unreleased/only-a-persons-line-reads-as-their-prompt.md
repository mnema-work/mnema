Fixed

- **Harness text no longer reads as something the person said.** The reading of a Claude Code transcript took a `user`
  line with no `origin` as the person's prompt, so a compaction summary, a local command (`<command-name>`,
  `<local-command-stdout>`) and `[Request interrupted by user]` were counted as a person's words: they could end a
  response in `mnema tally` and be quoted as a correction by the corrections hook. A line is now a person's only when
  the host marks it `origin.kind: human`, and a compaction summary is passed over even when it carries that mark. A slash
  command the person typed still begins a new response, but its text is never quoted as something they said. A
  transcript of an older Claude Code with no `origin` field has no line read as the person's (it fails closed).
