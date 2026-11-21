Fixed

- **Relinking tails no longer writes over an altered entry.** In a directory holding tails of two records, which is
  where the verb is used, the check that refuses a write while an entry is altered saw nothing, because every reading of
  such a directory reads no tail; the relink was signed over the altered record. The check now asks the chain's own
  verification there. A test enumerates every verb, hook and agent tool declared as writing and runs each over an
  altered entry and over a line that cannot be read.
