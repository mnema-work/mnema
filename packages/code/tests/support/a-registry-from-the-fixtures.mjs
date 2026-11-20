// Preloaded into the BUILT binary (`node --import <this file>`): replaces `fetch` with a stand-in that
// answers the registry's two URLs from the recorded fixtures and appends each URL it was asked to
// the file `$MNEMA_TEST_ASKED_LOG`. No byte reaches a network.
import { appendFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const fixtures = process.env.MNEMA_TEST_FIXTURES ?? '';
globalThis.fetch = async (url, init) => {
  appendFileSync(
    process.env.MNEMA_TEST_ASKED_LOG ?? '/dev/null',
    `${url} redirect=${init?.redirect ?? ''}\n`,
  );
  const text = String(url);
  const version = text.endsWith('/latest') ? '0.1.8' : text.slice(text.lastIndexOf('@') + 1);
  const name = text.endsWith('/latest') ? `version-${version}.json` : `attestations-${version}.json`;
  return new Response(readFileSync(join(fixtures, name), 'utf-8'), { status: 200 });
};
