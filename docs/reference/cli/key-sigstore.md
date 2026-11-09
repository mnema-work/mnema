# mnema key sigstore

<!-- This page is generated from the help of the command line (packages/code/src/cli.help.golden.txt): edit it there and run `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

record that this identity is the one a Sigstore certificate names, so a bundle `mnema witness sigstore` files speaks for it in `mnema verify --against-sigstore`

In the help under **This machine** · a command of [`mnema key`](key.md).

## Arguments

| Argument | What it does |
| --- | --- |
| `identity` | the e-mail address you sign in to Sigstore with, or a GitHub Actions workflow as https://github.com/&lt;owner>/&lt;repo>/.github/workflows/&lt;file>@&lt;ref> |

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->
<!-- End of the part written by hand. -->

## The whole help

```text
Usage: mnema key sigstore [options] <identity>

record that this identity is the one a Sigstore certificate names, so a bundle
`mnema witness sigstore` files speaks for it in `mnema verify
--against-sigstore`

Arguments:
  identity    the e-mail address you sign in to Sigstore with, or a GitHub
              Actions workflow as
              https://github.com/<owner>/<repo>/.github/workflows/<file>@<ref>

Options:
  -h, --help  display help for command

The record keeps an e-mail address as its SHA-256 (`sha256:<hex>` of the address,
trimmed and in lower case), never the address: the record is append-only and cloned.
A workflow is kept as it is. The hash protects the record only: the bundle
`mnema witness sigstore` files, and the public log it goes to, name the address itself.
```
