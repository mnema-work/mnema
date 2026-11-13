Added

- **`verify` names what a tail directory holds that is not of the format.** A `000001.jsonl.bak`, a folder or any other entry
  beside a tail's segments, `checkpoints.jsonl`, `tailproof.json` and `witness/` is named once in the census and never read, and
  the record is neither refused nor read differently for it; `.DS_Store` and `._*` are skipped and not named. The second reader
  says the same sentence, in the same order. A folder named like a segment (`000002.jsonl/`) and a file named `witness` no longer
  bring either reader down: they are named and left alone, and so is a `000001.jsonl` with a line feed after it, which the second
  reader used to read as a second segment. A symbolic link inside a tail directory is not said yet.
