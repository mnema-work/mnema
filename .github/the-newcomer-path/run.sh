#!/usr/bin/env bash
# THE NEWCOMER'S PATH, run from the packed files in a terminal, the way the README tells a person
# to walk it. The suite runs the workspace's own `dist`, and the packed-install job runs the
# installed binary in a pipe; neither runs the page. This does: it reads the Quick start block out
# of the README AT RUN TIME (nothing of it is copied here), runs it line for line in a project that
# is a git repository and nothing else, under a pseudo-terminal (`script`, the instrument
# `packages/code/tests/support/pty.ts` drives) that answers every question `mnema init` asks with
# Enter, then checks that the decision the block recorded is the one accepted and linked, and that
# `mnema verify` says the record is intact. A block that stops running, or that records something
# other than what the page says, makes this fail.
#
# THE ONE THING IT SUBSTITUTES is `npm i -g @mnema/code`, the block's first line: `npm` is a shell
# function for the run that sends exactly that command to the tarballs of this commit instead of
# the registry (which would test the last release, not this checkout). Any other `npm` call in the
# block fails the run. The HOME, the prefix and the npm cache are empty directories of the run.
#
# Usage: run.sh [tarballs-dir [readme]]   (from the root of the workspace)
#   Without a directory it packs the five itself and needs the workspace built (`pnpm build`).
#   The README defaults to README.md; the second argument is how the proof that a changed block
#   fails is made, with a copy.
set -euo pipefail

root="$(pwd)"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
readme="${2:-$root/README.md}"
bound=240

if [ "$#" -ge 1 ] && [ -n "$1" ]; then
  tarballs=("$(cd "$1" && pwd)"/*.tgz)
else
  mkdir "$work/tarballs"
  for p in chain core context stacks code; do
    (cd "packages/$p" && pnpm pack --pack-destination "$work/tarballs" >/dev/null)
  done
  tarballs=("$work"/tarballs/*.tgz)
fi
[ "${#tarballs[@]}" -eq 5 ] || { echo "FAIL: expected five tarballs, found ${#tarballs[@]}"; exit 1; }

# The block: the first fenced sh block after the Quick start heading, as written.
block="$work/block.sh"
awk '
  /^## Quick start$/ { seen = 1; next }
  seen && !open && /^```sh$/ { open = 1; next }
  open && /^```$/ { exit }
  open { print }
' "$readme" >"$block"
[ -s "$block" ] || { echo "FAIL: no sh block under '## Quick start' in $readme"; exit 1; }
echo "--- the block, as the page writes it"
cat "$block"
echo "---"

home="$work/home"
prefix="$work/prefix"
shell="$work/shell"
mkdir "$home" "$prefix" "$shell"

# `your-repository` is somebody's repository: a git repository with a folder to point a rule at.
repo="$shell/your-repository"
mkdir -p "$repo/src/billing"
git -C "$repo" init -q
git -C "$repo" config user.email newcomer@example.com
git -C "$repo" config user.name newcomer

# What the block runs in: strict, in the folder that holds the repository (the block's own
# `cd your-repository` goes in), with `npm` answering the one install the page shows.
runner="$work/runner.sh"
{
  # Stops at the first failing command; not `pipefail`, because the page's own `| grep -m1` closes
  # the pipe early on purpose and a person's shell does not set it.
  echo 'set -eu'
  echo 'npm() {'
  echo '  if [ "$*" = "i -g @mnema/code" ]; then'
  printf '    command npm i -g --prefix %q --no-audit --no-fund' "$prefix"
  printf ' %q' "${tarballs[@]}"
  echo
  echo '  else echo "FAIL: the block calls npm $*" >&2; return 1; fi'
  echo '}'
  printf 'cd %q\n' "$shell"
  printf 'source %q\n' "$block"
} >"$runner"

envv=(env -i HOME="$home" PATH="$prefix/bin:$PATH" TERM=xterm npm_config_cache="$work/npm-cache" GIT_CONFIG_NOSYSTEM=1)

# Enter, a steady trickle of it, for every question `init` asks at a terminal.
trickle() { while :; do sleep 0.5; echo; done; }

log="$work/session.log"
status=0
# (Not a pipe: under `pipefail` the feeder's SIGPIPE, when the session ends, would be the status.)
timeout "$bound" "${envv[@]}" script -qec "bash $runner" /dev/null < <(trickle) >"$log" 2>&1 || status=$?
sed 's/\r$//' "$log"
if [ "$status" -eq 124 ]; then echo "FAIL: the block did not finish within ${bound}s"; exit 1; fi
[ "$status" -eq 0 ] || { echo "FAIL: the block exited $status"; exit 1; }

grep -q "local integrity verified" "$log" || { echo "FAIL: verify did not say the record is intact"; exit 1; }

# The decision the block recorded is the one accepted and linked: read it back, from the record.
cd "$repo"
# `init` records a decision of its own (the first), so the one to read is the one `accept` named.
adr="$(sed -n 's/^Decision \(ADR-[0-9]*\) .*accepted.*/\1/p' "$log" | head -n 1)"
[ -n "$adr" ] || { echo "FAIL: the block accepted no decision"; exit 1; }
"${envv[@]}" mnema show "$adr" >"$work/show.txt" 2>&1 || { cat "$work/show.txt"; echo "FAIL: mnema show $adr"; exit 1; }
cat "$work/show.txt"
grep -q 'Keep money as integer cents' "$work/show.txt" || { echo "FAIL: $adr is not the decision the block recorded"; exit 1; }
grep -qi 'accepted' "$work/show.txt" || { echo "FAIL: $adr is not accepted"; exit 1; }
"${envv[@]}" mnema refs "$adr" >"$work/refs.txt" 2>&1 || { cat "$work/refs.txt"; echo "FAIL: mnema refs $adr"; exit 1; }
cat "$work/refs.txt"
grep -q "refuses-a-write.*src/billing" "$work/refs.txt" || { echo "FAIL: $adr is not linked to src/billing"; exit 1; }
echo "ok: the newcomer's path ran, $adr is accepted and linked, and verify is green"
