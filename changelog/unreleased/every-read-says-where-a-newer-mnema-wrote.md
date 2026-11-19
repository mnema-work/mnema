Changed

- **`search`, `resume`, `rules`, `why`, the console and the agent's reads say where a newer mnema wrote.** Lines of a
  kind this mnema does not know are read past and left out of what is served, and only `status`, `brief`, `show`,
  `read_record`, `bootstrap` and `doctor` said so. Now `mnema search`, `resume`, `rules` and `why` print the same
  sentence on the error stream (never in `--json`), the console's opening panel prints it under the tree that holds the
  lines, and every read of the agent (`search`, `resume`, `focus`, `governing_rules` and the audit tools) carries it as a
  block before its payload. The reason a gate gives for refusing a write, or for holding it for a person, carries it
  too; a write that goes through is told nothing. Nothing is said, and no output changes, over a record no newer mnema
  wrote into.
