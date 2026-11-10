Fixed

- **A torn last line of `checkpoints.jsonl` is healed by the next write, not buried.** A crash while signing a checkpoint leaves a
  piece with no newline. Reading tolerated it, but the next write appended its checkpoint glued to the piece, and the tail
  became unreadable to `mnema verify` and to the Python reader for good. The writer now cuts a piece that does not parse, or
  completes one that lost only its newline, the way it already healed a segment's. `verify` names a dropped piece of the
  checkpoints file in its census, as the Python reader already did.
