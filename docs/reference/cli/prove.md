# mnema prove

<!-- This page is generated from the help of the command, written where the command is defined under packages/code/src/wiring/: edit it there, then run `pnpm vitest run packages/code/src/cli.golden.test.ts -u` (which rewrites packages/code/src/cli.help.golden.txt) and `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

write the proof of one decision a stranger checks offline, or check one

In the help under **Verify**.

## Arguments

| Argument | What it does |
| --- | --- |
| `decision` | the decision: its id or its ADR label |

## Options

| Option | What it does |
| --- | --- |
| `--out <file>` | write the proof to this file (refused when it exists) instead of standard output |
| `--private` | prove a decision of this machine's private tree, which no clone carries (default: false) |
| `--check <file>` | check a proof from the file alone, and say what it proves and what it does not |

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->
The proof is one file: the signed lines of the decision, the roster facts that make its keys count, the
tail proofs, the public keys and a manifest of its text, state and moves. `mnema prove --check <file>`
and the second reader (`python3 packages/chain/verifier/mnema_verify.py proof <file>`) check it with
nothing else. What it proves, and what it does not: [A proof of one decision](../../a-proof-of-one-decision.md);
the bytes: [FORMAT.md, section 9](../../../packages/chain/FORMAT.md#9-a-proof-of-one-decision).
<!-- End of the part written by hand. -->

## The whole help

```text
Usage: mnema prove [options] [decision]

write the proof of one decision a stranger checks offline, or check one

Arguments:
  decision        the decision: its id or its ADR label

Options:
  --out <file>    write the proof to this file (refused when it exists) instead
                  of standard output
  --private       prove a decision of this machine's private tree, which no
                  clone carries (default: false)
  --check <file>  check a proof from the file alone, and say what it proves and
                  what it does not
  -h, --help      display help for command
```
