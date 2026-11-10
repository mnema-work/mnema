# mnema run end

<!-- This page is generated from the help of the command, written where the command is defined under packages/code/src/wiring/: edit it there, then run `pnpm vitest run packages/code/src/cli.golden.test.ts -u` (which rewrites packages/code/src/cli.help.golden.txt) and `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

close a session (by default the one MNEMA_RUN names)

In the help under **Called by a host** · a command of [`mnema run`](run.md).

## Arguments

| Argument | What it does |
| --- | --- |
| `id` | the run to close; omitted, the one MNEMA_RUN names |

## Options

| Option | What it does |
| --- | --- |
| `--which <agent>` | the agent closing this session; required: a close with no agent is credited to you |
| `--outcome <text>` | a short note on how the session went |

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->
<!-- End of the part written by hand. -->

## The whole help

```text
Usage: mnema run end [options] [id]

close a session (by default the one MNEMA_RUN names)

Arguments:
  id                the run to close; omitted, the one MNEMA_RUN names

Options:
  --which <agent>   the agent closing this session; required: a close with no
                    agent is credited to you
  --outcome <text>  a short note on how the session went
  -h, --help        display help for command
```
