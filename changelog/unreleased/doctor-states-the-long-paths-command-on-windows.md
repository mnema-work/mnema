Added

- **On Windows, `mnema doctor` checks the record against the 260-character path limit and says what to run.** It measures the deepest path the record holds and the longest name a witnessed record would add, reads git's `core.longpaths` (`git config --get`, nothing written), and where a path passes 260 and the setting is not true it states `git config --global core.longpaths true`, with a note that the Python reader needs the system's `LongPathsEnabled`. It never writes git's global configuration, not even with `--fix`.
