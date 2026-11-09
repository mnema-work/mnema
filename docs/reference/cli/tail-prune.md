# mnema tail prune

<!-- This page is generated from the help of the command line (packages/code/src/cli.help.golden.txt): edit it there and run `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

record that one whole tail was authorized to be cut (it removes nothing)

In the help under **This machine** · a command of [`mnema tail`](tail.md).

## Arguments

| Argument | What it does |
| --- | --- |
| `tail` | the tail to cut, as `tail list` spells it: &lt;fingerprint>-&lt;installation> |

## Options

| Option | What it does |
| --- | --- |
| `--reason <text>` | why it is being cut (recorded in the fact) |
| `--which <agent>` | the agent that executed this, when an agent (a script, a CI step) is driving mnema: omit it when you are acting directly. It names the executor only: a waiver always follows the tail to the tree that holds it. |
| `--lose-keys <fingerprints>` | cut a tail that founded or enrolled keys the record still depends on, naming every one of them (comma-separated, whole): the refusal prints the list and the command. Those keys stop verifying or cannot write, and the cut's reason starts with them |

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->
<!-- End of the part written by hand. -->

## The whole help

```text
Usage: mnema tail prune [options] <tail>

record that one whole tail was authorized to be cut (it removes nothing)

Arguments:
  tail                        the tail to cut, as `tail list` spells it:
                              <fingerprint>-<installation>

Options:
  --reason <text>             why it is being cut (recorded in the fact)
  --which <agent>             the agent that executed this, when an agent (a
                              script, a CI step) is driving mnema: omit it when
                              you are acting directly. It names the executor
                              only: a waiver always follows the tail to the tree
                              that holds it.
  --lose-keys <fingerprints>  cut a tail that founded or enrolled keys the
                              record still depends on, naming every one of them
                              (comma-separated, whole): the refusal prints the
                              list and the command. Those keys stop verifying or
                              cannot write, and the cut's reason starts with
                              them
  -h, --help                  display help for command

What recording means here:
  Permanent: mnema is append-only and nothing deletes a fact. A public record
  is committed and reaches every machine that clones the repository.
  Do not record credentials: a recognized format is replaced with a placeholder
  and reported back, but what mnema does not recognize is written verbatim.
  Nor personal data: an email address is replaced with <email>; the mnid already says who wrote.
  Each text field holds at most 65536 bytes; a longer one is refused.
```
