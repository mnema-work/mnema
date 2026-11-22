Changed

- **The diagrams of the README and of the packages are redrawn in the new brand.** How mnema works, how mnema fits, the family and the
  pictures of `@mnema/chain`, `@mnema/core`, `@mnema/context` and `@mnema/stacks` are drawn on a strict grid in the field of lines
  with four signs for the state of a decision, and every word of the packages' and the family's is a literal of the product. Their
  text is outlines of Archivo and IBM Plex Mono (committed with their licence in `.github/the-brand/fonts/`), because an image loads
  no web font; `node .github/the-brand/diagrams.mjs` draws them and the blocks of the READMEs, and the guard reads the words from
  `data-said` where it read a `<text>`. The npm page of each version reads the pictures from `main`, so they change when this lands.
  The diagrams move: the eye at the top blinks on the banner's 9-second cycle, a soft pulse runs along the lines every 7 seconds and
  each sign sends out a ripple as it passes. Under `prefers-reduced-motion` the pulse and the ripples are not drawn and the eye stays
  open and still. The pictures have no ground of their own: they are transparent and sit on the page that shows them, whether GitHub's
  white, dark or dimmed page, and the panels behind the commands are a low tint of the picture's ink. Every text stays inside the edges
  of its picture, the legend of how mnema fits spans the rule above it with the same gap between its four items, the family's record
  sits under the eye with equal gaps on each side of it, and the eye at the top of `@mnema/core`'s picture has room round it.
