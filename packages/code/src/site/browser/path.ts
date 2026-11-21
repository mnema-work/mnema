/** The part of `node:path` the verifier reads with: POSIX paths over the files the page carries. */

export function join(...parts: string[]): string {
  const kept: string[] = [];
  for (const segment of parts.join('/').split('/')) {
    if (segment === '' || segment === '.') continue;
    if (segment === '..') kept.pop();
    else kept.push(segment);
  }
  const joined = kept.join('/');
  return parts[0]?.startsWith('/') ? `/${joined}` : joined;
}

export function dirname(path: string): string {
  const cut = path.lastIndexOf('/');
  if (cut < 0) return '.';
  return cut === 0 ? '/' : path.slice(0, cut);
}

export function basename(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1);
}

/** The separator of the paths the page carries. */
export const sep = '/';

export function isAbsolute(path: string): boolean {
  return path.startsWith('/');
}

/** The paths joined from the last absolute one, as `node:path` resolves them; the page has no working directory but `/`. */
export function resolve(...parts: string[]): string {
  let from = 0;
  for (let i = parts.length - 1; i >= 0; i -= 1) {
    if ((parts[i] as string).startsWith('/')) {
      from = i;
      break;
    }
  }
  return join('/', ...parts.slice(from));
}

export function relative(): never {
  throw new Error('relative is not available in the browser verifier');
}
