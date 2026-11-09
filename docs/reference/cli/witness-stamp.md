# mnema witness stamp

<!-- This page is generated from the help of the command line (packages/code/src/cli.help.golden.txt): edit it there and run `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

ask an outside witness to date each tail's last checkpoint (T3)

In the help under **Verify** · a command of [`mnema witness`](witness.md).

## Options

| Option | What it does |
| --- | --- |
| `--calendar <url...>` | the timestamp calendars to ask: several, because any one of them is enough and a proof asked of one server is a proof that stops completing when that server does. Defaults to the public OpenTimestamps calendars. |
| `--global` | also cover this machine's global tree (left out by default): it belongs to no project and is present in every one, and a witness over a tree no verdict reads is work with no reader (default: false) |

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->
<!-- End of the part written by hand. -->

## The whole help

```text
Usage: mnema witness stamp [options]

ask an outside witness to date each tail's last checkpoint (T3)

Options:
  --calendar <url...>  the timestamp calendars to ask: several, because any one
                       of them is enough and a proof asked of one server is a
                       proof that stops completing when that server does.
                       Defaults to the public OpenTimestamps calendars.
  --global             also cover this machine's global tree (left out by
                       default): it belongs to no project and is present in
                       every one, and a witness over a tree no verdict reads is
                       work with no reader (default: false)
  -h, --help           display help for command

What leaves this machine: the SHA-256 of one checkpoint's signed message, and
nothing else: no id, no title, no body, no count. Each calendar is handed a hash
of that digest with a nonce of its own, so no two of them see the same value.

It refuses a tree that is not fully signed: an attestation is filed under the
digest of a checkpoint, and the verifier looks for one under the checkpoint IT
proved. Below that level the two can be different checkpoints.

The answer is a PROMISE, not a proof. It confirms when a Bitcoin block carries it,
which is minutes to hours later; `mnema witness upgrade` is the return visit, and
until then `verify` reads PENDING, which is not coverage.
```
