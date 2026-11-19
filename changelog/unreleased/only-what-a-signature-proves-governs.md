Changed

- **Every read checks the signed checkpoints, and only what a signature proves governs** (ADR-557 to ADR-562). A read
  folds each tail's `checkpoints.jsonl` over its events: the root and the link of every line, and the signature of the
  last line of each tail, which binds every earlier one (every signature when anything fails, to name the first). The
  events a holding checkpoint covers are proven, and so are the events this machine's signed note in `locks/` vouches
  for (a write whose checkpoint did not land, the act in progress). The projection holds proven events only, so the
  edit gate, the switches, the roster and every read that opens the record decide on them alone, and so does the gate
  of a move: an event no signature proves neither refuses an accept nor lets a supersede name its successor.
  - A run a checkpoint does not hold over (a rewrite re-chained under its checkpoints, a root or a signature replaced,
    a checkpoint signed by a key the record does not hold), a signed event that is gone, checkpoints this machine
    signed that are no longer in the file, and unsigned events beyond one write's window (more than 64, not at the
    tail's end, or a tail with events and no checkpoint that verifies) are left out of every answer and said first,
    `issue [T2/T4] ...; these entries were not served`; the gate denies and every write is refused while one stands,
    with the way out (in the public tree, put the tail back as the repository last committed it; for a tail with no
    checkpoint, one more write on the machine that wrote it signs one, then commit it).
  - One write's window at the end of a tail (at most 64 events above the last checkpoint) is served and said last,
    `recorded and not yet signed`, and governs nothing until a checkpoint covers it; nothing denies over it.
  - A catch-up takes only what new checkpoint lines prove, each signature checked; anything else replays the record.
  - What a read does not ask, and `verify` does, is in [What it proves](docs/what-it-proves.md).
