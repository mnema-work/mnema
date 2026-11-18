Fixed

- **A tail founded in a record of many tails no longer cites every other tail's head.** The first entry of a new tail used to
  name the head of every other tail, so it took about 20 KB among 300 tails and the whole record grew with the square of their
  number. A writer now cites the frontier: the heads that no other tail's head already covers, the head of every tail that holds
  the enrolment of a key, on a move or a retraction the head of every tail that holds its subject, and for the facts that add,
  remove or vouch for a key every head it has not cited directly (ADR-321, ADR-506). The same first entry takes about 660
  bytes at 101 tails and at 301, a record of 301 tails takes 14% of the bytes it took, `verify` is faster in both readers, and
  a write is within a few percent of what it was. No reader, kind or field changed: both readers verify a record written either
  way, and in a record that holds every tail the order and what a move had read are the ones citing every head gives. A clone
  missing a tail that covered another can place some informative entries by the clock; `FORMAT.md` says which and measures it.
  The writer keeps two notes more in `locks/` (what its citations cover, and what each tail cites), rebuilt from the tails when
  lost or when they do not agree with the bytes.
