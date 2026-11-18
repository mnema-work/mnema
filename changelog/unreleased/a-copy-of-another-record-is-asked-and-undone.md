Added

- **`mnema backup restore` asks about a copy of another record, and `--undo` puts back what it replaced.** A copy of another
  record (`--from <record>`, the copy of that record in the project's folder) was refused; it is now a question at a terminal
  (a pipe is refused, with the command for a person to run). On a yes the tree is moved to
  `<git directory>/mnema/before-restore-<UTC date>/`, with no colon in the name and never in the working tree, the copy is put
  in, and `mnema backup restore --undo` moves it back, keeping what stood there. No restore deletes that folder: it stays until the person deletes it,
  `--undo` puts back the newest, and `backup status` lists them. A project without git whose public tree lost its tails, so nothing names the record, takes
  the name from the copy's manifest and asks the same question (ADR-389, ADR-518, ADR-428).
