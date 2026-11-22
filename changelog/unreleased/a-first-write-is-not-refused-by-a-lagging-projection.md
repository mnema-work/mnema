Fixed

- **A write is no longer refused `STALE_ANCHOR` because the kept projection lagged the record.** Where a command holds
  no roster of its own, a refusal is now confirmed by reading the chain (the source `verify` reads) before it is given:
  the write is refused only if the chain also does not count the key. Seen as eight simultaneous first writes of one
  new key, one of which was refused while the record already counted its key. The check costs something only where a
  write was about to be refused.
