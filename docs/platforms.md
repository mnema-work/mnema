# Windows and macOS

Every pull request runs one job on `windows-latest` and one on `macos-latest`, each on Node 24.15.0 (the floor)
and on the latest 24. The job packs `@mnema/code`, installs that one tarball with `npm i -g` into an empty home (so the launcher is the
one npm writes there, `mnema.cmd` on Windows), checks that npm put no more than five packages on the machine, and
drives the installed binary:

- `mnema init`, recording a decision and accepting it, linking a rule that refuses a write at a folder, and
  `mnema verify --require signed`, which must say the record is intact;
- the same record in a clone git checked out with `core.autocrlf=true`: every record file must come out with LF
  (the record's `.gitattributes` says `* -text`), and `mnema verify` and the Python reader (3.9, the floor: its
  self-test and the record) must accept it. That shows the attribute holds the line endings; it does not show that a
  reader accepts CRLF;
- a tail of that clone moved out and replaced by a junction to it (a symbolic link on macOS), which both readers,
  the binary's and the Python one, must refuse by its name. A junction needs no administrator; a symbolic link on Windows
  does, and none is made there, nor a link at any other place a reader reads, nor a OneDrive placeholder (which both
  readers read as the file it holds) or a WSL link (a link to the binary from Node 24.16, whose libuv is 1.52, and not on the floor, 24.15);
- `mnema doctor`;
- every command line of the plugin's hook files, for every host (`hooks.json` for Claude Code, VS Code, Cursor and
  Qwen Code, `codex.json`, `copilot.json` and Gemini's `hooks/hooks.json`), read from the files themselves, so a hook added
  later is run later, and started as Node starts them: the handler with the arguments the file gives it, a payload in the
  shape measured where `docs/evidence.md` measures it and, for the rest, the common fields, and the paths written the way the system writes them. Each must start, exit 0, and
  say nothing that means it could not run. Where the project fixes the answer, it is checked: every opening
  (`session-start.mjs` for each file, with Codex's and Copilot's arguments, Gemini's `open`, and the subagent's) must hand
  over a decision in force, and every gate (VS Code, Codex, Copilot, Qwen Code, Cursor, Gemini's `gate`) must refuse a
  write under the rule, naming it (a refusal that says `mnema` could not answer fails the check), and let a write
  elsewhere through. The rest (the recall, the compaction, the tally, the corrections, what follows a write, the dispatch,
  the subagent's stop, the settled choice) are shown only to start and exit 0: the job says so on each, and does not claim
  they ran `mnema`. For Cursor the paths are also tried with backslashes and a drive letter, forward slashes, the drive
  letter in lower case, the 8.3 short spelling of the temp directory (`RUNNER~1`), and, for a folder that exists, another
  letter case. The `mcp_tool` entry of `hooks.json` is a call into the server and not a process, and is not run; neither is
  OpenCode's module.

Not run there: the test suite (about ten minutes on Linux, and it leans on `sh`, a pty and `unshare`, so it runs
on Linux only), the commands of the plugin's hook files as a host starts them (here `node` runs the handler; a host's own shell does not, which matters for Copilot's two lines that end in `; exit 0`), the Python reader on any
version but 3.9, and any host itself. A rule addressed at a folder that is not on disk yet is matched by its
letters as written, so on a case-insensitive volume a write that spells that folder in other case goes round it.

Two things were found by that job, and are the reason the lines above are not a guess. Node cannot start npm's
`mnema.cmd` without a shell, so every hook answered `could not be started` on Windows; and a path written with a
drive letter and backslashes never matched a rule's address, so no rule applied to a Windows write at all. Both are
fixed. One limit remains, computed from the names the format gives and not run into: a witnessed record names a
file `tails/<id>/witness/<digest>.sigstore.json`, 190 characters below `.mnema/` (197 with `.mnema\`), and Windows
stops at 260 for a whole path, drive and separators included, so the project folder must fit in about 61 characters.
Past that, `git checkout` or `git clone` can fail with `Filename too long` unless `git config core.longpaths true` is
set, and the Python reader may fail to open the file unless the system's `LongPathsEnabled` is on. The job turns
`core.longpaths` on for the repository's own fixtures, and its record holds no witness, so neither failure is
exercised for the installed product.

On Windows the hooks start `mnema.cmd` through `cmd.exe`, which cannot be given a `"`, a `%`, a `^` or a line break
inside a word. A path of `mnema` (the plugin's `mnema_path`) that has one is not run: the opening is silent, and a
write under a rule that refuses it is refused with a reason that says so.
