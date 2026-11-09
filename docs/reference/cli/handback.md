# mnema handback

<!-- This page is generated from the help of the command line (packages/code/src/cli.help.golden.txt): edit it there and run `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

check what a subagent hands back when it stops, or print the format it is checked by

In the help under **Called by a host**.

## Options

| Option | What it does |
| --- | --- |
| `--schema` | print the JSON Schema of the block a hand-back ends in, and read nothing |

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->
<!-- End of the part written by hand. -->

## The whole help

```text
Usage: mnema handback [options]

check what a subagent hands back when it stops, or print the format it is
checked by

Options:
  --schema    print the JSON Schema of the block a hand-back ends in, and read
              nothing
  -h, --help  display help for command

What it reads and what it prints:
  The JSON a host hands a SubagentStop hook on stdin. A subagent hands the decisions it
  settled back in its final reply, in one fenced block whose info string is
  `mnema-handback`, holding {"decisions":[{"settled","why","turnedDown"}]}, the list
  empty where it settled nothing. On stdout, the reply the host reads: a block decision
  with the reason, once per stop, when the final reply has no such block or the block is
  not in the format, or {} when it does, when the hook is not SubagentStop, when there is
  no project here, or the reply cannot be read.
  It reads, and writes nothing. It can be switched off with
  `mnema switch off subagent-handback`.
```
