# mnema witness

<!-- This page is generated from the help of the command, written where the command is defined under packages/code/src/wiring/: edit it there, then run `pnpm vitest run packages/code/src/cli.golden.test.ts -u` (which rewrites packages/code/src/cli.help.golden.txt) and `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

ask an outside witness to date this record, and read where that stands

In the help under **Verify**.

## Options

| Option | What it does |
| --- | --- |
| `--global` | also cover this machine's global tree (left out by default): it belongs to no project and is present in every one, and a witness over a tree no verdict reads is work with no reader (default: false) |
| `--json` | emit where the proof stands as JSON instead of prose: one entry per tail, with the reading as the verifier derived it |

## Commands

| Command | What it does |
| --- | --- |
| [`mnema witness stamp`](witness-stamp.md) | ask an outside witness to date each tail's last checkpoint (T3) |
| [`mnema witness upgrade`](witness-upgrade.md) | go back for every attestation this record is waiting on (T3) |
| [`mnema witness sigstore`](witness-sigstore.md) | countersign each tail's last checkpoint with a Sigstore certificate: who signed in, and when it was logged |

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->
<!-- End of the part written by hand. -->

## The whole help

```text
Usage: mnema witness [options] [command]

ask an outside witness to date this record, and read where that stands

Options:
  --global            also cover this machine's global tree (left out by
                      default): it belongs to no project and is present in every
                      one, and a witness over a tree no verdict reads is work
                      with no reader (default: false)
  --json              emit where the proof stands as JSON instead of prose: one
                      entry per tail, with the reading as the verifier derived
                      it
  -h, --help          display help for command

Commands:
  stamp [options]     ask an outside witness to date each tail's last checkpoint
                      (T3)
  upgrade [options]   go back for every attestation this record is waiting on
                      (T3)
  sigstore [options]  countersign each tail's last checkpoint with a Sigstore
                      certificate: who signed in, and when it was logged
```
