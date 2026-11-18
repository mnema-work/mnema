# mnema backup restore

<!-- This page is generated from the help of the command, written where the command is defined under packages/code/src/wiring/: edit it there, then run `pnpm vitest run packages/code/src/cli.golden.test.ts -u` (which rewrites packages/code/src/cli.help.golden.txt) and `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

put a copy back into the trees that lost files, never over a file the tree holds; a copy of another record is asked first, and --undo puts back what it replaced

In the help under **This machine** · a command of [`mnema backup`](backup.md).

## Options

| Option | What it does |
| --- | --- |
| `--dry-run` | say what would be put back, and put nothing |
| `--from <record>` | take the copy of this record (64 hex) from the project's folder, instead of the project's own |
| `--undo` | put back what the last restore of another record kept aside |

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->

`mnema backup restore` puts the copy back into a tree that lost files, and never over a file the tree holds: a name taken with other bytes stays, a live tail that went further wins, a tail the copy is not the start of refuses the whole restore (a fork or a cut, and no side is taken), a `tailproof.json` that is there stays, and `locks/` and the installation ids and anchors are never restored. `--dry-run` says what would be put back and writes nothing. A copy of another record (`--from <record>`) is asked first, at a terminal, with the tree it replaces moved to `<git directory>/mnema/before-restore-<UTC date>/` (in a project outside git, to `<mnema home>/before-restore/<UTC date>/`, the home being `~/.mnema` or `$MNEMA_HOME`), and `--undo` puts back the newest one (no restore deletes a folder kept aside; you delete them by hand, and `backup status` lists them); a project with no record name takes the name from the copy and asks the same. It does not bring back your key, and says so. See the [backup page](backup.md#backing-up-a-projects-trees-to-a-folder).

<!-- End of the part written by hand. -->

## The whole help

```text
Usage: mnema backup restore [options]

put a copy back into the trees that lost files, never over a file the tree
holds; a copy of another record is asked first, and --undo puts back what it
replaced

Options:
  --dry-run        say what would be put back, and put nothing
  --from <record>  take the copy of this record (64 hex) from the project's
                   folder, instead of the project's own
  --undo           put back what the last restore of another record kept aside
  -h, --help       display help for command

What a restore of another record replaces is moved, never copied, and is kept until you delete it by hand:
in a repository, to <git directory>/mnema/before-restore-<UTC date>/; in a project outside git, to
<mnema home>/before-restore/<UTC date>/ (the mnema home is ~/.mnema, or $MNEMA_HOME when it is set).
No restore deletes a folder kept there, and `mnema backup status` lists them.
```
