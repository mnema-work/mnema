# mnema tour

<!-- This page is generated from the help of the command, written where the command is defined under packages/code/src/wiring/: edit it there, then run `pnpm vitest run packages/code/src/cli.golden.test.ts -u` (which rewrites packages/code/src/cli.help.golden.txt) and `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

show what mnema is and how it is used, page by page

In the help under **This machine**.

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->

## The tour of the first run

`mnema tour` shows four pages, one after another: what the record is, what `mnema init` chooses and why, how an
agent reads the record, and the commands to start with. At a terminal one page is drawn at a time (Enter or the
right arrow goes on, the left arrow goes back, Esc leaves); in a pipe or a script the same pages are printed in
order as text, and nothing is written.

The first time `mnema` is run with no arguments at a terminal on a machine, it opens these pages in place of the
menu, once. The next bare `mnema` asks what you would like to do, as it always did, and `mnema tour` opens the pages
again whenever you want them. The tour only explains: it writes nothing to the record, founds no project and
asks no question. The one thing it leaves is a field in `machine-state.json`, in the folder of this machine's
global tree beside the file that remembers the star line; the field is set when the tour opens, so leaving with
Ctrl-C does not bring it back. A file that cannot be read counts as seen and is never written over; deleting it
shows the tour once more. A session of `mnema repl` does not run it: the tour draws a screen of its own.
<!-- End of the part written by hand. -->

## The whole help

```text
Usage: mnema tour [options]

show what mnema is and how it is used, page by page

Options:
  -h, --help  display help for command

Four pages: what the record is, what `mnema init` chooses and why, how an agent reads it, and the
commands to start with. At a terminal one page is drawn at a time (Enter or → for the next, ← for
the one before, Esc to leave); without one the pages are printed in order. It writes nothing to
the record and founds no project; at a terminal it notes in a file of this machine, outside the
record, that the tour was shown. The first time `mnema` is run on a machine at a terminal, with no
arguments, this is what it opens, in place of the menu; after that the menu is back.
```
