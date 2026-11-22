Changed

- **`mnema backup verify` now fails for a copy whose manifest does not read.** A `mnema-backup.json` that is there and is
  not JSON, is not an object with a list of files, or lists an entry with no path and size used to be passed over without a
  word, and the copy could verify; the command now names the file, says the copy is not sound and exits non-zero (and
  `--json` carries the new `manifest` field, `whole`, `absent` or `unreadable`, in each tree's reading). A copy with no
  manifest at all still passes, and now says so. `mnema backup restore` refuses such a copy too, with nothing written back, and `mnema backup status` says that the manifest
  does not read instead of passing over it. A manifest the disk refuses (EACCES, a folder in its place) counts as unreadable. See [the backup reference](docs/reference/cli/backup.md).
