Fixed

- **A write no longer goes through a symbolic link in the record.** A link where the writer writes (`tails/`, the tail's own
  directory, `keys/`, `locks/`, or a segment, `checkpoints.jsonl`, `tailproof.json`, the public key, or a lock or note in
  `locks/`) used to carry the bytes to wherever it pointed while the write read as done, and a `locks/` that was a link
  received the lock, the notes and the staging files. Now the write is refused by name (`RECORD_LINKED`, the path of the link
  in the sentence, `isError` on the MCP tool, exit 1), with nothing written and nothing the link points at opened; the
  hooks' own write says it in the reason. It does not found a new tail in the link's place: the link stays, and the refusal
  says to replace it with the folder or file it points to. `init`'s tree setup refuses a linked `.gitignore` or
  `.gitattributes` the same way. A write is refused when a link stands in a place it writes, and not for a link anywhere
  else in the record, which the reads already refuse.
