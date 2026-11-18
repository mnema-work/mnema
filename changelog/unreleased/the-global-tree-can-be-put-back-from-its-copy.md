Added

- **`mnema backup restore --global` puts back the machine's global tree from its copy, and `mnema backup verify --global` reads that copy.**
  The copy is the one set up with `mnema backup setup --global <folder>` (`<folder>/global/`), read by this mnema's reader, and restored under the rules
  of a project's restore: it never overwrites a file, a live tail that went further wins, a copy tail that is not the start of the live one
  refuses the whole restore, `locks/` and the installation's id and anchor never come back, and a link or a private key refuses before the
  first byte. A copy of another machine's global tree is asked at a terminal first (the question says that every project on the machine
  reads the global tree); on a yes the live global tree is moved, never copied, to `<mnema home>/before-restore/<UTC date>/global/`, and
  `--undo --global` puts it back. Nothing kept aside is ever deleted: `mnema backup status --global` lists it, and you remove it by hand. A global restore
  never touches a project's trees, and a project's restore never touches the global tree (ADR-528, ADR-519, ADR-518).
