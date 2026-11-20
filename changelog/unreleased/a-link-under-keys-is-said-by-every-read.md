Fixed

- **A local anchor that is a symbolic link is now said by `status`, `search` and `brief`, and is not read.** `verify` has
  always refused a link at any entry of `keys/` (`LINKED ENTRY`), but with `keys/<fingerprint>.anchor` a link the three
  answered with no word that a part of the record was refused, and read the anchor through it: the identity `status` names
  came from wherever the link pointed. They name it on the first line as they name a linked segment
  (`a symbolic link (keys/<name>)`, with the way out), and the anchor reads as absent, as a dangling one does, so the
  identity is the one the record proves or the key derives. Only `*.anchor` files; what `verify` accepts, the format and
  how a write refuses are unchanged.
