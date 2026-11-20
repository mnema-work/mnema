#!/usr/bin/env bash
# THE NPX RECIPE, run from the packed file, the way docs/install.md tells a person to try mnema without
# installing it. It reads the block under "Try it without installing" out of the page AT RUN TIME
# (nothing of it is copied here) and runs it line for line, in a folder of the run, with an empty HOME,
# an empty npm cache and no `mnema` on the PATH. Then it reads the record the block left: the decision
# it recorded is accepted, and `verify` said the record is intact.
#
# THE ONE THING IT SUBSTITUTES is the package name: `npx` is a shell function for the run that turns
# `npx --yes @mnema/code@<version> <args>` into `npx --yes --package <this commit's tarball> -- mnema
# <args>`, because the registry would give the last release, not this checkout. Any other `npx` call
# in the block fails the run. The page is not changed to fit: a line that drifts from that shape fails.
#
# Usage: run.sh [tarball [page]]   (from the root of the workspace)
#   Without a tarball it packs `@mnema/code` itself and needs the workspace built (`pnpm build`).
#   The page defaults to docs/install.md; the second argument is how the proof that a changed block
#   fails is made, with a copy.
set -euo pipefail

root="$(pwd)"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
page="${2:-$root/docs/install.md}"
bound=240

if [ "$#" -ge 1 ] && [ -n "$1" ]; then
  tarball="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"
else
  mkdir "$work/tarballs"
  (cd packages/code && pnpm pack --pack-destination "$work/tarballs" >/dev/null)
  tarball="$(ls "$work"/tarballs/mnema-code-*.tgz)"
fi
[ -f "$tarball" ] || { echo "FAIL: no tarball at $tarball"; exit 1; }

# The block: the first fenced sh block under the heading, as written.
block="$work/block.sh"
awk '
  /^## Try it without installing$/ { seen = 1; next }
  seen && !open && /^```sh$/ { open = 1; next }
  open && /^```$/ { exit }
  open { print }
' "$page" >"$block"
[ -s "$block" ] || { echo "FAIL: no sh block under '## Try it without installing' in $page"; exit 1; }
echo "--- the block, as the page writes it"
cat "$block"
echo "---"

home="$work/home"
shell="$work/shell"
mkdir "$home" "$shell"

runner="$work/runner.sh"
{
  # Stops at the first failing command; not `pipefail`, because the page's own `| grep -m1` closes
  # the pipe early on purpose and a person's shell does not set it.
  echo 'set -eu'
  echo 'npx() {'
  echo '  case "$1 $2" in'
  echo '    "--yes @mnema/code@"[0-9]*.[0-9]*.[0-9]*)'
  echo '      shift 2'
  printf '      command npx --yes --package %q -- mnema "$@" ;;\n' "$tarball"
  echo '    *) echo "FAIL: the block calls npx $*" >&2; return 1 ;;'
  echo '  esac'
  echo '}'
  printf 'cd %q\n' "$shell"
  printf 'source %q\n' "$block"
} >"$runner"

# No `mnema` on the PATH: the block has to get it from npx alone. A machine that has one installed
# keeps the rest of its PATH; the folders holding a `mnema` are left out of the run's.
clean_path=""
IFS=: read -ra path_dirs <<<"$PATH"
for d in "${path_dirs[@]}"; do
  [ -e "$d/mnema" ] || clean_path="${clean_path:+$clean_path:}$d"
done
envv=(env -i HOME="$home" PATH="$clean_path" npm_config_cache="$work/npm-cache" GIT_CONFIG_NOSYSTEM=1)
if "${envv[@]}" bash -c 'command -v mnema' >/dev/null 2>&1; then
  echo "FAIL: a mnema is still on the PATH, so the run would not prove the recipe"
  exit 1
fi

log="$work/session.log"
status=0
timeout "$bound" "${envv[@]}" bash "$runner" </dev/null >"$log" 2>&1 || status=$?
cat "$log"
if [ "$status" -eq 124 ]; then echo "FAIL: the block did not finish within ${bound}s"; exit 1; fi
[ "$status" -eq 0 ] || { echo "FAIL: the block exited $status"; exit 1; }

grep -q "local integrity verified" "$log" || { echo "FAIL: verify did not say the record is intact"; exit 1; }

# The decision the block recorded is the one accepted: read it back, from the record.
adr="$(sed -n 's/^Decision \(ADR-[0-9]*\) .*accepted.*/\1/p' "$log" | head -n 1)"
[ -n "$adr" ] || { echo "FAIL: the block accepted no decision"; exit 1; }
grep -q 'Keep money as integer cents' "$log" || { echo "FAIL: show did not print the decision the block recorded"; exit 1; }
cd "$(ls -d "$shell"/*/ | head -n 1)"
"${envv[@]}" npx --yes --package "$tarball" -- mnema show "$adr" >"$work/show.txt" 2>&1 || { cat "$work/show.txt"; echo "FAIL: mnema show $adr"; exit 1; }
grep -q 'Keep money as integer cents' "$work/show.txt" || { echo "FAIL: $adr is not the decision the block recorded"; exit 1; }
grep -qi 'accepted' "$work/show.txt" || { echo "FAIL: $adr is not accepted"; exit 1; }
echo "ok: the npx recipe ran, $adr is accepted, and verify is green"
