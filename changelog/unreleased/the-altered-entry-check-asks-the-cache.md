Changed

- **The check that refuses a write over an altered entry asks the cache the tree keeps, as a warm read does.** An entry
  rewritten to the same size with its modification time put back is not seen by it (see the entry on arming every
  invocation).
