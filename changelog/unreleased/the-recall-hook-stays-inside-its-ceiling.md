Fixed

- **`mnema recall --hook` stays inside what a hook carries when the last session recorded hundreds of decisions.** The section
  on where the last session stopped named every decision it recorded on one line; on a record where one session had recorded
  about 590, the text came to 12,271 characters, over the 10,000 a hook carries, so the host replaced it with a file path
  and the session opened with no notes. The section now names the first five and counts the rest, and the verb hands
  nothing, rather than a text above the ceiling, when even the part that is always printed would not fit.
