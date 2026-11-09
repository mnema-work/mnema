# mnema retract

<!-- This page is generated from the help of the command line (packages/code/src/cli.help.golden.txt): edit it there and run `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

take a memory or an observation back, keeping it in the record (follows the note; takes no --scope)

In the help under **Record**.

## Arguments

| Argument | What it does |
| --- | --- |
| `id` | the id of the note to retract |

## Options

| Option | What it does |
| --- | --- |
| `--reason <text>` | why it is taken back |
| `--which <agent>` | the agent that executed this, when an agent (a script, a CI step) is driving mnema: omit it when you are acting directly. It names the executor only: a retraction follows the note to the tree it was written in. A value that names no agent (an unset variable) is refused, never credited to you. |

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->
<!-- End of the part written by hand. -->

## The whole help

```text
Usage: mnema retract [options] <id>

take a memory or an observation back, keeping it in the record (follows the
note; takes no --scope)

Arguments:
  id               the id of the note to retract

Options:
  --reason <text>  why it is taken back
  --which <agent>  the agent that executed this, when an agent (a script, a CI
                   step) is driving mnema: omit it when you are acting directly.
                   It names the executor only: a retraction follows the note to
                   the tree it was written in. A value that names no agent (an
                   unset variable) is refused, never credited to you.
  -h, --help       display help for command

What recording means here:
  Permanent: mnema is append-only and nothing deletes a fact. A public record
  is committed and reaches every machine that clones the repository.
  Do not record credentials: a recognized format is replaced with a placeholder
  and reported back, but what mnema does not recognize is written verbatim.
  Nor personal data: an email address is replaced with <email>; the mnid already says who wrote.
  Each text field holds at most 65536 bytes; a longer one is refused.
```
