Fixed

- **`git clean -fdX` no longer makes the next write open a tail.** Inside a git repository, a writer's lock and its notes of what it
  wrote last (`<tail>.lock`, `.head`, `.head.sig` and `.cited`) now live under the repository's common git directory
  (`<git common dir>/mnema/<project>/public/locks/`), where a clean of what git ignores does not reach, and each worktree keeps its
  installation id as a hint under its own git directory (`<git dir>/mnema/<project>/public/keys/`). The write after a clean goes on
  with the same tail instead of opening one, and says nothing, as it never did. What a reader of the record sees is unchanged:
  no event, no field and no check differs, and the second reader needs nothing.

Changed

- **What an earlier mnema kept in the record's own `keys/` and `locks/` is moved at the first write.** Once per key and checkout, the
  id and the notes of the key's tails go to the new places, under the earlier lock and then the new one, the id last: an interruption
  leaves a write that finishes the move, never a fork. Where the two places hold different notes of one tail, the tail is retired
  (no write goes on with it, and a new one is opened), and a note or an id an earlier mnema writes in the record again afterwards
  is left where it is. A checkout that an earlier mnema still writes opens a tail of its own in each alternation, which `verify`
  accepts as it accepts any tail.
- **A write inside a repository is refused where the notes cannot be kept, and the note naming each line is made certain first.**
  The note an append writes before its line is synced and read back; where that fails, the write is refused with
  `INTENT_NOT_KEPT` and nothing is written. A git directory that lies inside the working tree, and a place under `.git` that
  cannot be written, are refused by name with `MACHINERY_UNAVAILABLE`, and a worktree whose git directory is gone is not given
  one again. The refusal to write through a symbolic link follows the lock and the notes to their new place. Each write in a
  repository syncs the intent note and its directory, which one write in a repository did not do before.
- **A project reached through a link notes its tail where the file system says the project is**, so the folder and the link share
  one place and one lock.
