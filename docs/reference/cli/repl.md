# mnema repl

<!-- This page is generated from the help of the command, written where the command is defined under packages/code/src/wiring/: edit it there, then run `pnpm vitest run packages/code/src/cli.golden.test.ts -u` (which rewrites packages/code/src/cli.help.golden.txt) and `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

open an interactive session that reads this project

In the help under **Read**.

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->
<!-- End of the part written by hand. -->

## The whole help

```text
Usage: mnema repl [options]

open an interactive session that reads this project

Options:
  -h, --help  display help for command

One process, many reads. A command of this CLI spends about a tenth of a second
starting before it reads anything; a session pays that once, and every read after
the first costs only the work.

It reads and never writes. A verb that can change the record is refused by name,
with the line to run outside the session, and it is refused because the verb
itself declares what it can do, so one added tomorrow is refused too.

  /clear   start the page over (what was on it stays in the scrollback)

Ctrl-D ends the session; Ctrl-C clears the line you are typing.

It needs a terminal at both ends and refuses without one: reading commands from a
pipe would be a second way to run the same verbs. The history lives in this
process and is written to no file. Style is decided when the session opens (from
`mnema --color`, the environment and the terminal), so a `--color` typed on a line
inside it changes nothing.
```
