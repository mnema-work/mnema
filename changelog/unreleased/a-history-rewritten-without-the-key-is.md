Fixed

- **A history rewritten without the key is no longer signed by the key holder's next write.** A writer signed every event
  it found above its tail's last checkpoint, so anyone who could write the checkout, and not use the key, could rewrite a
  tail, recompute its keyless hashes, empty `checkpoints.jsonl` and fix the note of the last entry in `locks/`, and the
  holder's next write signed the forgery: both readers then passed `--require signed`. The writer now keeps beside that
  note the same note signed with the tail's key (`locks/<tail>.head.sig`), and signs the events it finds above the last
  checkpoint only under an end that note vouches for, after hashing each of them again from its bytes. An end it does not
  vouch for, with such events, gets a new tail and a notice that names how many stay unsigned; an end it vouches for whose
  checkpoints are fewer than the note says this key signed is refused (`TAIL_DAMAGED`) and left as it is. The format and
  both readers are unchanged. It holds while every mnema that writes with that key is this version or later: an older one
  still signs what it finds unsigned.
