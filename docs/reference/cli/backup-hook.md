# mnema backup hook

<!-- This page is generated from the help of the command, written where the command is defined under packages/code/src/wiring/: edit it there, then run `pnpm vitest run packages/code/src/cli.golden.test.ts -u` (which rewrites packages/code/src/cli.help.golden.txt) and `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

install or remove an optional git hook that runs the backup after a commit

In the help under **This machine** · a command of [`mnema backup`](backup.md).

## Commands

| Command | What it does |
| --- | --- |
| [`mnema backup hook install`](backup-hook-install.md) | add the post-commit hook that runs the backup (refuses a hook that is not a shell script, and a hooksPath inside the working tree) |
| [`mnema backup hook uninstall`](backup-hook-uninstall.md) | take out the post-commit block mnema added, and the file only if mnema wrote it whole |

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->
<!-- End of the part written by hand. -->

## The whole help

```text
Usage: mnema backup hook [options] [command]

install or remove an optional git hook that runs the backup after a commit

Options:
  -h, --help      display help for command

Commands:
  install         add the post-commit hook that runs the backup (refuses a hook
                  that is not a shell script, and a hooksPath inside the working
                  tree)
  uninstall       take out the post-commit block mnema added, and the file only
                  if mnema wrote it whole
  help [command]  display help for command

The hook is a post-commit script that runs `mnema backup run` in the background, so a commit
never waits for a network and never fails because of one. It runs only where `install` put
it. It is written where git reads hooks, and refused where core.hooksPath is inside the
working tree (a directory the repository shares). A shell hook that is already there keeps
its text and gets a marked block at the end; any other hook is left as it is. `uninstall`
takes out only what `install` put.
```
