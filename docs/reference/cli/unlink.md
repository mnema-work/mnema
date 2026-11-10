# mnema unlink

<!-- This page is generated from the help of the command, written where the command is defined under packages/code/src/wiring/: edit it there, then run `pnpm vitest run packages/code/src/cli.golden.test.ts -u` (which rewrites packages/code/src/cli.help.golden.txt) and `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

take a link back, keeping it in the record (only the identity that recorded it; follows the link)

In the help under **Record**.

## Arguments

| Argument | What it does |
| --- | --- |
| `subject` | the entity the link originates from |
| `target` | what the link points at, as it was linked |

## Options

| Option | What it does |
| --- | --- |
| `--rel <label>` | the relation, as it was linked |
| `--reason <text>` | why it is taken back |
| `--which <agent>` | the agent that executed this, when an agent (a script, a CI step) is driving mnema: omit it when you are acting directly. It names the executor only: a retraction follows the link to the tree it was recorded in. A value that names no agent (an unset variable) is refused, never credited to you. |

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->
<!-- End of the part written by hand. -->

## The whole help

```text
Usage: mnema unlink [options] <subject> <target>

take a link back, keeping it in the record (only the identity that recorded it;
follows the link)

Arguments:
  subject          the entity the link originates from
  target           what the link points at, as it was linked

Options:
  --rel <label>    the relation, as it was linked
  --reason <text>  why it is taken back
  --which <agent>  the agent that executed this, when an agent (a script, a CI
                   step) is driving mnema: omit it when you are acting directly.
                   It names the executor only: a retraction follows the link to
                   the tree it was recorded in. A value that names no agent (an
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
