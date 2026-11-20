Added

- **`mnema record publish --to <remote>/<branch>` pushes the record's branch and opens its pull request.** It makes what
  `record commit` makes, on top of the remote-tracking ref you name (the destination is never deduced from HEAD), pushes that
  branch alone without force, and opens the pull request on GitHub through `gh`. It is off until `mnema switch on
  record-publish`, a switch recorded for this machine only (`--scope public` is refused, and an `on` in the committed
  tree is not read), and it refuses, before it cuts anything: a repository that sets no `user.email` of its own or sets the
  global one; a record pull request already open into the destination, found by what it changes (every file under the
  record's folder) and not by its branch's name, said to have stalled once it is open past 24 hours; `gh` absent or a remote
  that is not GitHub's, with the manual steps. A remote whose push address and read address name different repositories is refused too. A cut whose author or committer is another e-mail is never pushed. It never
  merges and no hook runs it.
