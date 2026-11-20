Fixed

- **Recording the anchor no longer writes through a symbolic link.** A link at `keys/<fingerprint>.anchor` made a key restore write
  the anchor into whatever the link points at, outside the record; and a link to nothing there was read as no anchor, so a founding
  wrote through it too. Both now refuse, with the words a write of the record uses (`RECORD_LINKED`), before anything is written; a
  restore says nothing was restored.
