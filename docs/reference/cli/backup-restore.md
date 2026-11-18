# mnema backup restore

<!-- This page is generated from the help of the command, written where the command is defined under packages/code/src/wiring/: edit it there, then run `pnpm vitest run packages/code/src/cli.golden.test.ts -u` (which rewrites packages/code/src/cli.help.golden.txt) and `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

put a copy back into the trees that lost files, never over a file the tree holds

In the help under **This machine** · a command of [`mnema backup`](backup.md).

## Options

| Option | What it does |
| --- | --- |
| `--dry-run` | say what would be put back, and put nothing |

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->

`mnema backup restore` puts the copy back into a tree that lost files, and never over a file the tree holds: a name taken with other bytes stays, a live tail that went further wins, a tail the copy is not the start of refuses the whole restore (a fork or a cut, and no side is taken), a `tailproof.json` that is there stays, and `locks/` and the installation ids and anchors are never restored. `--dry-run` says what would be put back and writes nothing. It does not bring back your key, and says so. See the [backup page](backup.md#backing-up-a-projects-trees-to-a-folder).

<!-- End of the part written by hand. -->

## The whole help

```text
Usage: mnema backup restore [options]

put a copy back into the trees that lost files, never over a file the tree holds

Options:
  --dry-run   say what would be put back, and put nothing
  -h, --help  display help for command
```
