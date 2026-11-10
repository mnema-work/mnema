# mnema check run

<!-- This page is generated from the help of the command, written where the command is defined under packages/code/src/wiring/: edit it there, then run `pnpm vitest run packages/code/src/cli.golden.test.ts -u` (which rewrites packages/code/src/cli.help.golden.txt) and `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

run the check of every rule in force and record each result (run by a checker key, in CI)

In the help under **Verify** · a command of [`mnema check`](check.md).

## Options

| Option | What it does |
| --- | --- |
| `--key <file>` | a checker's private key to sign with, instead of this machine's own |
| `--timeout <seconds>` | how long one check may run before it is stopped and recorded as failed (default 300) |

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->
<!-- End of the part written by hand. -->

## The whole help

```text
Usage: mnema check run [options]

run the check of every rule in force and record each result (run by a checker
key, in CI)

Options:
  --key <file>         a checker's private key to sign with, instead of this
                       machine's own
  --timeout <seconds>  how long one check may run before it is stopped and
                       recorded as failed (default 300)
  -h, --help           display help for command
```
