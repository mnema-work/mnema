# mnema run start

<!-- This page is generated from the help of the command, written where the command is defined under packages/code/src/wiring/: edit it there, then run `pnpm vitest run packages/code/src/cli.golden.test.ts -u` (which rewrites packages/code/src/cli.help.golden.txt) and `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

open a session for an agent (facts written in it are pinned to it)

In the help under **Called by a host** · a command of [`mnema run`](run.md).

## Options

| Option | What it does |
| --- | --- |
| `--which <agent>` | the agent this session is for; required: a run with no agent authorizes nothing |
| `--goal <text>` | what this session sets out to do |

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->
<!-- End of the part written by hand. -->

## The whole help

```text
Usage: mnema run start [options]

open a session for an agent (facts written in it are pinned to it)

Options:
  --which <agent>  the agent this session is for; required: a run with no agent
                   authorizes nothing
  --goal <text>    what this session sets out to do
  -h, --help       display help for command
```
