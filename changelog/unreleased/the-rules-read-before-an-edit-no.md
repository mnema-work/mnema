Fixed

- **The rules read before an edit no longer slows with the number of rules.** Naming what replaced each rule re-read
  every decision once per rule, so a project with 600 rules and 3,000 decisions waited several seconds on each edit, even
  for a path no rule names; it is now one indexed lookup per rule, with the same answers.
