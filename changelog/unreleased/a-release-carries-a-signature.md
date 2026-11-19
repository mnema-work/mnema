Added

- **A release carries a signature.** From the next release, the GitHub release holds the five tarballs, their SHA-256 and
  a Sigstore build provenance bundle for them (`mnema-npm-packages-<version>.sigstore.json`), and the extension's `.vsix`
  has its own bundle (`mnema-<version>.vsix.sigstore.json`), made by `actions/attest` after the publish and after the
  extension is packed. `gh attestation verify <file> --repo mnema-work/mnema` checks a downloaded file against it. The
  publish job also names the npm registry in its `setup-node`, which changes nothing in how it authenticates (OIDC, no
  token).
