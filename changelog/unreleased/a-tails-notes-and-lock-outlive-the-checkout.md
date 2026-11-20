Fixed

- **`git clean -fdX` no longer makes the next write open a tail.** Inside a git repository, a writer's lock and its notes of what it
  wrote last (`<tail>.lock`, `.head`, `.head.sig` and `.cited`) now live under the repository's common git directory
  (`<git common dir>/mnema/<project>/public/locks/`), where a clean of what git ignores does not reach, and each worktree keeps its
  installation id as a hint under its own git directory (`<git dir>/mnema/<project>/public/keys/`). The write after a clean goes on
  with the same tail instead of opening one, and says nothing, as it never did. What a reader of the record sees is unchanged:
  no event, no field and no check differs, and the second reader needs nothing.
