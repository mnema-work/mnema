# mnema handback

<!-- This page is generated from the help of the command, written where the command is defined under packages/code/src/wiring/: edit it there, then run `pnpm vitest run packages/code/src/cli.golden.test.ts -u` (which rewrites packages/code/src/cli.help.golden.txt) and `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

check what a subagent hands back when it stops, or print the format it is checked by

In the help under **Called by a host**.

## Options

| Option | What it does |
| --- | --- |
| `--schema` | print the JSON Schema of the block a hand-back ends in, and read nothing |
| `--host <host>` | the host whose hook runs this, and whose payload arrives on stdin: claude, codex, copilot; claude when none is named |

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->
<!-- End of the part written by hand. -->

## The whole help

```text
Usage: mnema handback [options]

check what a subagent hands back when it stops, or print the format it is
checked by

Options:
  --schema       print the JSON Schema of the block a hand-back ends in, and
                 read nothing
  --host <host>  the host whose hook runs this, and whose payload arrives on
                 stdin: claude, codex, copilot; claude when none is named
  -h, --help     display help for command

What it reads and what it prints:
  The JSON a host hands a SubagentStop hook on stdin: Claude Code's, Codex's, or, with
  --host copilot, Copilot CLI's (under either spelling of its event). A subagent hands the decisions it
  settled back in its final reply, in one fenced block whose info string is
  `mnema-handback`, holding {"decisions":[{"settled","why","turnedDown"}]}, the list
  empty where it settled nothing. On stdout, the reply the host reads: a block decision
  with the reason, once per stop, when the final reply has no such block or the block is
  not in the format, or {} when it does, when the hook is not SubagentStop, when there is
  no project here, or the reply cannot be read. Copilot CLI names no field that says a stop
  is the second one, so there the check is not once per stop.
  It reads, and writes nothing. It can be switched off with
  `mnema switch off subagent-handback`.
```
