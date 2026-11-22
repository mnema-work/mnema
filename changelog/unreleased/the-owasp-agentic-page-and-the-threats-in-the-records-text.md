Added

- **A page that reads the OWASP Top 10 for Agentic Applications item by item, and a page on the threats the record's own text carries.** [The OWASP Top 10 for Agentic Applications](docs/owasp-agentic-top-10.md) gives, for each of the ten items, what mnema does, what it does not and the page or test that holds each sentence; it gives no score and no badge, and says for most items that mnema does not address them. [The text the record hands a model](docs/the-text-the-record-hands-a-model.md) says what reaches a model unasked, what mnema does to that text on the way (one line, control bytes made visible, a secret redacted, authorship said, who accepted each rule) and what it does not (it does not read the words, nor mark them as data to ignore, nor decide who may add them). [Where it fits](docs/where-it-fits.md) now says where mnema sits next to session capture, agent memory and a folder of ADRs.

Changed

- Every shell block of every page of `docs/`, of the plugin's README and of the second reader's README has its comment on a line of its own, not after a command, and the guard that held that for the pages a newcomer pastes from now reads every page of `docs/`.
