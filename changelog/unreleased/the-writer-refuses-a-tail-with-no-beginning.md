Fixed

- **A write is refused over a tail that begins above seq 0.** With the tail's first segment file gone and the anchor still counting,
  the next write appended over the rest and left `mnema verify` failing on a seq gap. The writer now refuses it as `TAIL_DAMAGED`
  ("begins at seq N and not at seq 0"), whatever the anchor says, and leaves the tail as it was. `mnema init` and the write ask the
  files one rule: a tail that only lost the last newline of a signed line is named by both (`init` named nothing before). Checkpoints
  taken out under a whole end are still named by the writer alone, because they need the signed note of the key's last write.
