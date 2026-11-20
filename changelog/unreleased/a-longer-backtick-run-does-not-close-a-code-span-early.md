Fixed
Contributor: jay23606

- **A longer run of backticks no longer closes a code span early** when mnema reads whether a `CLAUDE.md` imports `AGENTS.md`: a span closes only at a run of exactly the length of its opener, so a longer run neither ends it nor counts as part of a shorter one.
