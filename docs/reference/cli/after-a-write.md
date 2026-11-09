# mnema after-a-write

<!-- This page is generated from the help of the command line (packages/code/src/cli.help.golden.txt): edit it there and run `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

copy a note of the host’s memory into the private tree, or name the door of a decision file, for a PostToolUse hook

In the help under **Called by a host**.

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->
<!-- End of the part written by hand. -->

## The whole help

```text
Usage: mnema after-a-write [options]

copy a note of the host’s memory into the private tree, or name the door of a
decision file, for a PostToolUse hook

Options:
  -h, --help  display help for command

What it reads and what it does:
  The JSON a host hands a PostToolUse hook after a Write or an Edit, on stdin.
  A note of Claude Code’s own memory for this project (projects/<project>/memory/*.md,
  <project> named as the host names it after the main working tree, under
  $CLAUDE_CONFIG_DIR or ~/.claude, or the autoMemoryDirectory setting) is copied as a
  memory into this machine’s private tree, once per content, unless
  `mnema switch off host-memory-mirror` was run. The index MEMORY.md and a note of
  `type: user` are never copied, and nothing goes to the public tree.
  A file that holds decisions (an ADR, a plan, a ledger, a rules file) that the record
  cites nowhere gets one line naming the command that reads it, once per session and
  file. Nothing is written for it.
  On stdout, the reply the host reads, or {}.
```
