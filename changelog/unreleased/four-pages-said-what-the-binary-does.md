Fixed

- **Four pages said what the binary does not.** The two-machines page (`docs/convergence.md`) typed `ADR-1` after an `mnema init` that, at a
  terminal, records a decision of its own first, so on a newcomer's machine the commands named init's decision; it now runs
  `mnema init --yes`, which asks nothing, and says why. The how-it-works page said `decision move` refuses a label, but it
  moves the decision when exactly one carries the label and refuses only when several do. The README's Quick start and
  three install pages had `#` comments after commands, which an interactive zsh without `interactivecomments` (macOS's
  default) hands to the command as arguments; the comments are prose now. A case holds the four pages to no trailing
  comment, and another holds every page that runs an `init` that asks from typing a fixed label after it.
