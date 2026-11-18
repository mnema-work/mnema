Fixed

- **A folder or a file the disk will not open is named, not printed as the system's error.** A `tails/` folder, a tail's
  folder or a segment with no permission, and a file where `tails/` or a tail's folder belongs, used to end commands in the
  system's own message (`EACCES: permission denied, scandir ...`), inside a repository or outside one. The reads that
  serve the record (`status`, `show`, `search`, `brief`, `rules`, `why`, the bare command) now serve around the part and
  say it on the first line, as they say a line they cannot read; every write, `switch off` included, is refused naming where
  the part is and what to do, and so is a write of the agent's server. The refusal names no repair: `mnema tail repair` puts
  back a line and not a permission, and the private and the global tree have no history to put anything back from. A test
  runs the binary on each damage, outside and inside a repository, and is red on any name from the system's own table
  of errors.
  Not covered: the audit commands (`verify`, `export`, `backup status`) refuse in one block and do not serve around the
  part; the files a write opens to take a lock or to read the installation's id, and the doctor command's listing of
  `keys/`, still print the system's message when the disk refuses them.
