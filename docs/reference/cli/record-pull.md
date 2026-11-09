# mnema record pull

<!-- This page is generated from the help of the command line (packages/code/src/cli.help.golden.txt): edit it there and run `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

git pull over tails grown here and not yet committed

In the help under **The git log** · a command of [`mnema record`](record.md).

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->
<!-- End of the part written by hand. -->

## The whole help

```text
Usage: mnema record pull [options]

git pull over tails grown here and not yet committed

Options:
  -h, --help  display help for command

It refuses, writing nothing, when a file outside .mnema/ has changes, or when a tail file
here and on the branch followed is not one the start of the other (a fork), naming each.
Then it runs `git pull --autostash` with the mnema merge driver given on that one command
line, puts back a new tail git did not track yet, and verifies the record. It writes no
git configuration.
```
