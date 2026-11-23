#!/usr/bin/env bash
# Asks the MCP Inspector's CLI, an independent client, for the tool list of `mnema mcp`, in an
# empty HOME and an empty project, and fails when the call errors or lists no tools. Then asks it
# once more about a command that does not speak MCP and fails when THAT does not fail, so a check
# that cannot go red does not pass for one.
#
#   pnpm build && npm ci --ignore-scripts --prefix .github/mcp-inspector && bash .github/mcp-inspector/run.sh
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root="$(cd "$here/../.." && pwd)"
bin="$root/packages/code/dist/bundle/cli.js"
inspector="$here/node_modules/.bin/mcp-inspector"
[ -f "$bin" ] || { echo "FAIL: $bin is not built (pnpm build)"; exit 1; }
[ -x "$inspector" ] || { echo "FAIL: the Inspector is not installed (npm ci --ignore-scripts --prefix .github/mcp-inspector)"; exit 1; }

work="$(mktemp -d "${RUNNER_TEMP:-${TMPDIR:-/tmp}}/mcp-inspector.XXXXXX")"
trap 'rm -rf "$work"' EXIT
mkdir -p "$work/home" "$work/project"
git -C "$work/project" init -q .

# Neither the user's home nor this repository's own record is read or written: the server runs in
# a project of its own, under an empty HOME, with an environment that holds nothing else.
inspect() {
  (cd "$work/project" && env -i HOME="$work/home" PATH="$PATH" GIT_CONFIG_NOSYSTEM=1 \
    "$inspector" --cli "$@" --method tools/list)
}

if ! inspect node "$bin" mcp >"$work/tools.json" 2>"$work/tools.err"; then
  echo "FAIL: the Inspector could not list the tools of mnema mcp"
  cat "$work/tools.err"
  exit 1
fi
count="$(node -e '
  const read = JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8"));
  const tools = Array.isArray(read.tools) ? read.tools : [];
  if (tools.length === 0 || tools.some((tool) => typeof tool.name !== "string")) process.exit(1);
  console.log(tools.length);
' "$work/tools.json")" || { echo "FAIL: the Inspector listed no tools"; cat "$work/tools.json"; exit 1; }
echo "ok: the Inspector listed $count tools of mnema mcp"

if inspect node -e '' >"$work/not-mcp.out" 2>"$work/not-mcp.err"; then
  echo "FAIL: the Inspector listed tools of a command that does not speak MCP, so this check cannot go red"
  cat "$work/not-mcp.out"
  exit 1
fi
echo "ok: the Inspector fails on a command that does not speak MCP"
