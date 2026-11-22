# mnema witness sigstore-check

<!-- This page is generated from the help of the command, written where the command is defined under packages/code/src/wiring/: edit it there, then run `pnpm vitest run packages/code/src/cli.golden.test.ts -u` (which rewrites packages/code/src/cli.help.golden.txt) and `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

check offline that the Sigstore countersignatures of this record name the identity you expect, as `cosign verify-blob` would

In the help under **Verify** · a command of [`mnema witness`](witness.md).

## Options

| Option | What it does |
| --- | --- |
| `--identity <identity>` | the identity the certificate must name, exactly: the e-mail, or the workflow URI (cosign’s --certificate-identity) |
| `--issuer <url>` | the OpenID issuer that must have vouched for it, exactly (cosign’s --certificate-oidc-issuer) |
| `--message-dir <dir>` | write the message each bundle signs into this folder, one file per checkpoint named by its SHA-256, and print the `cosign verify-blob` line that checks the same bundle beside it. A link among the folders above it is followed and the messages land at the real path; refused when the folder itself is a symbolic link, or when its real path is inside a record (a .mnema or .git folder, case folded on macOS and Windows, or the root of a record checked). Folders are made only after every check passes, and a message file that already exists is never overwritten |
| `--global` | also cover this machine's global tree (left out by default): it belongs to no project and is present in every one, and a witness over a tree no verdict reads is work with no reader (default: false) |

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->
<!-- End of the part written by hand. -->

## The whole help

```text
Usage: mnema witness sigstore-check [options]

check offline that the Sigstore countersignatures of this record name the
identity you expect, as `cosign verify-blob` would

Options:
  --identity <identity>  the identity the certificate must name, exactly: the
                         e-mail, or the workflow URI (cosign’s
                         --certificate-identity)
  --issuer <url>         the OpenID issuer that must have vouched for it,
                         exactly (cosign’s --certificate-oidc-issuer)
  --message-dir <dir>    write the message each bundle signs into this folder,
                         one file per checkpoint named by its SHA-256, and print
                         the `cosign verify-blob` line that checks the same
                         bundle beside it. A link among the folders above it is
                         followed and the messages land at the real path;
                         refused when the folder itself is a symbolic link, or
                         when its real path is inside a record (a .mnema or .git
                         folder, case folded on macOS and Windows, or the root
                         of a record checked). Folders are made only after every
                         check passes, and a message file that already exists is
                         never overwritten
  --global               also cover this machine's global tree (left out by
                         default): it belongs to no project and is present in
                         every one, and a witness over a tree no verdict reads
                         is work with no reader (default: false)
  -h, --help             display help for command

The message a bundle signs is the checkpoint’s own signed message, recomputed from
checkpoints.jsonl and never taken from the bundle; its SHA-256 is the name the bundle
is filed under. Exit 0 only when there is a bundle, every one holds by Sigstore’s own
checks, and its certificate names this identity and this issuer.

OFFLINE: the certificate chain, the certificate-transparency timestamp, Rekor’s signed
promise and its proof of inclusion are inside the bundle and are checked against the
Sigstore trust root this binary carries. It does not ask anybody whether that root is
still current or whether Rekor still holds the entry.

It says who signed in to Sigstore, not who wrote the record, and it moves no witness level.
```
