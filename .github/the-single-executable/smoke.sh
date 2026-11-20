#!/usr/bin/env bash
# THE SMOKE OF THE SINGLE EXECUTABLE. Runs the file `packages/code/build/the-single-executable.mjs` wrote the
# way a person who has no Node would: an empty HOME, a PATH that holds no `node`, an empty project. It
# checks the file against its own SHA-256 line, asks the version, then runs `init`, `decision record`
# and `verify`, and goes red if the version is not the package's or `verify` does not say the record is intact.
#
#   bash .github/the-single-executable/smoke.sh packages/code/dist/single-executable
set -euo pipefail

folder="$(cd "${1:?the folder the build wrote}" && pwd)"
executable="$(ls "$folder"/mnema-*-linux-x64)"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

(cd "$folder" && sha256sum --check "$(basename "$executable").sha256")

# A PATH with the tools the run needs (git) and no Node: the executable has to carry its own.
bin="$work/bin"
mkdir "$bin"
ln -s "$(command -v git)" "$bin/git"
home="$work/home"
mkdir "$home"
run_in() { env -i HOME="$home" PATH="$bin" GIT_CONFIG_NOSYSTEM=1 "$@"; }

if run_in sh -c 'command -v node' >/dev/null 2>&1; then
  echo "FAIL: the sandbox PATH still finds a node"
  exit 1
fi

want="$(node -p 'require("./packages/code/package.json").version')"
got="$(run_in "$executable" --version)"
[ "$got" = "$want" ] || { echo "FAIL: the executable says '$got', the package is $want"; exit 1; }

mkdir "$work/project"
cd "$work/project"
run_in "$executable" init
run_in "$executable" decision record "Keep money as integer cents" "Float sums drift; cents are exact."
out="$(run_in "$executable" verify)"
echo "$out"
grep -q "local integrity verified" <<<"$out" || { echo "FAIL: verify did not say the record is intact"; exit 1; }
echo "single executable smoke: ok"
