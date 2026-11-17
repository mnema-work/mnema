Fixed

- **A write the disk fails now says whether the fact landed, and no longer reports a failure for one that did.** A full disk
  (`ENOSPC`) or an I/O error (`EIO`) used to end a write with the bare errno and exit 1 whichever file call had failed, though
  three of the four calls that can fail leave the fact on the tail: the append of its checkpoint, and the sync of the segment or of
  the checkpoint file. A caller that retried wrote the fact twice. Now, where the line was not written, the write is refused
  by name (`WRITE_NOT_LANDED`, the errno in the sentence, `isError` on the MCP tool, exit 1) and trying again is safe; where the
  line is on the tail and its checkpoint is not, the write succeeds (exit 0, no `isError`) with one line, `recorded, not yet
  signed: the next write signs it`, and the disk's error, which the next write then signs; where the checkpoint is in the file
  and only its sync failed, the line says the disk did not confirm the signature. The command line prints the line on standard
  error and the server puts it in the reply. A sync that fails after the line was written is decided by reading the end of the
  file, not by the error. It does not retry a failing disk, and a power cut or a disk that fails after reporting success is
  still for `verify` to find.
