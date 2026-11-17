Fixed

- **A checkout that goes back and forth between two branches no longer opens a tail at every visit, and a worktree no longer opens one
  for nothing.** When the tail a worktree's hint names does not end where this machine left it, the write now goes on with another tail
  of the same key that does, before it opens one: a tail this worktree wrote itself, or whose end is already on the base branch (the
  remote's default branch as the clone last read it), and that no other worktree names as its hint. Six visits alternating between two
  branches leave two tails, not six; a worktree made after the others were merged and removed goes on with a tail they left. A tail
  whose end only some branch holds is never taken by another worktree, so two branches never write one tail file past the point they
  share and a squash merge on a host with no merge driver conflicts on none. Where a repository has no remote, or no default branch
  known to it, a worktree goes on only with the tails it wrote itself. No event, field, check or vector differs, and the second reader
  needs nothing.
- **A write that opens a tail where the key already writes others says why.** `mnema: wrote to a new tail, ...` now says whether this
  repository holds no note of this machine writing any of them (a new clone, or the key on another machine), none ends here where this
  machine left it or is on the base branch, the ones that do are the hint of another worktree, or they were being written by another
  process. The first tail of a key in a record stays silent, as does a write that goes on with a tail.

Changed

- **An act that died is finished only by the worktree that began it, and a held tail is trusted only while its note is unchanged.**
  Each worktree keeps a mark, per tail, of the act it last began (`<git dir>/mnema/<project>/public/inflight/`); the signed note an
  append writes before its line names an end that only the worktree whose mark names the entry may go on from. A writer that holds a
  tail across two acts also compares the note in the shared place, so a worktree that went on with the same tail in the meantime
  sends it to another tail instead of a fork. A mark that is lost sends the worktree to another tail, never further than before.
