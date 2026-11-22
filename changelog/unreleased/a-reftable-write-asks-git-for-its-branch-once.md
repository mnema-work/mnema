Fixed

- **In a repository kept in the `reftable` format, a write no longer asks git for the branch at every append.** The `HEAD` file of such a
  repository names no branch, so git was asked (`git symbolic-ref`) for each line a write appended. The answer is now kept for the state
  of the worktree's `reftable/tables.list` and asked again as soon as that list changes, as it does when a branch is switched; a git that
  does not answer is not kept. No event, field, check or vector differs, and the second reader needs nothing.
