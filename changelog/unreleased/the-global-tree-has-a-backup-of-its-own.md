Added

- **`backup` copies the machine's global tree, only when asked, and a new page says what a backup keeps and what it loses.**
  `backup setup --global <folder>` gives the global tree a folder of its own (the same confirmation, at a terminal only, and it
  works outside a project), `backup run --global` copies it and only it into `<folder>/global/`, and `backup status --global [--json]`
  says how far that copy is. A project's `run` never copies the global tree, and `--global` with no folder assigned to the global
  tree is refused: nothing is taken from a project's folder, since the global tree mixes the memory of every project. The same rules
  hold for it as for a project's trees. Its `diagnostics.jsonl` and `report-state.json` are not copied. See
  [What a backup keeps, and what it loses](docs/what-a-backup-keeps-and-what-it-loses.md): what the copy holds and never holds,
  that it is not encrypted, and that the machine's signing key is not in it.
