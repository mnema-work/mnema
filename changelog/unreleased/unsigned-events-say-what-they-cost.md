Changed

- **The notice of events recorded and not yet signed says what they cost.** While such a window stands a catch-up cannot take only
  the new lines, so every session reads the whole record again (on a 503-event record, `mnema status` took 0.33 s without the
  window and 0.77 s with it, on a loaded machine); a window nobody signs makes that permanent. The line now says so, and says how it
  ends: the tail's owner writes once (and commits), or, in the public tree, `mnema tail repair <tail>` puts the tail back from the
  repository's history. What is proven, and what the gate decides, did not change.
