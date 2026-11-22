Fixed

- **`mnema witness sigstore-check --message-dir` refuses, in one line, a folder below a file or below a link that points
  nowhere.** Both threw a raw error (`ENOTDIR`, `ENOENT`) from the check of where the messages go; nothing was written
  either way, and now the refusal names the path and says why.
