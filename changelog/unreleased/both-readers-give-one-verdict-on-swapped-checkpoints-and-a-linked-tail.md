Fixed

- **Both readers give one verdict on two checkpoint lines swapped and on a tail that is a symbolic link.** `mnema verify`
  sorted a tail's checkpoints by `fromSeq` before it checked their chain, so two lines of `checkpoints.jsonl` swapped, each
  as it was signed, passed `--require=signed` while the second reader refused them. The previous checkpoint is now the
  line before, in both readers and in the writer (FORMAT.md section 6), and the swap is refused as a checkpoint chain
  break. A symbolic link under `tails/` was skipped by `mnema verify` (a record whose one tail was linked read as holding
  no tail, and one beside another tail verified over the other alone) and followed by the second reader. Both now refuse
  it by name, `LINKED TAIL: tails/<name>`, whatever it points at, and no reading follows it (FORMAT.md section 4). An
  earlier version still accepts the swapped lines and still skips the link.
