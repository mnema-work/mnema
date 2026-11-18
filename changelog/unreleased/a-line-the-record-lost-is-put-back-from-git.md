Added

- **`mnema tail repair <tail>` puts back from git a line of a public tail that does not read or whose hash does not
  hold.** Until now a NUL in a committed line, or a line edited after it was written, stopped every write and left the way out to
  the person (restore the line from the history by hand). The verb takes, for each damaged line, the line at the same place in the
  same file in `HEAD` (or the revision `--from <rev>` names), and puts it back only when it reads, holds its hash, and chains to the line
  before it and, where one follows, to the line after it as the file will be left (the last line of a tail has none). It never adds, signs or deletes a line, leaves the last line when a
  crash cut it short, and touches neither `checkpoints.jsonl`, `keys/`, `tailproof.json` nor the private and the global trees; a
  conflict marker, a line that is the same bytes in the revision and does not read (a newer mnema wrote it), a revision whose line
  does not chain, and a link are each refused with nothing written. It takes the tail's lock, writes each file atomically and keeps
  the segment as it was in the repository's git directory, beside the lock, until the person deletes it. It is the one write that passes with an altered or an
  unreadable record, and it is a command of the shell only: the refusals of a write over a damaged public line (the command's, the
  edit gate's and the agent's) now name `mnema tail repair <tail>`, and keep "update mnema if a newer one wrote the line".
