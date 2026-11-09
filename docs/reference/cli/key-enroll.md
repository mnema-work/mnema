# mnema key enroll

<!-- This page is generated from the help of the command line (packages/code/src/cli.help.golden.txt): edit it there and run `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

vouch for a requesting key so it joins this identity (run this on a member)

In the help under **This machine** · a command of [`mnema key`](key.md).

## Arguments

| Argument | What it does |
| --- | --- |
| `request` | the line `mnema key request` printed on the joining machine |

## Options

| Option | What it does |
| --- | --- |
| `--checker` | enroll a key that signs check results only (the line `mnema key request --checker --anchor <id>` printed) |
| `--agent` | enroll a key as an agent of this identity: in the project's committed tree and, where the key lives on this machine, its private tree and the machine's global one (the line `mnema key request --agent <name> --anchor <id>` printed, or the agent's name where its key is here). In the private tree and the global one, where the key lives on this machine and the tree speaks for another identity than the line's, the key's consent is made again under that tree's identity; the committed tree takes the line's identity or refuses. |

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->
<!-- End of the part written by hand. -->

## The whole help

```text
Usage: mnema key enroll [options] <request>

vouch for a requesting key so it joins this identity (run this on a member)

Arguments:
  request     the line `mnema key request` printed on the joining machine

Options:
  --checker   enroll a key that signs check results only (the line `mnema key
              request --checker --anchor <id>` printed)
  --agent     enroll a key as an agent of this identity: in the project's
              committed tree and, where the key lives on this machine, its
              private tree and the machine's global one (the line `mnema key
              request --agent <name> --anchor <id>` printed, or the agent's name
              where its key is here). In the private tree and the global one,
              where the key lives on this machine and the tree speaks for
              another identity than the line's, the key's consent is made again
              under that tree's identity; the committed tree takes the line's
              identity or refuses.
  -h, --help  display help for command
```
