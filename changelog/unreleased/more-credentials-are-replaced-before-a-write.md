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
  the new classes replace nothing. What a value under a credential's name is still read as, and so recorded as
  written, is stated there too: a passphrase of several words with no quotes, a slug of small letters without digits,
  a plain path or address (a webhook URL among them), a value of three digits or fewer, a key of several lines
  without its `BEGIN` line, a short word with a digit or two after a colon and followed by more words (`Hunter2`), and
  7 to 10 hex digits under a token's, a key's or a secret's name, read as an id. A name is not refused for the first
  word after a colon that only looks drawn at random (`Token: Base64Url encoding`); a body still has it replaced. The
  list is in
  [Recording decisions](docs/recording-decisions.md#what-goes-into-the-record).
