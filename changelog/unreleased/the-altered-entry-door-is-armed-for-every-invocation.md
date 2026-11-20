Changed

- **The refusal of a write over an altered entry is armed for every invocation, not for a list of verbs.** The door
  stands at the writer, so an invocation that opens none is still never asked; one that opens a writer for an option
  (`mnema doctor --fix private-tree`) is asked without being named anywhere. `what-it-proves.md` now says the refusal
  asks the tree's cache, so an entry rewritten to the same size with its modification time put back is not seen by it
  until a cold read or `verify` says it.
