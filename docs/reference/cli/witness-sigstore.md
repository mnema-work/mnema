# mnema witness sigstore

<!-- This page is generated from the help of the command, written where the command is defined under packages/code/src/wiring/: edit it there, then run `pnpm vitest run packages/code/src/cli.golden.test.ts -u` (which rewrites packages/code/src/cli.help.golden.txt) and `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

countersign each tail's last checkpoint with a Sigstore certificate: who signed in, and when it was logged

In the help under **Verify** · a command of [`mnema witness`](witness.md).

## Options

| Option | What it does |
| --- | --- |
| `--global` | also cover this machine's global tree (left out by default): it belongs to no project and is present in every one, and a witness over a tree no verdict reads is work with no reader (default: false) |

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->
<!-- End of the part written by hand. -->

## The whole help

```text
Usage: mnema witness sigstore [options]

countersign each tail's last checkpoint with a Sigstore certificate: who signed
in, and when it was logged

Options:
  --global    also cover this machine's global tree (left out by default): it
              belongs to no project and is present in every one, and a witness
              over a tree no verdict reads is work with no reader (default:
              false)
  -h, --help  display help for command

What leaves this machine: to Fulcio (fulcio.sigstore.dev), a sign-in token and a key made
for this act alone; to Rekor (rekor.sigstore.dev), the SHA-256 of each checkpoint and a
signature over it, never the record's events. AND YOUR IDENTITY: the certificate names the
e-mail you sign in with or, in GitHub Actions, the repository, the workflow, the commit and
the run, and it goes
into a public log that does not forget, and into the bundle the record commits.

Here it opens the browser to sign in at oauth2.sigstore.dev. In GitHub Actions it uses
the job's own token (the workflow needs `permissions: id-token: write`), and it refuses
in a private repository, whose name the certificate would publish.

It refuses a tree that is not fully signed, as `stamp` does, and appends no event: the
bundle is a file beside the checkpoint, `witness/<checkpoint>.sigstore.json`.

The bundle dates the checkpoint, by Rekor’s time or a timestamp authority’s, and names who signed in. It speaks for
an identity of this record only once that identity names the same e-mail or workflow:
`mnema key sigstore <identity>`. It is not a witness level: `verify` reads it only with
`--against-sigstore`, as notes.
```
