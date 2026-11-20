Changed

- **`user-corrections` is on until it is switched off, and it also records a rule the person dictated.** It began off, on the premise
  that the one reader of a conversation's words had to be asked for; nobody asked, and in one day the person had to say four times that a
  rule go to the record. A project that never touched the switch now has the `Stop` hook record, as `proposed` decisions in this
  machine's private tree, the openings that correct the agent, the answers to its questions and, new, the messages that have the shape of
  a rule dictated (the table `mnema dictated` reads). Nothing leaves the private tree and no model is called. `mnema switch off
  user-corrections` stops it and the record of the switch is read first, so a tree that switched it off never has its transcript read.
  `mnema init` and `mnema` with no argument name only `edit-first-write-gate` as off. A rule the person dictates can now be recorded twice,
  once as the decision the agent records and accepts and once as a proposal of this reader; the two are not merged (ADR-546).
