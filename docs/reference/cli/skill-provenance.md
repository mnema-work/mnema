# mnema skill provenance

<!-- This page is generated from the help of the command line (packages/code/src/cli.help.golden.txt): edit it there and run `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

show where each pattern came from (who proposed it, who adopted it)

In the help under **Record** · a command of [`mnema skill`](skill.md).

## Options

| Option | What it does |
| --- | --- |
| `--json` | emit the faithful provenance as JSON |

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->
<!-- End of the part written by hand. -->

## The whole help

```text
Usage: mnema skill provenance [options]

show where each pattern came from (who proposed it, who adopted it)

Options:
  --json      emit the faithful provenance as JSON
  -h, --help  display help for command

This is the AUDIT of the patterns, not the patterns themselves:
  The `skills` tool on the MCP surface serves a pattern’s body to an agent.
  This verb reads who put each one there. `mnema show <id>` reads a body.
  Only an adopted pattern is served to an agent; the other states are not.
  An act with no agent behind it was a person acting directly.
  A consultation is one run served the body, not that the work followed it,
  and counted in this project’s trees and the machine-global one, no other.
  It records nothing: no event, no consultation.
```
