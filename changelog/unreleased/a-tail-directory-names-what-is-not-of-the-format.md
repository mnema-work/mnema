Added

- **`verify` names what a tail directory holds that is not of the format.** A `000001.jsonl.bak`, a folder or any other entry
  beside a tail's segments, `checkpoints.jsonl`, `tailproof.json` and `witness/` is named once in the census and never read, and
  the record is neither refused nor read differently for it; `.DS_Store` and `._*` are skipped and not named. The second reader
  says the same sentence. A symbolic link inside a tail directory is not said yet.
