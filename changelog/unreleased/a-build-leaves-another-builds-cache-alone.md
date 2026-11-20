Fixed

- **A build of mnema no longer rewrites the read cache another build wrote.** `locks/projection.db` is one file per tree and
  carries the stamp of the code that wrote it. A process whose code differs, such as another installed version or a
  checkout under development, used to replay the whole record and rewrite the file, and the long-lived server of the first
  build then replayed it back (158 MB read and 114 MB written per write in a measured session). It now builds its answers
  in memory for that process and leaves the file to the build that wrote it; a missing or damaged file is still built and
  kept. The cost moves to the build that does not own the file: a replay per process.
