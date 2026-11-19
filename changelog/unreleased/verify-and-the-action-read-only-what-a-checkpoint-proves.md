Fixed

- **`mnema verify` reads a tail's checkpoints before the tail, and the Action labels a pull request only from proven decisions.** A verify run beside a write no longer reports a signed fact as missing, and its output on a quiet record is unchanged. The GitHub Action names a decision a pull request cites only from events a signed checkpoint proves, as every read of the product does since 0.1.9; a decision past the last checkpoint is named by its id alone.
