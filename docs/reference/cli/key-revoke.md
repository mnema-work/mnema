# mnema key revoke

<!-- This page is generated from the help of the command, written where the command is defined under packages/code/src/wiring/: edit it there, then run `pnpm vitest run packages/code/src/cli.golden.test.ts -u` (which rewrites packages/code/src/cli.help.golden.txt) and `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

retire a key from this identity, from this point forward

In the help under **This machine** · a command of [`mnema key`](key.md).

## Arguments

| Argument | What it does |
| --- | --- |
| `fingerprint` | the full fingerprint of the key to retire |

## Options

| Option | What it does |
| --- | --- |
| `--reason <text>` | why it is being retired (recorded in the fact) |
| `--checker` | retire a key that signs check results: from then on it signs nothing, and is never enrolled again |
| `--agent` | retire an agent key of this identity in every tree of this machine that enrolled it: from then on it signs nothing, and is never enrolled again |

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->
<!-- End of the part written by hand. -->

## The whole help

```text
Usage: mnema key revoke [options] <fingerprint>

retire a key from this identity, from this point forward

Arguments:
  fingerprint      the full fingerprint of the key to retire

Options:
  --reason <text>  why it is being retired (recorded in the fact)
  --checker        retire a key that signs check results: from then on it signs
                   nothing, and is never enrolled again
  --agent          retire an agent key of this identity in every tree of this
                   machine that enrolled it: from then on it signs nothing, and
                   is never enrolled again
  -h, --help       display help for command

What recording means here:
  Permanent: mnema is append-only and nothing deletes a fact. A public record
  is committed and reaches every machine that clones the repository.
  Do not record credentials: a recognized format is replaced with a placeholder
  and reported back, but what mnema does not recognize is written verbatim.
  Nor personal data: an email address is replaced with <email>; the mnid already says who wrote.
  Each text field holds at most 65536 bytes; a longer one is refused.
```
