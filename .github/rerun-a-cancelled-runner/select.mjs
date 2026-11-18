// A RUNNER THAT WAS TAKEN AWAY, RERUN ONCE. A job of `windows and macos` that ends `cancelled` with
// no step of the workflow having run to a result is the runner's loss (the macOS and Windows pools
// shut a machine down under a queued job), not a verdict about the code. `rerun-a-cancelled-runner.yml`
// hands `rerun.mjs` the run that just ended; it asks this module which jobs to rerun and reruns them, each through the
// rerun-one-job endpoint of the API.
//
// WHAT IT NEVER RERUNS:
//   - a second attempt: one rerun, never a loop;
//   - a failure, and a cancelled job any of whose steps ran to a result (success or failure): that
//     is the code or the job, and the red stays;
//   - a run in which something other than these jobs was cancelled: that is a newer push cancelling
//     the run (the concurrency group does it), and a rerun of an old run would cancel the new one;
//   - a run that is no longer the newest of its branch, for the same reason.
//
// The steps GitHub adds itself (`Set up job`, `Complete job`, `Post ...`) are not the workflow's
// and do not count as a step that ran.

const THE_JOBS = /^windows and macos \(/;
const NOT_THE_WORKFLOWS = /^(?:Set up job|Complete job|Post )/;

/** @typedef {{ name: string, conclusion: string | null }} Step */
/** @typedef {{ id: number, name: string, conclusion: string | null, steps?: readonly Step[] }} Job */

/**
 * Whether any step of the workflow's own ended with a result of its own.
 * @param {Job} job
 */
function aStepRan(job) {
  return (job.steps ?? []).some(
    (step) =>
      !NOT_THE_WORKFLOWS.test(step.name) &&
      (step.conclusion === 'success' || step.conclusion === 'failure'),
  );
}

/**
 * @param {{ jobs: readonly Job[], attempt: number, runId: number, newestRunId: number }} run
 * @returns {number[]} the ids of the jobs to rerun
 */
export function jobsToRerun({ jobs, attempt, runId, newestRunId }) {
  if (attempt !== 1 || runId !== newestRunId) return [];
  const cancelled = jobs.filter((job) => job.conclusion === 'cancelled');
  if (cancelled.length === 0 || !cancelled.every((job) => THE_JOBS.test(job.name))) return [];
  return cancelled.filter((job) => !aStepRan(job)).map((job) => job.id);
}
