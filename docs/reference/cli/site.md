# mnema site

<!-- This page is generated from the help of the command line (packages/code/src/cli.help.golden.txt): edit it there and run `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

write the project's committed record as one HTML page that verifies itself in the browser (records nothing)

In the help under **Verify**.

## Options

| Option | What it does |
| --- | --- |
| `--out <dir>` | the directory index.html is written under (default: the record's own site/ folder, which its .gitignore keeps out of git) |
| `--back-link <url>` | put one link, labelled "Back", to this address (http(s)://, or a path on the same site) at the top of the page |
| `--head <file>` | a JSON file with a title, a description and a canonical address (and optionally structuredData) that the page says of itself to a search engine; without it the title is "The record" and there is no description or canonical |

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->
<!-- End of the part written by hand. -->

## The whole help

```text
Usage: mnema site [options]

write the project's committed record as one HTML page that verifies itself in
the browser (records nothing)

Options:
  --out <dir>        the directory index.html is written under (default: the
                     record's own site/ folder, which its .gitignore keeps out
                     of git)
  --back-link <url>  put one link, labelled "Back", to this address (http(s)://,
                     or a path on the same site) at the top of the page
  --head <file>      a JSON file with a title, a description and a canonical
                     address (and optionally structuredData) that the page says
                     of itself to a search engine; without it the title is "The
                     record" and there is no description or canonical
  -h, --help         display help for command

The page holds the committed (public) tree and nothing else: no private tree, no
machine-global tree, and all of that tree's text, so publish it only where the
repository itself may be read. It lists every decision as a card (its reasons, who
recorded it and who accepted it, a person or an agent, its history and the paths it
is addressed at) with the public notes that belong to it, and a timeline of the
record. With JavaScript, a filter opens on the decisions in force and narrows them
by state, identity, agent or person, day, text and path, and the page says how many
it shows; without it, every decision is listed. The stored events of a tail are
drawn when it is opened, from the files the page carries, and are not written into
the page twice. Those files are what the record is made of, and the browser runs the
same verifier as `mnema verify` over them, with no request and no key: the sentence
on the page is the one `mnema verify` gives a fresh clone. It checks the chain and
the checkpoint signatures. Once the record verifies, the page derives its lists again
from those files, with the same TypeScript the command writes them with, and names
each difference from what it shows, or says they match: the product run twice, not
a second reader. Everything is inside the one file: no script or style comes from
elsewhere.
Without --back-link the page has no link to a site; with it, the page opens with one
link back to a site that hosts it, and nothing else about the page changes. Likewise
--head: it replaces the title and adds the description, the canonical address and the
structured data the file names, and nothing else changes; a file that is not JSON, that
lacks one of the three, or whose canonical is not an absolute http(s) address is refused.

Without --out the page is written under the record, in .mnema/site/, and the record's
.gitignore is given the line /site/ first, so a `git add .mnema` leaves it out. A
directory named by --out that is inside the record and not under site/ is refused:
the record's folder holds only what is proof.

Examples:
  mnema site                       write .mnema/site/index.html
  mnema site --out dist/record     write dist/record/index.html
  mnema site --out dist/record --back-link /mnema/
  mnema site --out dist/record --head head.json
```
