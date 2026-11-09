# mnema decision move

<!-- This page is generated from the help of the command line (packages/code/src/cli.help.golden.txt): edit it there and run `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

accept or reject a decision (follows the decision; takes no --scope)

In the help under **Record** · a command of [`mnema decision`](decision.md).

## Arguments

| Argument | What it does |
| --- | --- |
| `action` | the transition (accept, reject) |
| `id` | the decision id (the value shown when it was recorded): several, to move each one with the same verdict and note |

## Options

| Option | What it does |
| --- | --- |
| `--note <text>` | why this verdict (required by accept, reject) |

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->
<!-- End of the part written by hand. -->

## The whole help

```text
Usage: mnema decision move [options] <action> <id...>

accept or reject a decision (follows the decision; takes no --scope)

Arguments:
  action         the transition (accept, reject)
  id             the decision id (the value shown when it was recorded):
                 several, to move each one with the same verdict and note

Options:
  --note <text>  why this verdict (required by accept, reject)
  -h, --help     display help for command

Also accepted here (declared on the parent group):
  --which <agent>  the agent that executed this move, when an agent (a script,
                   a CI step) is driving mnema: omit it when you are acting
                   directly. It names the executor only: a move always follows
                   the entity to the tree it was born in.

What recording means here:
  Permanent: mnema is append-only and nothing deletes a fact. A public record
  is committed and reaches every machine that clones the repository.
  Do not record credentials: a recognized format is replaced with a placeholder
  and reported back, but what mnema does not recognize is written verbatim.
  Nor personal data: an email address is replaced with <email>; the mnid already says who wrote.
  Each text field holds at most 65536 bytes; a longer one is refused.
```
