Changed

- **An act that died is finished only by the worktree that began it, and a held tail is trusted only while its note is unchanged.**
  Each worktree keeps a mark, per tail, of the act it last began (`<git dir>/mnema/<project>/public/inflight/`); the signed note an
  append writes before its line names an end that only the worktree whose mark names the entry may go on from. A writer that holds a
  tail across two acts also compares the note in the shared place, so a worktree that went on with the same tail in the meantime
  sends it to another tail instead of a fork. A mark that is lost sends the worktree to another tail, never further than before.
