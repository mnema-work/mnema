# mnema inherit

<!-- This page is generated from the help of the command line (packages/code/src/cli.help.golden.txt): edit it there and run `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

read another repository’s decisions, pinned to one of its commits

In the help under **Hand over**.

## Commands

| Command | What it does |
| --- | --- |
| [`mnema inherit set`](inherit-set.md) | point this project at a repository of decisions, at one commit |
| [`mnema inherit update`](inherit-update.md) | move the pointer to a newer commit, showing what changes first |

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->
<!-- End of the part written by hand. -->

## The whole help

```text
Usage: mnema inherit [options] [command]

read another repository’s decisions, pinned to one of its commits

Options:
  -h, --help              display help for command

Commands:
  set [options] <origin>  point this project at a repository of decisions, at
                          one commit
  update [options]        move the pointer to a newer commit, showing what
                          changes first
  help [command]          display help for command

A project points at a repository of decisions (any git repository with a mnema
record) by its location and one commit, in `.mnema/inherit.json`, which is committed.
`mnema brief` then prints that record’s decisions in force in a section of their own,
naming the origin and the commit. They are read, never written: this project does not
sign them and its `verify` does not count them. A record that does not verify at the
commit prints none, and the brief says so. Pointing at an origin is trusting it at that
commit; the commit never moves unless `inherit update --write` moves it.
The copy is kept under the mnema home, outside the project. Only `set` and `update`
use the network; the brief reads this machine’s copy and says when the commit is not there yet.
```
