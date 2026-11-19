Changed

- **More credentials are replaced before a write.** The door every text field passes recognizes GitHub's fine-grained
  tokens (`github_pat_`), GitLab's tokens (`glpat-` and the other prefixes GitLab lists), Hugging Face tokens (`hf_`)
  and Stripe's webhook signing secrets (`whsec_`), and two places whatever the value looks like: the value of an
  `Authorization` header (`<SECRET:authorization-header>`) and the value written after a credential's name, such as
  `PASSWORD=`, `"api_key":`, `X-Api-Key:` on its own line, `--password` or `curl -u user:` (`<SECRET:named-credential>`).
  The whole value goes, to its closing quote or the blank after it, so no piece of a password is left beside the
  placeholder. A name is read only where text writes a key down, so a sentence that says the word, a count
  (`max_tokens`), a cursor (`next_token`), a variable, a placeholder, a path and a line of code are recorded as written.
  The reply that says what was replaced names the new classes, and `mnema audit exposure` finds them in what was
  recorded before. A title that reads as holding a credential is refused, as a name that holds a key already was, and
  the refusal names the way out: another name, or rotating the value if it was real. Over this repository's own record
  the new classes replace nothing. The list is in
  [Recording decisions](docs/recording-decisions.md#what-goes-into-the-record).
