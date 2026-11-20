Fixed

- **More writes no longer go through a symbolic link.** A link at the public key another member's enrollment materializes
  (`keys/<fingerprint>.pub`), at a witness file (`tails/<tail>/witness/<checkpoint>.ots`, `.blocks` or `.sigstore.json`), at the checkout's migration mark (`migrated/<fingerprint>`) or at the key root's own
  `.gitignore` made the write land wherever the link pointed (a link to nothing was created at its target). Each is now refused
  by name, with `RECORD_LINKED`, before anything is written. The two logs of the data directory, the diagnostic log and the
  count of tool calls, do the same without ever failing the call: a log that is a link is skipped, and the words say so once
  (after an internal error, and on the MCP server's error stream), with nothing written and nothing the link points at opened.
