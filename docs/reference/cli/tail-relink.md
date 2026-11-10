# mnema tail relink

<!-- This page is generated from the help of the command, written where the command is defined under packages/code/src/wiring/: edit it there, then run `pnpm vitest run packages/code/src/cli.golden.test.ts -u` (which rewrites packages/code/src/cli.help.golden.txt) and `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

relink whole tails of another record into the one this directory names, each signed by its own key

In the help under **This machine** · a command of [`mnema tail`](tail.md).

## Arguments

| Argument | What it does |
| --- | --- |
| `tails` | the tails to relink, as `tail list` spells them: &lt;fingerprint>-&lt;installation> |

## Options

| Option | What it does |
| --- | --- |
| `--into <record>` | the record they join, as `mnema verify` names it; omitted, the one other record the tails here name |
| `--reason <text>` | why they are relinked (recorded in the fact) |
| `--which <agent>` | the agent that executed this, when an agent (a script, a CI step) is driving mnema: omit it when you are acting directly. It names the executor only: a relink an agent key signs names the agent the record enrolled that key as |

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->
<!-- End of the part written by hand. -->

## The whole help

```text
Usage: mnema tail relink [options] <tails...>

relink whole tails of another record into the one this directory names, each
signed by its own key

Arguments:
  tails            the tails to relink, as `tail list` spells them:
                   <fingerprint>-<installation>

Options:
  --into <record>  the record they join, as `mnema verify` names it; omitted,
                   the one other record the tails here name
  --reason <text>  why they are relinked (recorded in the fact)
  --which <agent>  the agent that executed this, when an agent (a script, a CI
                   step) is driving mnema: omit it when you are acting directly.
                   It names the executor only: a relink an agent key signs names
                   the agent the record enrolled that key as
  -h, --help       display help for command

Each relink is signed by the key the tail id names, which this machine must hold, and
written in a tail of that key that names the record joined, or in a new one born naming it,
checkpointed at once. Only a key the record joined took in counts: the founder of its genesis
identity, or a key that identity enrolled. A relinked tail is frozen at its head.
Nothing is written where the readers would not count a relink.

What recording means here:
  Permanent: mnema is append-only and nothing deletes a fact. A public record
  is committed and reaches every machine that clones the repository.
  Do not record credentials: a recognized format is replaced with a placeholder
  and reported back, but what mnema does not recognize is written verbatim.
  Nor personal data: an email address is replaced with <email>; the mnid already says who wrote.
  Each text field holds at most 65536 bytes; a longer one is refused.
```
