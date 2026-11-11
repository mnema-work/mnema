// Draws the package-to-package import graph of docs/architecture.md from the imports under
// packages/*/src, and puts it between the two markers of the page.
//
//   node .github/the-architecture-page/graph.mjs           rewrite the block in the page
//   node .github/the-architecture-page/graph.mjs --check   say whether the page holds it, change nothing
//
// The reading is dependency-cruiser's (a devDependency of the workspace): every tracked source
// file of a package that is not a test, with the imports a type erases kept, so a package that only
// borrows another's types is still drawn as depending on it. The page holds what this prints and
// nothing else between its markers, and a case compares the two.

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PAGE = 'docs/architecture.md';
export const BEGIN = '<!-- the-import-graph:begin -->';
export const END = '<!-- the-import-graph:end -->';

/** @typedef {{ packages: string[], edges: [string, string][], evidence: [string, string, string][] }} Graph */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * The tracked, non-test source files of every package, by package directory name.
 * @param {string} root
 * @returns {Map<string, string[]>}
 */
function sourcesOf(root) {
  const listed = execFileSync(
    'git',
    ['ls-files', '-z', '--', ':(glob)packages/*/src/**/*.ts', ':(glob)packages/*/src/**/*.tsx'],
    {
      cwd: root,
      encoding: 'utf-8',
      maxBuffer: 64 * 1024 * 1024,
    },
  )
    .split('\0')
    .filter((path) => path !== '' && !/\.test\.tsx?$/.test(path));
  /** @type {Map<string, string[]>} */
  const bySource = new Map();
  for (const path of listed) {
    const name = /** @type {string} */ (path.split('/')[1]);
    bySource.set(name, [...(bySource.get(name) ?? []), path]);
  }
  return bySource;
}

/**
 * The imports between packages: `{ packages: string[], edges: [from, to][] }`, names as the
 * packages call themselves (`@mnema/core`), sorted. A subpath (`@mnema/code/library`) is its package.
 * @param {string} [root]
 * @returns {Graph}
 */
export function importGraph(root = ROOT) {
  const bySource = sourcesOf(root);
  const packages = [...bySource.keys()].sort().map((dir) => `@mnema/${dir}`);
  /** @type {Set<string>} */
  const edges = new Set();
  /** @type {Map<string, string>} the first module that makes each edge */
  const evidence = new Map();
  for (const [dir, files] of bySource) {
    const out = execFileSync(
      process.execPath,
      [
        join(root, 'node_modules', 'dependency-cruiser', 'bin', 'dependency-cruiser.mjs'),
        '--no-config',
        '--ts-pre-compilation-deps',
        '-T',
        'json',
        ...files,
      ],
      { cwd: root, encoding: 'utf-8', maxBuffer: 256 * 1024 * 1024 },
    );
    for (const module of JSON.parse(out).modules) {
      // Only the files handed over: a followed module (a package's built dist) is not this package's source.
      if (!module.source.startsWith(`packages/${dir}/src/`)) continue;
      for (const dependency of module.dependencies) {
        const named = /^(@mnema\/[a-z]+)(\/|$)/.exec(dependency.module);
        if (named !== null && named[1] !== `@mnema/${dir}`) {
          edges.add(`@mnema/${dir}\t${named[1]}`);
          evidence.set(
            `@mnema/${dir}\t${named[1]}`,
            evidence.get(`@mnema/${dir}\t${named[1]}`) ?? module.source,
          );
        }
      }
    }
  }
  return {
    packages,
    edges: [...edges].sort().map((edge) => /** @type {[string, string]} */ (edge.split('\t'))),
    evidence: [...evidence]
      .sort()
      .map(([edge, source]) => [.../** @type {[string, string]} */ (edge.split('\t')), source]),
  };
}

/**
 * A package's layer: 0 when it imports no other package, else one more than the deepest it imports.
 * @param {Graph} graph
 * @returns {Map<string, number>}
 */
export function layersOf({ packages, edges }) {
  /** @type {Map<string, number>} */
  const layer = new Map();
  /**
   * @param {string} name
   * @param {string[]} path
   * @returns {number}
   */
  const depth = (name, path = []) => {
    if (path.includes(name))
      throw new Error(`the packages import each other in a ring: ${[...path, name].join(' -> ')}`);
    if (!layer.has(name)) {
      const below = edges
        .filter(([from]) => from === name)
        .map(([, to]) => depth(to, [...path, name]));
      layer.set(name, below.length === 0 ? 0 : 1 + Math.max(...below));
    }
    return /** @type {number} */ (layer.get(name));
  };
  for (const name of packages) depth(name);
  return layer;
}

/** @param {string} name */
const id = (name) => name.replace('@mnema/', '');

/**
 * The block that sits between the markers, markers included.
 * @param {Graph} graph
 */
export function blockOf(graph) {
  const layer = layersOf(graph);
  const top = Math.max(...layer.values());
  const lines = ['flowchart TD'];
  for (let n = 0; n <= top; n += 1) {
    const here = graph.packages.filter((name) => layer.get(name) === n);
    lines.push(`  subgraph layer${n}["layer ${n}"]`);
    for (const name of here) lines.push(`    ${id(name)}["${name}"]`);
    lines.push('  end');
  }
  for (const [from, to] of graph.edges) lines.push(`  ${id(from)} --> ${id(to)}`);
  return [
    BEGIN,
    `<!-- Generated by ${'`'}node .github/the-architecture-page/graph.mjs${'`'} from the imports under packages/*/src. Do not edit by hand. -->`,
    '',
    '```mermaid',
    ...lines,
    '```',
    END,
  ].join('\n');
}

/**
 * The page with its block replaced by `block`; throws when the markers are not there once each, in order.
 * @param {string} page
 * @param {string} block
 */
export function withBlock(page, block) {
  const from = page.indexOf(BEGIN);
  const to = page.indexOf(END);
  if (
    from < 0 ||
    to < from ||
    page.indexOf(BEGIN, from + 1) >= 0 ||
    page.indexOf(END, to + 1) >= 0
  ) {
    throw new Error(`${PAGE} must hold ${BEGIN} and then ${END}, once each`);
  }
  return page.slice(0, from) + block + page.slice(to + END.length);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const path = join(ROOT, PAGE);
  const page = readFileSync(path, 'utf-8');
  const next = withBlock(page, blockOf(importGraph()));
  if (process.argv.includes('--check')) {
    process.stdout.write(
      next === page ? 'the page holds the graph\n' : 'the page differs from the graph\n',
    );
    process.exitCode = next === page ? 0 : 1;
  } else if (next !== page) {
    writeFileSync(path, next);
  }
}
