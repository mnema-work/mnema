# mnema tail

<!-- This page is generated from the help of the command, written where the command is defined under packages/code/src/wiring/: edit it there, then run `pnpm vitest run packages/code/src/cli.golden.test.ts -u` (which rewrites packages/code/src/cli.help.golden.txt) and `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

act on the record's own tails: list them, authorize a cut, relink one

In the help under **This machine**.

## Commands

| Command | What it does |
| --- | --- |
| [`mnema tail list`](tail-list.md) | list the tails that hold events here, the ones a cut can name, with the id `prune` takes |
| [`mnema tail prune`](tail-prune.md) | record that one whole tail was authorized to be cut (it removes nothing) |
| [`mnema tail relink`](tail-relink.md) | relink whole tails of another record into the one this directory names, each signed by its own key |

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->
<!-- End of the part written by hand. -->

## The whole help

```text
Usage: mnema tail [options] [command]

act on the record's own tails: list them, authorize a cut, relink one

Options:
  -h, --help                   display help for command

Commands:
  list                         list the tails that hold events here, the ones a
                               cut can name, with the id `prune` takes
  prune [options] <tail>       record that one whole tail was authorized to be
                               cut (it removes nothing)
  relink [options] <tails...>  relink whole tails of another record into the one
                               this directory names, each signed by its own key
  help [command]               display help for command
```
