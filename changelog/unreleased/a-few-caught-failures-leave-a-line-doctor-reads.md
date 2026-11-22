Added

- **A few failures mnema catches and goes on from now leave one line that `mnema doctor` reads.** The MCP server's count of tool
  calls (and the write of that count) and the outer catch of four hooks (session start, session recall, after a write, choice
  settled) add a line to `<data directory>/log/swallowed.jsonl`: the instant, the place's name (from a fixed list), the error's class,
  `code` and `syscall`, and the version. No message, no stack, no argument, no path and no word of yours. The file has a ceiling (128 KiB,
  then it is renamed over `swallowed.1.jsonl` under a lock, two files at most), is mode `0600`, is made nowhere a machine has no key of
  its own yet, never leaves the machine and is not copied by a backup. `mnema doctor` reads at most its last 256 KiB, says how many
  failures the last 7 days hold and the places that did it most, prints nothing it did not write, and says nothing where there are none.
  The other catch blocks do not write to it yet. See [The ledger of caught failures](docs/the-ledger-of-caught-failures.md).
