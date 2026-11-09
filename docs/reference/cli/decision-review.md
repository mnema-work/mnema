# mnema decision review

<!-- This page is generated from the help of the command line (packages/code/src/cli.help.golden.txt): edit it there and run `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

go through the decisions awaiting a judgement one by one, at a terminal

In the help under **Record** · a command of [`mnema decision`](decision.md).

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->
<!-- End of the part written by hand. -->

## The whole help

```text
Usage: mnema decision review [options]

go through the decisions awaiting a judgement one by one, at a terminal

Options:
  -h, --help  display help for command

Asks for one note at the start, used for every verdict unless you write another after the
letter (`a because the benchmark held`). Each verdict is the move `decision move` makes,
signed with your own key; a refusal on one decision is said and the review goes on. Without a
terminal it writes nothing and prints the `decision move` command that rules the same decisions.

What recording means here:
  Permanent: mnema is append-only and nothing deletes a fact. A public record
  is committed and reaches every machine that clones the repository.
  Do not record credentials: a recognized format is replaced with a placeholder
  and reported back, but what mnema does not recognize is written verbatim.
  Nor personal data: an email address is replaced with <email>; the mnid already says who wrote.
  Each text field holds at most 65536 bytes; a longer one is refused.
```
