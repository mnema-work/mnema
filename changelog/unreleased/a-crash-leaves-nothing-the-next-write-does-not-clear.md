Fixed

- **A tail proof a power cut left empty or cut short is written again, and the staging notes of a killed writer are removed.** A
  `tailproof.json` that existed and did not parse was never replaced: every later write passed in silence and `verify`, in both
  readers, refused the tail for good. The next write of the tail now writes it again, to the disk like the birth, when it is empty
  or does not parse; one that parses is left as it is, whichever record it names. The files a writer stages in `locks/` before it
  renames them into place (`<tail>.head.<pid>`, `<tail>.head.sig.<pid>`, `<tail>.cited.<pid>`) stayed for good when the writer was
  killed in between; a writer holding the tail's lock now removes the ones of that tail whose pid no longer answers, and never the
  ones of another tail or of a writer that is alive.
