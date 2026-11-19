Fixed

- **A folder or a file the disk will not open is named, not printed as the system's error.** A `tails/` folder, a tail's
  folder or a segment with no permission, and a file where `tails/` or a tail's folder belongs, used to end commands in the
  system's own message (`EACCES: permission denied, scandir ...`), inside a repository or outside one. The reads that
  serve the record (`status`, `show`, `search`, `brief`, `rules`, `why`, the bare command) now serve around the part and
  say it on the first line, as they say a line they cannot read; every write, `switch off` included, is refused naming where
  the part is and what to do, and so is a write of the agent's server. The refusal names no repair: the verb that puts a line back from git puts
  back no permission, and the private and the global tree have no history to put anything back from. A test
  runs the binary on each damage, outside and inside a repository, and is red on any name from the system's own table
  of errors.
  The same holds for the folders a write meets on its way: a `locks/` or a `keys/` folder with no permission, a file
  where `locks/` belongs, and an installation id the disk will not open or create are named by their place (`locks`,
  `keys/<name>.inst`) in every tree and in the key folder, and so is the doctor command's listing of `keys/`. A restore
  of another record over a tree whose `tails/` folder the disk will not open is refused naming the part, instead of
  reading the tree as holding no tail and putting the copy over it. The agent's server refuses a write over such a part
  with its own code, `UNREADABLE_PART`, and in words for an act that names no path.
  Not covered: the audit commands (`verify`, `export`, `backup status`) refuse in one block and do not serve around the
  part.
