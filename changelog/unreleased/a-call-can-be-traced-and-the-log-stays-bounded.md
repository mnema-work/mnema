Added

- **`MNEMA_TRACE=1` prints one line to stderr for each MCP tool call, and one for a command.** The line is `mnema-trace ` and a
  JSON object: the tool (or the verb), the milliseconds, the bytes the process read and wrote during the call (`rchar` and `wchar`
  from `/proc/self/io`, left out where there is none), and for each projection refreshed during it whether it was caught up from
  what arrived (`incremental`), found nothing new (`unchanged`) or was replayed whole, with the branch that sent it there and, where
  a fingerprint or mark did, its `path`, what the cache had recorded (`expected`) and what is there (`found`). It is off by
  default and puts no wrapper around a call when off. `docs/as-an-mcp-server.md` says how to read it.

Changed

- **The SQLite log of the projection cache stays bounded.** Every handle sets `journal_size_limit` to 4 MiB, a server cuts each cache's
  log back with a truncating checkpoint 3 seconds after a write once no call is in flight (never inside a read, and without waiting
  for a reader such as the command line), and closing a cache cuts it too. Over 1,000 writes the log stays under the limit.
- **SQLite's temporary files go beside the cache file** instead of `/var/tmp`, unless `$TMPDIR` or `$SQLITE_TMPDIR` is set, which keep winning.
