Fixed

- **A symbolic link under `keys/` is now said by `status`, `search` and `brief`.** `verify` has always refused a link at any
  entry of the key folder (`LINKED ENTRY`), and the local `<fingerprint>.anchor` is one no read opens, so with it a link the
  three answered with no word that a part of the record was refused. They name it on the first line as they name a linked
  segment (`a symbolic link (keys/<name>)`, with the way out), and exit as the read did. What `verify` accepts, and the
  format, are unchanged.
