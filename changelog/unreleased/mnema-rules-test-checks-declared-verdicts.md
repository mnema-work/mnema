Added

- **`mnema rules test <file>` checks the verdicts a file declares for paths against the record's rules.** The file is
  JSON, `{ "cases": [ { "path": "src/billing/invoice.ts", "expect": "refuse" } ] }`, with a path relative to the project
  root and one of `refuse`, `ask`, `governs` or `none`. The answer is the gate's own (`refuse` and `ask` from the function
  the per-edit hook asks, `governs` from the reading `why` shares), so a rule that stops covering a path, or a
  channel switched off, shows as a `MISMATCH` naming what the path met and the rules behind it, with exit 1; a file with
  no case is refused. It writes nothing. See
  [Rules that are checked against paths](docs/rules-and-the-commits-that-cite-them.md#rules-that-are-checked-against-paths).
