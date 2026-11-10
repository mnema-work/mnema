# mnema key github

<!-- This page is generated from the help of the command, written where the command is defined under packages/code/src/wiring/: edit it there, then run `pnpm vitest run packages/code/src/cli.golden.test.ts -u` (which rewrites packages/code/src/cli.help.golden.txt) and `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

record that this identity is a GitHub account, so `mnema verify --against-github` can compare the keys that signed with the keys that account publishes

In the help under **This machine** · a command of [`mnema key`](key.md).

## Arguments

| Argument | What it does |
| --- | --- |
| `name` | the GitHub account name |

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->
<!-- End of the part written by hand. -->

## The whole help

```text
Usage: mnema key github [options] <name>

record that this identity is a GitHub account, so `mnema verify
--against-github` can compare the keys that signed with the keys that account
publishes

Arguments:
  name        the GitHub account name

Options:
  -h, --help  display help for command
```
