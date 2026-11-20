Fixed

- **`mnema key restore` no longer writes the anchor through a symbolic link.** A link at `keys/<fingerprint>.anchor` (or at `keys/`)
  made the restore write the anchor into whatever the link points at, outside the record. It now refuses with the same words a write
  uses (`RECORD_LINKED`) before it writes anything, and leaves the link and the key root as they were.
