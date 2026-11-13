Fixed

- **A rewrite of the record that keeps its size is no longer served from a warm cache.** An edit to a line before the last one of
  a tail's live segment, to the same size, used to leave the projection cache and a session's memory of the record where they
  were: the same unreadable line was refused by a cold read and accepted by a warm one, and a decision turned from accepted to
  rejected was reported as it had been. The cache now keeps, for the segment each tail is appending to, its size, its modification
  time and the sha256 of the bytes below what it read, and hashes only when the size or the time moved; a session replays whole
  when its last segment changed without growing, and the small index of the other projects of a workspace carries the same time.
  It does not see a rewrite that puts the modification time back on purpose, nor one inside the resolution of the filesystem's
  clock (a second on HFS+, two on FAT and exFAT): `verify` and a cold read are what read every byte.
