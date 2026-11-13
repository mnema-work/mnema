Changed

- **The suite runs in three shards per Node.** CI used to run the whole suite in one job per Node, 11 to 14 minutes of which
  the pull request waited. Each Node now runs it as three shards at the same time (`test (node 24.15.0, shard 1/3)` and the
  other eight), lint and the type-check run once in `lint + typecheck` instead of once per Node, and the coverage of the three
  shards on Node 24 is merged in `the coverage gate`, which checks the same thresholds against the figures of the whole
  suite. A guard fails if the matrix and the steps disagree on the number of shards, or if the merge does not wait for them
  and count their blobs.
