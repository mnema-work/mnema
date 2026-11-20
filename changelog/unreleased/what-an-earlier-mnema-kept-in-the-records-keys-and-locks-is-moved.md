Changed

- **What an earlier mnema kept in the record's own `keys/` and `locks/` is moved at the first write.** Once per key and checkout, the
  id and the notes of the key's tails go to the new places, under the earlier lock and then the new one, the id last: an interruption
  leaves a write that finishes the move, never a fork. Where the two places hold different notes of one tail, the tail is retired
  (no write goes on with it, and a new one is opened), and a note or an id an earlier mnema writes in the record again afterwards
  is left where it is. A checkout that an earlier mnema still writes holds one tail more, for as long as it writes, and `verify`
  accepts it as it accepts any tail. One window stays: after the move this mnema writes a tail only under the new lock and the earlier
  one only under its own, so an earlier mnema process that opened its writer before the upgrade and makes a second act in the same
  process, at the very moment this one writes the same tail, can start from the same end and fork it. Restarting the host after
  updating closes it.
- **A write inside a repository is refused where the notes cannot be kept, and the note naming each line is made certain first.**
  The note an append writes before its line is synced and read back; where that fails, the write is refused with
  `INTENT_NOT_KEPT` and nothing is written. A git directory that lies inside the working tree, and a place under `.git` that
  cannot be written, are refused by name with `MACHINERY_UNAVAILABLE`, and a worktree whose git directory is gone is not given
  one again. The refusal to write through a symbolic link follows the lock and the notes to their new place. Each write in a
  repository syncs the intent note and its directory, which one write in a repository did not do before.
- **A project reached through a link notes its tail where the file system says the project is**, so the folder and the link share
  one place and one lock.
