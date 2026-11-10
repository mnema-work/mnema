# mnema skill export

<!-- This page is generated from the help of the command, written where the command is defined under packages/code/src/wiring/: edit it there, then run `pnpm vitest run packages/code/src/cli.golden.test.ts -u` (which rewrites packages/code/src/cli.help.golden.txt) and `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

write an adopted pattern as the SKILL.md an agent host reads (records nothing)

In the help under **Record** · a command of [`mnema skill`](skill.md).

## Arguments

| Argument | What it does |
| --- | --- |
| `id` | the skill id (the value shown when it was proposed) |

## Options

| Option | What it does |
| --- | --- |
| `--out <dir>` | the directory the &lt;name>/SKILL.md is written under (default: "./skills") |
| `--description <text>` | what the host chooses this skill by; omitted, it is derived from the body |

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->
<!-- End of the part written by hand. -->

## The whole help

```text
Usage: mnema skill export [options] <id>

write an adopted pattern as the SKILL.md an agent host reads (records nothing)

Arguments:
  id                    the skill id (the value shown when it was proposed)

Options:
  --out <dir>           the directory the <name>/SKILL.md is written under
                        (default: "./skills")
  --description <text>  what the host chooses this skill by; omitted, it is
                        derived from the body
  -h, --help            display help for command

What it writes, and what it will not:
  <out>/<name>/SKILL.md: the frontmatter the skills specification defines, then the
  recorded body VERBATIM. Nothing summarizes, reformats or improves the body: it is
  what was signed.
  `description` is REQUIRED by the specification and the record holds none, so it is
  derived at export time: the first sentence of the body (or its first paragraph),
  collapsed to one line and cut to 1024 characters. `--description` overrides it. No
  model is asked for one anywhere. A derived one with no "when", "whenever" or "quando"
  in it is exported all the same, with a warning on the second stream.
  `name` must already BE a specification name (1–64 of a-z, 0-9 and -, no hyphen at
  either end, none doubled) because it has to equal the directory name. A recorded
  name that is not one is refused, never rewritten into one.
  Only an ADOPTED pattern is exported. A proposal put in a host’s skills directory is
  read as how the work is done here; a deprecated one is a retired way of working
  wearing the same face. There is no --force: adopt it, then export it.
  It records nothing (no event, no consultation) and it writes nowhere but --out.
```
