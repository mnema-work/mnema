# mnema key request

<!-- This page is generated from the help of the command, written where the command is defined under packages/code/src/wiring/: edit it there, then run `pnpm vitest run packages/code/src/cli.golden.test.ts -u` (which rewrites packages/code/src/cli.help.golden.txt) and `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

ask to bring this machine into an identity (run this on the joining machine)

In the help under **This machine** · a command of [`mnema key`](key.md).

## Options

| Option | What it does |
| --- | --- |
| `--anchor <id>` | the identity to join (the `mnid:…` its machine prints): a prefix of one this record knows also names it; the request is signed over the whole value either way |
| `--key <file>` | a private key to speak for instead of this machine's own |
| `--checker` | ask to sign check results only, under this key's own identity, instead of joining (for the machine that runs `mnema check run`, such as a CI runner) |
| `--agent <name>` | ask to be enrolled as an AGENT of that identity under &lt;name>: a key of its own, made in the agent's folder of this machine's data directory and never beside yours (or the one --key names, which is not made), that signs for the identity and names that agent on everything it signs. The line consents to that one identity; in the private tree and the global one, where the key lives on this machine and the tree speaks for another, `key enroll --agent <name>` on this machine makes the consent again under that tree's identity |

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->
<!-- End of the part written by hand. -->

## The whole help

```text
Usage: mnema key request [options]

ask to bring this machine into an identity (run this on the joining machine)

Options:
  --anchor <id>   the identity to join (the `mnid:…` its machine prints): a
                  prefix of one this record knows also names it; the request is
                  signed over the whole value either way
  --key <file>    a private key to speak for instead of this machine's own
  --checker       ask to sign check results only, under this key's own identity,
                  instead of joining (for the machine that runs `mnema check
                  run`, such as a CI runner)
  --agent <name>  ask to be enrolled as an AGENT of that identity under <name>:
                  a key of its own, made in the agent's folder of this machine's
                  data directory and never beside yours (or the one --key names,
                  which is not made), that signs for the identity and names that
                  agent on everything it signs. The line consents to that one
                  identity; in the private tree and the global one, where the
                  key lives on this machine and the tree speaks for another,
                  `key enroll --agent <name>` on this machine makes the consent
                  again under that tree's identity
  -h, --help      display help for command
```
