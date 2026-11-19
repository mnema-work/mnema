Added

- **`mnema tail repair <tail>` puts back a whole public tail from git when every line holds and its signed checkpoints do not.**
  A tail rewritten with every later link computed again, its `checkpoints.jsonl` emptied or forged, or a signed event removed,
  refused every write with no verb to mend it: the refusal said to put the tail back from the history by hand. The verb now
  takes the tail from `HEAD` (or `--from <rev>`) when that revision proves itself (its events chain from seq 0 and every
  checkpoint signature holds under the committed key, the tail's proof verifying too), what its checkpoints sign whole, the events
  committed past its last checkpoint staying as the one write's window they were unless a signed branch forks from them (signed
  work wins: they are removed, and the revision's segment is kept aside too), and keeps above it only the events a working checkpoint that holds, or
  this machine's signed note, proves; the rest is removed and said by seq, and an honest event whose link somebody computed
  again gets its link computed again as it was signed. It refuses a revision that does not hold, a revision behind what this
  machine signed, and a conflict marker in `checkpoints.jsonl`, each with nothing written. Every file it changes,
  `checkpoints.jsonl` included, is kept first beside the tail's lock, the segments are put in place before the checkpoints, and
  it still signs nothing and touches neither `keys/` nor `tailproof.json`. The refusal of a write over a public tail whose
  checkpoints do not hold now names `mnema tail repair <tail>`.
