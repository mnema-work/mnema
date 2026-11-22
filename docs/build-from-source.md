# Building it from source

The published version installs with `npm i -g @mnema/code` ([Install](install.md)). This page is for running the
`main` branch instead, or for changing the code.

## Install the `main` branch as a command

It needs Node `^24.15.0 || >=26.0.0`; the pnpm version comes from the repository's `packageManager` through
corepack. `@mnema/code` depends on the other four packages, so the five tarballs go in one command:

```sh
git clone https://github.com/mnema-work/mnema.git && cd mnema
mkdir -p "$HOME/.local/bin" && export PATH="$HOME/.local/bin:$PATH"
corepack enable --install-directory ~/.local/bin && pnpm install --frozen-lockfile && pnpm build
dest="$(mktemp -d)"
for p in chain core context stacks code; do (cd "packages/$p" && pnpm pack --pack-destination "$dest"); done
npm i -g --prefix ~/.local "$dest"/*.tgz
```

Add the `export` line to your shell's startup file so the `PATH` lasts.

`--prefix ~/.local` installs under your own home, so it needs no root. Without it, a Node installed by the
system has npm's global prefix at `/usr`, and `npm i -g` stops at `EACCES` on `/usr/lib/node_modules/@mnema`.
Likewise a plain `corepack enable` writes its `pnpm` shim beside `node` and needs permission there; the
`--install-directory ~/.local/bin` above puts it in your home instead (if you installed Node under your own
home, a plain `corepack enable` is enough).

The lines are for `sh` and a `~` the shell expands; they do not run as written in the Windows `cmd` or PowerShell.
To update, pull the clone and run the same steps again.

## Build and test

A pnpm workspace on Node 24.15.0 or a later 24, or 26.0.0 or later. `build` comes first because the packages
compile against each other's declarations, and a stale `dist` is how a type
check goes green over code that no longer exists:

```sh
pnpm install
pnpm build
pnpm lint
pnpm test
```

`pnpm build` leaves the binary at `packages/code/dist/bundle/cli.js`, the entry
the package's `bin` names: run it as `node packages/code/dist/bundle/cli.js --version`, or
symlink it onto your `PATH` under the name `mnema`, which is the shape a
published install takes. It is one bundle of the compiled `packages/code/dist/cli.js` and
of everything that file reaches, split into chunks beside it in `dist/bundle/`, so a stack
trace names a chunk and a line in it, not a file of `src`. The compiled `dist/cli.js` is
still built and still runs, as the library and the tests in this repository use it. To change the code, start with [`CONTRIBUTING.md`](../CONTRIBUTING.md).

## The single executable

After `pnpm build`, on Linux x64 with Node 25.7 or later (Node 26 is in the supported range), `pnpm build:single-executable`
folds the CLI into one file with Node's single executable applications and writes it, with its SHA-256 line, to
`packages/code/dist/single-executable/` as `mnema-<version>-linux-x64` and `mnema-<version>-linux-x64.sha256`. The file
holds the Node that built it, so it is about 150 MB. It needs no `postject` and adds no dependency: Node's own
`--build-sea` writes it. A Node below 25.7 is refused by name before anything is written. It is experimental
([install](install.md#a-single-file-without-node-experimental)).
