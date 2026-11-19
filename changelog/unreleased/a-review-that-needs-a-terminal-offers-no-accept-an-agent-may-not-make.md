Fixed

- **A `mnema decision review` run with no terminal offers an accept only where an agent may make one.** With `agent-accepts`
  switched off it already left only the reject line; with the switch unreadable it still offered the accept line,
  which an agent is then refused. It now leaves only the reject line and says the switch could not be read. The pages that
  describe the VS Code extension (`docs/packages.md`, `docs/features.md`) now say that with `agent-accepts` off its Accept
  button is refused and a person accepts with `mnema decision review` in a terminal, as the extension's own README already did.
- **A write the disk could not create a segment for says nothing was written.** The refusal said the part of the write that
  reached the tail "could not be cut back" when no file had been created, so nothing had reached it. `docs/what-it-proves.md`
  now says what a failed `fsync` leaves unproven: a checkpoint proves the bytes the writer saw, not that they reached the disk.
