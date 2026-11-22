Fixed

- **A link that appears while a Sigstore sign-in is open, or in a folder on the way to a file `record pull` puts back, is not followed.** `mnema witness sigstore` looks again at where each bundle is filed right before the checkpoint goes to Rekor, so a link that came during the sign-in stops that checkpoint instead of leaving an entry in the public log whose bundle could not be filed. `mnema record pull` checks every folder from the repository's top to the file it writes back, not only the file, and keeps aside what it will not write through, as it already did for a link at the file.

Changed

- **The backup is declared member by member.** `backup setup`, `run`, `restore` and `hook` write outside the record, so the session (`mnema repl`) no longer offers them as reads; `backup status` and `backup verify` are still run there.
- **`mnema doctor` says when an entry of the record was altered after it was written.** Until now it exited 0 and said nothing of the line while every write was refused. The finding names the entry, the tree and the way out, and it replays the tails in memory: doctor still writes nothing.
