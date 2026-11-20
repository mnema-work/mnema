Fixed

- **A build of mnema no longer rewrites the read cache another build wrote, unless it is a newer version.** `locks/projection.db`
  is one file per tree and carries the stamp of the code that wrote it, now with the mnema version. A process whose code
  differs, such as another installed version or a checkout under development, used to replay the whole record and rewrite
  the file, and the long-lived server of the first build then replayed it back (158 MB read and 114 MB written per write in
  a measured session). Now only a newer version takes the file over (once, after an update); the same version or an older
  one, and a file that is busy or locked, builds in memory for that process and leaves the file alone. A file with no stored
  version counts as the oldest, and a suffix such as `-beta` does not order versions. The process that does not take the file pays a replay on each command and each hook of the
  command line, and once per MCP server. Deleting `locks/projection.db` is always safe. A missing or damaged file is still
  built and kept.
