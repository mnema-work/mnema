Changed

- **The counts the guards keep per file restate themselves.** The ledgers of import clauses per file and of the commands
  each page hands over (three of them) fail, when a count moved, with the line to change and the number to write, and
  `pnpm vitest run <the guard's file> -u` rewrites those numbers in place. A file with no line and a line with no file
  still fail: a person lists those on purpose.
