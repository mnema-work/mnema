Changed

- **`npm i -g @mnema/code` installs 5 packages, not 145.** The published manifest declares only what the bundle imports
  at run time, `string-width`; the other twelve dependencies (the four sibling packages included) are
  `devDependencies`, because the bundle carries their code. The tarball holds `dist/bundle/` (the stack index now sits
  in `dist/bundle/stack-index/`), the notices and the manifest, and its `exports` name only `package.json`. If you
  imported `@mnema/code` or `@mnema/code/library` from npm, that import now fails with "not exported": the library
  is not a published surface, and the workspace's own `exports` are unchanged for the packages that build against it
  here. The packed-install check and the Windows and macOS smoke now install `@mnema/code` alone and fail above five
  packages.
