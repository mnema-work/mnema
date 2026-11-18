Changed

- **The osv-scanner check ignores one advisory until 2026-12-17.** `osv-scanner.toml` ignores GHSA-fc5q-39xc-vjpf (a ReDoS in
  picomatch, every version up to 4.0.7, no patched release), with its reason beside it: picomatch is reached only by development
  tooling (vite and fdir), and the published `@mnema/code` ships `string-width` alone. After that date the check accuses it again.
