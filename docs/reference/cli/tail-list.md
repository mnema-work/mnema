# mnema tail list

<!-- This page is generated from the help of the command, written where the command is defined under packages/code/src/wiring/: edit it there, then run `pnpm vitest run packages/code/src/cli.golden.test.ts -u` (which rewrites packages/code/src/cli.help.golden.txt) and `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

list the tails that hold events here, the ones a cut can name, with the id `prune` takes

In the help under **This machine** · a command of [`mnema tail`](tail.md).

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->
<!-- End of the part written by hand. -->

## The whole help

```text
Usage: mnema tail list [options]

list the tails that hold events here, the ones a cut can name, with the id
`prune` takes

Options:
  -h, --help  display help for command

What each line says, and why it is on it:
  The id is whole: it is what `mnema tail prune` takes.
  The tree is where a waiver over that tail has to land, so `prune` writes there.
  The events and the head are what a waiver would claim; `prune` reads them again.
  `cut authorized` means a waiver in that same tree already authorizes the cut.
  `holds N key(s) the record needs` means the tail founded or enrolled keys the record still depends on: `prune` refuses it
  unless `--lose-keys` names them, and says for each whether the cut breaks it or strands it.
  Nothing here removes anything, and a cut this lists is still yours to carry out.
```
