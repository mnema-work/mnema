Fixed

- **A checkout that goes back and forth between two branches no longer opens a tail at every visit, and a worktree no longer opens one
  for nothing.** When the tail a worktree's hint names does not end where this machine left it, the write now goes on with another tail
  of the same key that does, before it opens one: a tail this worktree wrote itself on the branch it is on now, or whose end is already
  on the base branch (the remote's default branch as the clone last read it), and that no other worktree names as its hint. Six visits alternating between two
  branches leave two tails, not six; a worktree made after the others were merged and removed goes on with a tail they left. A tail
  whose end only some branch holds is never gone on with by another branch (another worktree's, a branch cut from the one that wrote
  it, or a detached HEAD, the tail the hint names included): a branch cut from another that the host has not merged founds a tail, so
  two branches never write one tail file past the point they share and a squash merge of one and a merge of the other on a host with
  no merge driver conflict on none. A tail no mark of the worktree speaks of (written before marks were kept) is asked of the base
  branch once, and the first write after it is marked; as the end of such a tail is usually not pushed, the first write after an upgrade usually founds a tail. In a repository kept in the `reftable` format, whose `HEAD` file names no
  branch, the branch is asked of git. The questions put to the base branch take ten seconds in all; a git that does not answer in that
  time counts as no, the write opens a tail, and the sentence says the base branch did not answer. Where a repository has no remote, or no default branch
  known to it, a worktree goes on only with the tails it wrote itself. No event, field, check or vector differs, and the second reader
  needs nothing.
- **A write that opens a tail where the key already writes others says why.** `mnema: wrote to a new tail, ...` now says whether this
  repository holds no note of this machine writing any of them (a new clone, or the key on another machine), none ends here where this
  machine left it or is on the base branch, the ones that do are the hint of another worktree, or they were being written by another
  process. The first tail of a key in a record stays silent, as does a write that goes on with a tail.
