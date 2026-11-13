Changed

- **A formatter's requoting of the front matter is not taken for an edit.** `.github/instructions/mnema-instructions.instructions.md`
  and `.cursor/rules/mnema-instructions.mdc` are read by their front matter as keys and values (quotes and order do not
  matter) and their block by the markers, so prettier with `singleQuote: true`, which writes `applyTo: '**'`, no longer
  leaves the file reported. Another key or another value, such as an `applyTo` you changed, is still your edit and kept.
