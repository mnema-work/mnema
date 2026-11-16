Fixed

- **A tail that lost its start is refused for the damage first.** When the segment of a tail was emptied or deleted, or the first
  segment of a tail of several was removed, the first refused write said `STALE_ANCHOR` and advised deleting `keys/<fp>.anchor`,
  which is not the damage (after it the write said `TAIL_DAMAGED`, or passed over a tail with no start and left `verify` failing).
  A write whose recorded identity no longer counts its key now asks the tail first and says `TAIL_DAMAGED`: where the tail ends
  short of what its checkpoints signed, or where it begins above seq 0. `mnema init` says the same refusal, not the anchor's.
  A tail removed whole is still refused `STALE_ANCHOR` first.
