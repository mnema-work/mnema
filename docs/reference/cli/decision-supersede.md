# mnema decision supersede

<!-- This page is generated from the help of the command, written where the command is defined under packages/code/src/wiring/: edit it there, then run `pnpm vitest run packages/code/src/cli.golden.test.ts -u` (which rewrites packages/code/src/cli.help.golden.txt) and `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

supersede a decision with a later one (follows the decision; takes no --scope)

In the help under **Record** · a command of [`mnema decision`](decision.md).

## Arguments

| Argument | What it does |
| --- | --- |
| `old-id` | the decision being superseded |
| `new-id` | the successor decision that replaces it |

## Options

| Option | What it does |
| --- | --- |
| `--reason <text>` | why it is being replaced (required) |

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->
<!-- End of the part written by hand. -->

## The whole help

```text
Usage: mnema decision supersede [options] <old-id> <new-id>

supersede a decision with a later one (follows the decision; takes no --scope)

Arguments:
  old-id           the decision being superseded
  new-id           the successor decision that replaces it

Options:
  --reason <text>  why it is being replaced (required)
  -h, --help       display help for command

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
