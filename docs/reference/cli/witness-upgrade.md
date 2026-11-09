# mnema witness upgrade

<!-- This page is generated from the help of the command line (packages/code/src/cli.help.golden.txt): edit it there and run `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

go back for every attestation this record is waiting on (T3)

In the help under **Verify** · a command of [`mnema witness`](witness.md).

## Options

| Option | What it does |
| --- | --- |
| `--blocks <url>` | where a block header is read from once an attestation confirms. Asked ONCE per block: the 80 bytes are then part of the record, and every verification after that is arithmetic on this machine. Defaults to a public block explorer. |
| `--global` | also cover this machine's global tree (left out by default): it belongs to no project and is present in every one, and a witness over a tree no verdict reads is work with no reader (default: false) |

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->
<!-- End of the part written by hand. -->

## The whole help

```text
Usage: mnema witness upgrade [options]

go back for every attestation this record is waiting on (T3)

Options:
  --blocks <url>  where a block header is read from once an attestation
                  confirms. Asked ONCE per block: the 80 bytes are then part of
                  the record, and every verification after that is arithmetic on
                  this machine. Defaults to a public block explorer.
  --global        also cover this machine's global tree (left out by default):
                  it belongs to no project and is present in every one, and a
                  witness over a tree no verdict reads is work with no reader
                  (default: false)
  -h, --help      display help for command

It goes back for EVERY request the tail still has open, not only the newest one.
Proofs stay under the checkpoint they were filed under and the head moves on, so a
request made this morning is usually no longer the head by the time a calendar has
an answer for it. Newest first, and it stops at the first one that confirms: below
that point a proof dates less of the record at a later instant, so no reading would
ever quote it. One that cannot be carried through is reported and the rest go on.

Safe to repeat: a calendar with nothing yet answers so, and the proof comes back
as it went in. A header this fetches is checked against the block it claims to be
(it hashes to that block's id), so a substituted one is not a matter of trust.

There is no --calendar here, and the reason is that there is nothing to choose:
every request the walk finds NAMES the calendar that took it. Only `stamp` picks,
because only `stamp` sends something nobody holds yet.

The address a request names is checked before it is asked, because it was read off
a FILE and a proof can arrive from anywhere: it has to be an https address at one
of the public timestamp operators, and a redirect is followed only while it stays
on the same host. Anything else is reported by name and not contacted: a separate
line from the one a calendar that is down gets, because they call for opposite
responses.
```
