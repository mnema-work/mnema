Changed

- **A read in a linked worktree says where the record is.** A record git keeps out of its commits is not carried into a new
  worktree, and a read there said "Run `mnema init` first", which would have founded a second record. When the main
  checkout holds a `.mnema` folder, the refusal now says so and names it. `mnema show` and the `read_record` tool, for an id
  they cannot find in a worktree, add that a record written in the main checkout and not yet committed is not there. Only a
  hint: nothing is read from the main checkout's tree.
