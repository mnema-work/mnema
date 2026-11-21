Added

- **`mnema prove`: the proof of one decision, in one file a stranger checks offline.** `mnema prove <decision>`
  (an id or an `ADR-` label) writes one file holding the signed ranges of the record that hold the decision's
  writings and moves, the roster facts that make each signing key valid for its identity, the tail proofs, the
  public keys and a manifest of the decision's text, moves and state; `--out <file>` writes it to a file and never
  replaces one. `mnema prove --check <file>` checks it from the file alone, and so does the second reader
  (`python3 packages/chain/verifier/mnema_verify.py proof <file>`), which imports nothing of the product: one word
  changed in a line or in the manifest is refused by both. On each tail it carries every range from the first it
  needs to the last, and both readers refuse a gap, so nothing between two carried lines can be left out; the file
  grows with the distance between them (9 KB to 1.1 MB over this repository's record). A proof says what it does
  not prove beside every verdict: nothing written after the last range it carries on a tail (a later supersede or a
  revoked key), nothing on a tail it does not carry, no time but the writer's clock, and not who held a key. A decision of this machine's private tree is
  refused unless `--private` asks for it, and none is proven from a record `verify` calls broken. The format is
  `FORMAT.md` section 9, with `proof-vector.json` as its published vector. See
  [A proof of one decision](docs/a-proof-of-one-decision.md).
