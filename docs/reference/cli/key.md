# mnema key

<!-- This page is generated from the help of the command line (packages/code/src/cli.help.golden.txt): edit it there and run `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

manage this machine's signing keys

In the help under **This machine**.

## Commands

| Command | What it does |
| --- | --- |
| [`mnema key restore`](key-restore.md) | restore a key from a copy of its private half: this machine's identity, or an agent's |
| [`mnema key request`](key-request.md) | ask to bring this machine into an identity (run this on the joining machine) |
| [`mnema key enroll`](key-enroll.md) | vouch for a requesting key so it joins this identity (run this on a member) |
| [`mnema key github`](key-github.md) | record that this identity is a GitHub account, so `mnema verify --against-github` can compare the keys that signed with the keys that account publishes |
| [`mnema key sigstore`](key-sigstore.md) | record that this identity is the one a Sigstore certificate names, so a bundle `mnema witness sigstore` files speaks for it in `mnema verify --against-sigstore` |
| [`mnema key revoke`](key-revoke.md) | retire a key from this identity, from this point forward |
| [`mnema key protect`](key-protect.md) | encrypt this machine's private keys at rest with the passphrase in MNEMA_KEY_PASSPHRASE |
| [`mnema key unprotect`](key-unprotect.md) | write this machine's private keys back in the clear (needs MNEMA_KEY_PASSPHRASE) |

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->
<!-- End of the part written by hand. -->

## The whole help

```text
Usage: mnema key [options] [command]

manage this machine's signing keys

Options:
  -h, --help                      display help for command

Commands:
  restore [options] <file>        restore a key from a copy of its private half:
                                  this machine's identity, or an agent's
  request [options]               ask to bring this machine into an identity
                                  (run this on the joining machine)
  enroll [options] <request>      vouch for a requesting key so it joins this
                                  identity (run this on a member)
  github <name>                   record that this identity is a GitHub account,
                                  so `mnema verify --against-github` can compare
                                  the keys that signed with the keys that
                                  account publishes
  sigstore <identity>             record that this identity is the one a
                                  Sigstore certificate names, so a bundle `mnema
                                  witness sigstore` files speaks for it in
                                  `mnema verify --against-sigstore`
  revoke [options] <fingerprint>  retire a key from this identity, from this
                                  point forward
  protect                         encrypt this machine's private keys at rest
                                  with the passphrase in MNEMA_KEY_PASSPHRASE
  unprotect                       write this machine's private keys back in the
                                  clear (needs MNEMA_KEY_PASSPHRASE)
  help [command]                  display help for command
```
