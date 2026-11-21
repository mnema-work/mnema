Fixed
Contributor: bfs2021

- **A `CLAUDE.md` with many unclosed HTML comments no longer slows `init`, `instructions` and `doctor`.** Whether the file imports `AGENTS.md` is read in one pass: each comment marker is looked up once, so 20,000 lines of unclosed comments take milliseconds instead of more than a second.
