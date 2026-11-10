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

## Framing that work in a session

`--which` names the agent on each fact. A **run** frames the session those facts
belong to, and records that *you* opened it for that agent, so the work is not
just attributed to an agent, it is authorized by a person. The MCP server opens
one per connection; on the command line you open it yourself:

```sh
mnema run start --which release-bot --goal "regenerate the fixtures"
#> Started run 019fa572-32c2-7780-b1a7-0fe895a1c7ef
#>   for release-bot: regenerate the fixtures
#>
#> export MNEMA_RUN=019fa572-32c2-7780-b1a7-0fe895a1c7ef

export MNEMA_RUN=019fa572-32c2-7780-b1a7-0fe895a1c7ef

# Every fact written from here on names that session.
mnema task create "Regenerate the fixtures" --which release-bot

mnema run end --which release-bot --outcome "fixtures regenerated"
unset MNEMA_RUN
```

While it is open, `mnema resume --actor "$ME"` lists it among the runs still open;
afterwards the same command shows where it left off. Two rules keep the record
honest: a run always names an agent (one that named nobody would prove no
delegation), and the id in `MNEMA_RUN` is checked against the record before
anything is written: a run this project has no record of, or one already ended,
refuses the write instead of stamping a session nothing can vouch for.

An MCP session ends its run when the connection ends: the client hanging up, or the
host asking the process to stop. A process killed outright records nothing on the way
out, so its run stays open, and nothing here closes a run it did not open: no rule can
tell an abandoned session from a live one that is idle, and two sessions running at
once make every such rule wrong. So `resume` reports what can be known (how long each
open run has been open, and how long since anything was recorded in it) and
`mnema run end <id> --which <agent>` is how you close one yourself.

Working the CLI yourself needs no run: the identity that signs each fact already
carries the authority a run exists to delegate.

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
