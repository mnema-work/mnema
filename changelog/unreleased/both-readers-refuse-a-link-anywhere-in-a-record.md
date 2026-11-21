Changed

- **Both readers refuse a symbolic link anywhere they read in a record, and read nothing behind it.** A link under `tails/`
  was the only one refused; a segment, `checkpoints.jsonl`, `tailproof.json` or an attestation under `witness/` replaced by
  a link, a key file under `keys/` that is one, and `keys/` or `tails/` themselves as links were followed by both readers,
  so a record could verify over bytes outside the repository. `mnema verify` and the second reader now list every link at
  those places before they read anything and refuse each by its path, first, in the same words: `LINKED TAIL:
  tails/<name>` for a tail that is a link, as before, and `LINKED ENTRY: <path>` for every other place, whatever the link
  points at, inside the record or out of it. A tail holding a link is not read at all and a key file that is one holds no
  key, so no byte behind a link reaches the verdict, and `mnema verify` no longer replays the record to name an agent
  when it holds a link (a segment linked to a pipe hung the command there). A record that holds no tail it could read
  says why: a link, not "there are no tails". On Windows a junction and an app execution alias are links too, in both
  readers, and any other reparse point, a OneDrive placeholder among them, is read as the file or folder it holds; a
  WSL link counts as a link to the product from Node 24.16 (libuv 1.52), not on the floor, 24.15, nor to the second reader. The record's root and the folders above it are not judged, nor `locks/` or anything else no reader
  reads. No version of mnema writes a link into a record; a version from before this one follows such a link and refuses
  nothing, but a tail that is a link, which 0.1.8 already refused (FORMAT.md section 4). The reads under `status`, the brief and the hooks are the next entry's.
