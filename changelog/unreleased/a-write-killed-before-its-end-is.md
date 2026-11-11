Fixed

- **A write killed before its end is signed by the next write, in the same tail.** The notes of the last entry an
  installation wrote (`locks/<tail>.head` and the signed `locks/<tail>.head.sig`) were kept only once the act ended, so a
  kill after the event's line reached the disk left an event no note vouched for: the next write opened a new tail, said
  a branch switch or a merge did it, and `mnema verify --require=signed` failed on that record for good. The signed note
  is now kept before each line as well, naming in a new field, `next`, the last entry the write is about to append, and
  the next write signs what a killed one left, whatever point the kill came at. And an end the signed note names that the
  tail no longer holds (its newest entries and their checkpoints cut, the clear note set back) is not written over: the
  write goes to a new tail and says which entries are not there. The format of the record and both readers are
  unchanged; the field is in a note under `locks/`, which no reader reads.
