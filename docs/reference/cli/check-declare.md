# mnema check declare

<!-- This page is generated from the help of the command line (packages/code/src/cli.help.golden.txt): edit it there and run `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

declare the program that checks a rule (no shell: the program and its arguments)

In the help under **Verify** · a command of [`mnema check`](check.md).

## Arguments

| Argument | What it does |
| --- | --- |
| `rule` | the id of the decision the check is for |
| `program` | the program to run, from the project root |
| `args` | its arguments, one by one: put `--` before any that starts with a dash |

## Options

| Option | What it does |
| --- | --- |
| `--which <agent>` | the agent that executed this, when an agent is driving mnema |

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->
<!-- End of the part written by hand. -->

## The whole help

```text
Usage: mnema check declare [options] <rule> <program> [args...]

declare the program that checks a rule (no shell: the program and its arguments)

Arguments:
  rule             the id of the decision the check is for
  program          the program to run, from the project root
  args             its arguments, one by one: put `--` before any that starts
                   with a dash

Options:
  --which <agent>  the agent that executed this, when an agent is driving mnema
  -h, --help       display help for command

What recording means here:
  Permanent: mnema is append-only and nothing deletes a fact. A public record
  is committed and reaches every machine that clones the repository.
  Do not record credentials: a recognized format is replaced with a placeholder
  and reported back, but what mnema does not recognize is written verbatim.
  Nor personal data: an email address is replaced with <email>; the mnid already says who wrote.
  Each text field holds at most 65536 bytes; a longer one is refused.
```
