Fixed

- **A tail that lost its founding line is refused for the damage first.** When a segment of the tail was emptied or deleted, the
  first refused write said `STALE_ANCHOR` and advised deleting `keys/<fp>.anchor`, which is not the damage: the write after it
  said `TAIL_DAMAGED`. A write whose recorded identity no longer counts its key now asks the tail first, and says `TAIL_DAMAGED`
  where the tail ends short of what its checkpoints signed; the anchor's own refusal stays where the tail has no damage to name
  (a tail removed whole, or a tail of several segments that lost its first one).
