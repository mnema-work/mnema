# mnema report

<!-- This page is generated from the help of the command, written where the command is defined under packages/code/src/wiring/: edit it there, then run `pnpm vitest run packages/code/src/cli.golden.test.ts -u` (which rewrites packages/code/src/cli.help.golden.txt) and `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

show, whole, what mnema would say about its own last internal error, and keep your answer to it (sends nothing)

In the help under **This machine**.

## Options

| Option | What it does |
| --- | --- |
| `--decline` | refuse reports of this kind of error: it is not offered again |
| `--off` | switch reporting off on this machine: nothing is logged or offered |
| `--on` | switch reporting back on |

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->
<!-- End of the part written by hand. -->

## The whole help

```text
Usage: mnema report [options]

show, whole, what mnema would say about its own last internal error, and keep
your answer to it (sends nothing)

Options:
  --decline   refuse reports of this kind of error: it is not offered again
  --off       switch reporting off on this machine: nothing is logged or offered
  --on        switch reporting back on
  -h, --help  display help for command

The report is built from a short list of facts (mnema’s version, Node’s, the platform, the name
of the verb, the kind of error, where in mnema it happened), and from nothing else: no record
content, no path, no name, no address, no message. It is refused whole if it would carry any.
mnema makes no network request and opens no browser: the text is shown and saved to a file and,
at a terminal, a link is printed that opens GitHub’s form with the report in it: nothing is
sent until you press Submit there.
What was logged, what you declined and the switch live in the global tree’s directory, beside
the record and not in it.
```
