# mnema commit-hook

<!-- This page is generated from the help of the command line (packages/code/src/cli.help.golden.txt): edit it there and run `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

install or remove an optional git hook that suggests the Mnema-Decision trailer

In the help under **The git log**.

## Commands

| Command | What it does |
| --- | --- |
| [`mnema commit-hook install`](commit-hook-install.md) | write the prepare-commit-msg hook in this repository (refuses to replace another one) |
| [`mnema commit-hook uninstall`](commit-hook-uninstall.md) | remove the prepare-commit-msg hook, only if mnema wrote it |
| [`mnema commit-hook suggest`](commit-hook-suggest.md) | what the hook calls: append the suggestion to a commit message file |

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->
<!-- End of the part written by hand. -->

## The whole help

```text
Usage: mnema commit-hook [options] [command]

install or remove an optional git hook that suggests the Mnema-Decision trailer

Options:
  -h, --help                       display help for command

Commands:
  install                          write the prepare-commit-msg hook in this
                                   repository (refuses to replace another one)
  uninstall                        remove the prepare-commit-msg hook, only if
                                   mnema wrote it
  suggest <message-file> [source]  what the hook calls: append the suggestion to
                                   a commit message file
  help [command]                   display help for command

The hook is a prepare-commit-msg script. It appends a few # comment lines to the message
of a commit made in an editor, naming the decisions in force that govern the staged files;
git drops them if you leave them, and removing the "# " in front of a line cites it.
It runs only where `install` put it, never overwrites a hook that is not its own, follows
core.hooksPath, and never fails a commit.
```
