Fixed

- **A write the disk could not create a segment for says nothing was written.** The refusal said the part of the write that
  reached the tail "could not be cut back" when no file had been created, so nothing had reached it. `docs/what-it-proves.md`
  now says what a failed `fsync` leaves unproven: a checkpoint proves the bytes the writer saw, not that they reached the disk.
