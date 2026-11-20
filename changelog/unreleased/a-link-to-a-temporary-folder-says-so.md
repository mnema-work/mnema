Changed

- **The link command and `link_knowledge` say when the target is a file under a temporary folder.** A target that is an
  absolute path under `os.tmpdir()`, `/tmp`, `/var/tmp`, `$TMPDIR` or the Windows `%TEMP%` gets, after the write, "<path> is
  under a temporary folder, which a reboot or a cleanup can clear, so the link may name a file nobody can open later. Copy the
  file under the project and link that." In any tree and under any relation (a `derived-from` to a brief left in `/tmp` was
  the case that went unsaid). The edge is still written. A path under the project's own root, a relative path and an id are
  never warned about, and the text of a handoff brief is not read for paths. A file that exists is compared by where it really is, so `/tmp` and `/private/tmp` (macOS) are one place, and the project's own file is never warned about whichever way its path is spelled; a `$TMPDIR` that is `/`, the home folder or a folder holding the project is ignored.
