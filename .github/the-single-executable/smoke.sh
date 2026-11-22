#!/usr/bin/env bash
# THE SMOKE OF THE SINGLE EXECUTABLE. Runs the file `packages/code/build/the-single-executable.mjs` wrote
# the way a person who has no Node would: an empty HOME, a PATH that holds no `node`, a project that is a git
# repository. It checks the file against its own SHA-256 line, then runs it
#   - by absolute path (`--version`),
#   - BY NAME THROUGH THE PATH (a single executable is told the name it was typed with, not a script; once it ran
#     that way and did nothing, exit 0),
#   - through `init`, `decision record` and `verify`,
#   - and the merge driver `init` wrote into git's configuration, run the way git runs it (`sh -c` over the line
#     with %O %A %B %P filled in): a driver that names the executable twice fails `mnema has no command`.
# It goes red if any of those fails or `verify` does not say the record is intact.
#
#   bash .github/the-single-executable/smoke.sh packages/code/dist/single-executable
set -euo pipefail

folder="$(cd "${1:?the folder the build wrote}" && pwd)"
executable="$(ls "$folder"/mnema-*-linux-x64)"
name="$(basename "$executable")"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

(cd "$folder" && sha256sum --check "$name.sha256")

# A PATH with the tools the run needs (git, sh) and no Node: the executable has to carry its own. The
# executable itself is put on it by name.
bin="$work/bin"
mkdir "$bin"
ln -s "$(command -v git)" "$bin/git"
ln -s /bin/sh "$bin/sh"
cp "$executable" "$bin/$name"
home="$work/home"
mkdir "$home"
run_in() { env -i HOME="$home" PATH="$bin" GIT_CONFIG_NOSYSTEM=1 "$@"; }

if run_in /bin/sh -c 'command -v node' >/dev/null 2>&1; then
  echo "FAIL: the sandbox PATH still finds a node"
  exit 1
fi

want="$(node -p 'require("./packages/code/package.json").version')"
got="$(run_in "$executable" --version)"
[ "$got" = "$want" ] || { echo "FAIL: by absolute path the executable says '$got', the package is $want"; exit 1; }

got="$(run_in "$name" --version)"
[ "$got" = "$want" ] || { echo "FAIL: called by name through the PATH it says '$got', the package is $want"; exit 1; }

mkdir "$work/project"
cd "$work/project"
run_in git init -q
# `init` sets up a plain `git pull` only in a clone that has a remote.
run_in git remote add origin https://example.invalid/project.git
run_in "$name" init --git-pull yes
run_in "$name" decision record "Keep money as integer cents" "Float sums drift; cents are exact."
out="$(run_in "$name" verify)"
echo "$out"
grep -q "local integrity verified" <<<"$out" || { echo "FAIL: verify did not say the record is intact"; exit 1; }

driver="$(run_in git config --get-regexp '^merge\..*\.driver$' | head -n 1 | cut -d' ' -f2- || true)"
[ -n "$driver" ] || { echo "FAIL: init wrote no merge driver into git's configuration"; exit 1; }
echo "merge driver: $driver"
tail_file="$(find .mnema/tails -name '*.jsonl' ! -name checkpoints.jsonl | head -n 1)"
[ -n "$tail_file" ] || { echo "FAIL: the record has no tail to merge"; exit 1; }
for copy in base ours theirs; do cp "$tail_file" "$work/$copy.jsonl"; done
line="${driver//%O/$work/base.jsonl}"
line="${line//%A/$work/ours.jsonl}"
line="${line//%B/$work/theirs.jsonl}"
line="${line//%P/$tail_file}"
run_in /bin/sh -c "$line" || { echo "FAIL: the merge driver does not run the way git runs it"; exit 1; }
cmp "$work/ours.jsonl" "$tail_file" || { echo "FAIL: merging a tail with itself changed it"; exit 1; }

echo "single executable smoke: ok"
