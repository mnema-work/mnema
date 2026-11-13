Changed

- **`mnema instructions` writes no block into a `CLAUDE.md` that imports `AGENTS.md`.** A `CLAUDE.md` with the line
  `@AGENTS.md` (or `@./AGENTS.md`), or a `.claude/CLAUDE.md` with `@../AGENTS.md` (an import is resolved from the folder of
  the file that holds it), outside a code fence and an HTML comment, is left as it is while `AGENTS.md` is written, since
  Claude Code reads the imported file there: it is not counted as left out, and `init`, `mnema instructions`, `--check`
  and `mnema doctor` say in one line why. A block already in it is said to be read twice and taken out by
  `mnema instructions` only on a yes at a terminal (on a no, an earlier version's block is brought up to date). `.claude/rules/mnema-instructions.md` keeps its file.
