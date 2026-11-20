/**
 * THE SILENT CATCHES OF A SOURCE FILE, found the way `codeOnly` reads code.
 *
 * A catch is SILENT when its body neither rethrows (no `throw`) nor uses the error it caught (no
 * binding, or a binding the body never names): the cause is dropped and the body goes on, usually
 * to return a value. A catch that binds the error and reads it (a code, a message, a record of it)
 * is not silent, and neither is one that throws. The comment inside a catch is not a way out: the
 * study this rests on found every one of its 57 comment-only catches carried a reason and the
 * count still grew by 19 in a week, so the convention held without a machine and the count rose
 * all the same.
 *
 * The reading is lexical on purpose (the same scanner as every other guard here): a `throw` inside
 * a function declared in the body counts as the body's, which can only make a catch look less
 * silent, never more.
 */

import { codeOnly } from './reading-source.js';

/** One silent catch: where it is, and what its body does with comments and strings gone. */
export interface SilentCatch {
  /** 1-based line of the `catch` keyword. */
  readonly line: number;
  /** The body as code, whitespace collapsed: `''` for `catch {}`, `return undefined;`, and so on. */
  readonly body: string;
}

const CATCH = /\bcatch\s*(?:\(\s*([A-Za-z_$][\w$]*)[^)]*\)\s*)?\{/g;

export function silentCatches(source: string): SilentCatch[] {
  const code = codeOnly(source);
  const found: SilentCatch[] = [];
  for (const match of code.matchAll(CATCH)) {
    const open = (match.index ?? 0) + match[0].length - 1;
    let depth = 0;
    let close = -1;
    for (let at = open; at < code.length; at += 1) {
      const char = code[at];
      if (char === '{') depth += 1;
      else if (char === '}') {
        depth -= 1;
        if (depth === 0) {
          close = at;
          break;
        }
      }
    }
    if (close < 0) continue;
    const body = code.slice(open + 1, close);
    const binding = match[1];
    const rethrows = /\bthrow\b/.test(body);
    const usesTheError =
      binding !== undefined &&
      new RegExp(`(?<![\\w$.])${binding.replace(/\$/g, '\\$')}(?![\\w$])`).test(body);
    if (rethrows || usesTheError) continue;
    found.push({
      line: code.slice(0, match.index ?? 0).split('\n').length,
      body: body.replace(/\s+/g, ' ').trim(),
    });
  }
  return found;
}
