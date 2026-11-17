Changed

- **Both readers refuse a symbolic link anywhere they read in a record, and read nothing behind it.** A link under `tails/`
  was the only one refused; a segment, `checkpoints.jsonl`, `tailproof.json` or an attestation under `witness/` replaced by
  a link, a key file under `keys/` that is one, and `keys/` or `tails/` themselves as links were followed by both readers,
  so a record could verify over bytes outside the repository. `mnema verify` and the second reader now list every link at
  those places before they read anything and refuse each by its path, first, in the same words: `LINKED TAIL:
  tails/<name>` for a tail that is a link, as before, and `LINKED ENTRY: <path>` for every other place, whatever the link
  points at, inside the record or out of it. A tail holding a link is not read at all and a key file that is one holds no
  key, so no byte behind a link reaches the verdict. On Windows the second reader reads a junction as a link too, as the
  product already did. The record's root and the folders above it are not judged, nor `locks/` or anything else no reader
  reads. No version of mnema writes a link into a record; a version from before this one follows such a link and refuses
  nothing, but a tail that is a link, which 0.1.8 already refused (FORMAT.md section 4). What the other commands read (`status`, the brief, the hooks) is unchanged.
