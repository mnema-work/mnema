// @reads-the-tree
/**
 * THE ARCHITECTURE PAGE IS WHAT THE CODE DRAWS, and every code link in its flows names what it points at.
 *
 * `docs/architecture.md` holds, between two markers, the package-to-package import graph that
 * `.github/the-architecture-page/graph.mjs` makes of the imports under `packages/*\/src`. A page
 * that differs from it is red; to redraw it, run the script.
 *
 * A link to a file that is not tracked, or an anchor past the end of its file, is accused by
 * `every-link-a-page-carries-lands.test.ts`, which reads this page like any other. What it cannot
 * say is that a line anchor still holds the function the link is labelled with, which is what a
 * line moved by an edit above it breaks, so it is asked here: a link whose text is a bare
 * identifier in code font must have that identifier on the line it points at. A link labelled
 * with a file name is not asked.
 *
 * AND THE GRAPH IS HELD AGAINST THE MANIFESTS: every import between two packages is one the
 * importer's `package.json` declares, and the layers have no ring.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
// @ts-expect-error plain ESM under .github/, run by hand to redraw the page and read here to hold it
import {
  BEGIN,
  blockOf,
  END,
  importGraph,
  layersOf,
  withBlock,
} from '../../../.github/the-architecture-page/graph.mjs';
import { ROOT } from './support/published-examples.js';

const PAGE = 'docs/architecture.md';
const page = readFileSync(join(ROOT, PAGE), 'utf-8');

interface Graph {
  packages: string[];
  edges: [string, string][];
}

describe('the architecture page', () => {
  const graph = importGraph(ROOT) as Graph;

  it('holds the import graph the script draws from the code', () => {
    expect(withBlock(page, blockOf(graph))).toBe(page);
  });

  it('is accused when its block is edited by hand, and when a marker is gone', () => {
    const edited = page.replace('code --> stacks', 'stacks --> code');
    expect(edited).not.toBe(page);
    expect(withBlock(edited, blockOf(graph))).toBe(page);
    expect(() => withBlock(page.replace(END, ''), blockOf(graph))).toThrow(/once each/);
    expect(page.split(BEGIN)).toHaveLength(2);
  });

  it('draws only imports the importing package declares, in layers with no ring', () => {
    for (const [from, to] of graph.edges) {
      const manifest = JSON.parse(
        readFileSync(join(ROOT, 'packages', from.replace('@mnema/', ''), 'package.json'), 'utf-8'),
      ) as { dependencies?: object; devDependencies?: object };
      const declared = Object.keys({ ...manifest.dependencies, ...manifest.devDependencies });
      expect(declared, `${from} imports ${to}`).toContain(to);
    }
    const layer = layersOf(graph) as Map<string, number>;
    for (const [from, to] of graph.edges) {
      expect(layer.get(from) as number, `${from} is above ${to}`).toBeGreaterThan(
        layer.get(to) as number,
      );
    }
  });

  it('has every anchored link on a line that holds the name it is labelled with', () => {
    const anchored = [...page.matchAll(/\[`([A-Za-z_]\w*)`\]\((\.\.\/[^)#]+)#L(\d+)\)/g)];
    expect(anchored.length).toBeGreaterThan(20);
    for (const [, name, path, line] of anchored) {
      const lines = readFileSync(join(ROOT, 'docs', path as string), 'utf-8').split('\n');
      expect(lines[Number(line) - 1], `${name} at ${path}#L${line}`).toContain(name as string);
    }
  });
});
