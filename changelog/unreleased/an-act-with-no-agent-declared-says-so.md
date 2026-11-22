Changed

- **An act with no agent on it is read as "no agent declared", not as "a person".** The command line writes no `which`
  whenever none was named, and a person at a terminal, a script and a hook leave the same envelope, so `show`, `brief`,
  `status`, the console, the record page, the provenance of a pattern and the refusal of a second accept now say
  `no agent declared`. No signed byte changes: records written before read the same way from this release.
