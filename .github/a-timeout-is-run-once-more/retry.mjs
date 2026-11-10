/**
 * A CASE THAT ENDS ON ITS CEILING IS RUN ONCE MORE, IN CI, AND NOTHING ELSE IS.
 *
 * WHY. On the shared runner a case that takes 0.03 to 1.7 s has been seen stopped for 5.6 to
 * 9.9 s inside one run while the same case ran in under 1.1 s alone, with the machine reporting
 * one runnable thread: a pause of the process or of the disk, not work the case does. Any case
 * can be the victim, so a ceiling at each case cannot cover it.
 *
 * WHAT IT RETRIES. Only an error whose message BEGINS by saying the case or a hook timed out. A failed
 * assertion, a thrown error and a crash are red on the first attempt, as before. A case that
 * ends on its ceiling twice is red.
 *
 * WHERE. Only where `CI` is set, so nothing retries on a workstation. The flake sampler sets
 * `MNEMA_FIRST_ATTEMPT_ONLY`, because its job is the rate of first-attempt failures and a retry
 * would hide exactly what it counts.
 *
 * WHAT STAYS VISIBLE. The ledger (`.github/why-it-went-red/ledger.mjs`) records every case that
 * passed on a retry, and the page `verdict.mjs` writes names each one as a flake.
 */

/**
 * What the message of a timed-out case or hook says, ANCHORED: vitest writes `Test timed out in
 * 5000ms.` or `Hook timed out in 10000ms.` as the first words of the error, and a phrase merely
 * carried inside another message (an assertion that quotes what a child process said) is not one.
 */
export const A_TIMEOUT = /^(?:Test|Hook) timed out in \d+ms/;

/**
 * @param {Record<string, string | undefined>} env
 * @returns {0 | { count: number, condition: RegExp }}
 */
export function retryFor(env) {
  if (!env.CI || env.MNEMA_FIRST_ATTEMPT_ONLY) return 0;
  return { count: 1, condition: A_TIMEOUT };
}
