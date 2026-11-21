Changed

- **The README's banner is the brand's lockup, and the badges are in dark stone.** The banner is the almond eye with its yellow iris
  beside the word, drawn by `node .github/the-brand/banner.mjs` (it needs no build), with no words and no ground of its own: it sits
  on the colour of the page that shows it, dark, light or dimmed. The eye blinks on a cycle of 9 seconds; under
  `prefers-reduced-motion` the banner shows the eye at rest and nothing moves, because a media query cannot stop an animation, so the
  banner holds two copies of the eye and a media query inside the picture swaps them. Its text alternative is "mnema: the decision
  record for AI coding agents". Every shields.io badge of the README and of the packages' READMEs is dark stone, and the badge of the
  CI workflow carries no colour at all, so that it turns red when the build fails.
