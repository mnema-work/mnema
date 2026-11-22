Fixed

- **More writes no longer go through a symbolic link.** A link at the public key another member's enrollment materializes
  (`keys/<fingerprint>.pub`), at a witness file (`tails/<tail>/witness/<checkpoint>.ots`, `.blocks` or `.sigstore.json`), at the checkout's migration mark (`migrated/<fingerprint>`) or at the key root's own
  `.gitignore` made the write land wherever the link pointed (a link to nothing was created at its target). Each is now refused
  by name, with `RECORD_LINKED`, before anything is written. The two logs of the data directory, the diagnostic log and the
  count of tool calls, do the same without ever failing the call: a log that is a link is skipped, and the words say so once
  (after an internal error, and on the MCP server's error stream), with nothing written and nothing the link points at opened.
  A stamp, a Sigstore signature and a return visit ask about the link before anything is sent, so a link at the file costs no
  publication to a calendar or to Rekor; and `record pull` writes nothing through a symbolic link that the pull brought to the
  path of a tail file it kept aside (git carries links), leaving the file in the folder it was kept in and saying so.
