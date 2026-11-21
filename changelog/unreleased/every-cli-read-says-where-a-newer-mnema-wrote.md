Changed

- **Every command-line verb that reads the record says where a newer mnema wrote.** `recall`, `rules-file`, `timeline`, `refs`, `commits`,
  `aging`, `trailer`, `diagram`, `usage`, `site`, `export`, `audit accountability`, `audit exposure`, `audit antipatterns`, `task next`,
  `task guard` and `skill provenance` now print the sentence the other reads print (how many lines a newer mnema wrote, of which kinds,
  that this one applies none of them) on the error stream, never in `--json` or in the feed `export` writes. A guard enumerates the verbs
  the program declares as reads, runs each over a record holding such a line, inside and outside a git repository, and fails for a verb
  that neither says it nor is excused in its table with a reason. Nothing is said over a record no newer mnema wrote into.
