# mnema run

<!-- This page is generated from the help of the command, written where the command is defined under packages/code/src/wiring/: edit it there, then run `pnpm vitest run packages/code/src/cli.golden.test.ts -u` (which rewrites packages/code/src/cli.help.golden.txt) and `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

open and close the session an agent works inside

In the help under **Called by a host**.

## Commands

| Command | What it does |
| --- | --- |
| [`mnema run start`](run-start.md) | open a session for an agent (facts written in it are pinned to it) |
| [`mnema run end`](run-end.md) | close a session (by default the one MNEMA_RUN names) |

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->
<!-- End of the part written by hand. -->

## The whole help

```text
Usage: mnema run [options] [command]

open and close the session an agent works inside

Options:
  -h, --help          display help for command

Commands:
  start [options]     open a session for an agent (facts written in it are
                      pinned to it)
  end [options] [id]  close a session (by default the one MNEMA_RUN names)
  help [command]      display help for command

What recording means here:
  Permanent: mnema is append-only and nothing deletes a fact. A public record
  is committed and reaches every machine that clones the repository.
  Do not record credentials: a recognized format is replaced with a placeholder
  and reported back, but what mnema does not recognize is written verbatim.
  Nor personal data: an email address is replaced with <email>; the mnid already says who wrote.
  Each text field holds at most 65536 bytes; a longer one is refused.
```
