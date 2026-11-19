Fixed

- **A detached OpenTimestamps proof with bytes after its end is refused by both readers.** The Python reader refused a `.ots`
  with trailing bytes ("N trailing bytes after the proof"), and the TypeScript reader read the proof and ignored the rest, so
  the same file was a refusal in one and a verified witness in the other. The TypeScript reader now refuses it with the same
  words. A vector both readers run (`PROOF_WITH_A_TRAILING_BYTE_HEX`) holds them to it; the existing vectors and the proof
  format are unchanged.
