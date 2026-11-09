# mnema promote

<!-- This page is generated from the help of the command line (packages/code/src/cli.help.golden.txt): edit it there and run `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

list what recurs across projects, or copy one pattern to the global tree

In the help under **Record**.

## Arguments

| Argument | What it does |
| --- | --- |
| `id` | the pattern or decision in this project to copy to the global tree |

## Options

| Option | What it does |
| --- | --- |
| `--workspace <path...>` | list the patterns and decisions in force, with the same words, in the committed record of the projects at these paths (writes nothing) |
| `--evidence <path:id>` | with &lt;id>: another project and the id of the same pattern there (repeatable) |

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->
<!-- End of the part written by hand. -->

## The whole help

```text
Usage: mnema promote [options] [id]

list what recurs across projects, or copy one pattern to the global tree

Arguments:
  id                     the pattern or decision in this project to copy to the
                         global tree

Options:
  --workspace <path...>  list the patterns and decisions in force, with the same
                         words, in the committed record of the projects at these
                         paths (writes nothing)
  --evidence <path:id>   with <id>: another project and the id of the same
                         pattern there (repeatable)
  -h, --help             display help for command

Two acts:
  mnema promote --workspace <path...>
      lists what is in force, with the same words, in the committed record of two or
      more of the projects you name. It writes nothing. The set is what you name and is
      never searched for; a pattern or decision counts only if it is in force (adopted,
      accepted) and only through the committed tree: a project’s private tree is
      neither counted nor cited, because the copy goes where every project reads.
  mnema promote <id> --evidence <path>:<id>
      copies <id>, which is in the project you stand in, to this machine’s global tree;
      repeat --evidence for each other project.
      It is born proposed, carries no address, and cites each id given (and <id>) as
      derived-from. It refuses, and appends nothing, anything the listing would not show.
      Nothing is moved: the originals stay where they are. Adopt the copy with the verb
      that moves a skill or a decision.
"Same words" is compared after NFC, trimming and collapsing whitespace, and not after
that: a skill is its name and body, a decision its title and rationale.

What recording means here:
  Permanent: mnema is append-only and nothing deletes a fact. A public record
  is committed and reaches every machine that clones the repository.
  Do not record credentials: a recognized format is replaced with a placeholder
  and reported back, but what mnema does not recognize is written verbatim.
  Nor personal data: an email address is replaced with <email>; the mnid already says who wrote.
  Each text field holds at most 65536 bytes; a longer one is refused.
```
