Fixed

- **The write screen no longer refuses a text that shows the shape of a token with its body elided.** A protocol example such as `"token":"agm_…"` was replaced as a credential; an issuer prefix followed by `…` or `...` is the prefix alone, which was already kept. A body after the mark (`agm_…x9Kq2LmZp`) and a prefix with a real body are still replaced.
