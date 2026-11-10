Fixed

- **The hosts table of the README shows every logo at one height.** Each image is given a height and no width, so none is
  stretched or squashed and the first column is as narrow as its logos; the logos that were a wide card (Cursor), a badge
  (OpenCode) or a mark on a white square (Factory Droid) are now the vendor's own square or mark file of the same brand page
  or repository, and Goose, which was padded far inside its file, is now the project's own mark with no margin on the light
  page (on the dark page it is still the project's white-mark file, which keeps a margin around the goose), listed in `assets/hosts/SOURCES.md` with its source, date and sha256,
  and a test holds that no image of the table carries a width.
