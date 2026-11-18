// THE STEP OF `rerun-a-cancelled-runner.yml`: reads the event file GitHub wrote for the run that just
// ended, asks the API for its jobs and for the newest run of its branch, hands them to `jobsToRerun`
// (the rules, and what it never reruns, are in its header) and reruns each job it returns, once.
//
// IT RUNS NOTHING OF THE RUN IT READS. The jobs are data; every call is `gh` with an argument list
// (no shell), and what reaches an argument is a number the API gave or the repository's own name.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { jobsToRerun } from './select.mjs';

const [eventFile = ''] = process.argv.slice(2);
const repository = process.env.GITHUB_REPOSITORY ?? '';
if (!/^[\w.-]+\/[\w.-]+$/.test(repository)) throw new Error('no repository');

/** @param {string[]} args */
const gh = (args) => execFileSync('gh', ['api', ...args], { encoding: 'utf-8' });

const { workflow_run: run } = JSON.parse(readFileSync(eventFile, 'utf-8'));
const attempt = Number(run.run_attempt);
const runId = Number(run.id);
if (!Number.isInteger(attempt) || !Number.isInteger(runId)) throw new Error('no run');

const jobs = gh([
  '--paginate',
  `repos/${repository}/actions/runs/${runId}/attempts/${attempt}/jobs?per_page=100`,
  '--jq',
  '.jobs[] | tojson',
])
  .split('\n')
  .filter(Boolean)
  .map((line) => JSON.parse(line));

const newestRunId = Number(
  gh([
    '-X',
    'GET',
    `repos/${repository}/actions/workflows/ci.yml/runs`,
    '-f',
    `branch=${String(run.head_branch)}`,
    '-f',
    `event=${String(run.event)}`,
    '-f',
    'per_page=1',
    '--jq',
    '.workflow_runs[0].id',
  ]).trim(),
);

const ids = jobsToRerun({ jobs, attempt, runId, newestRunId });
for (const id of ids) {
  console.log(`rerunning job ${id}`);
  gh(['-X', 'POST', `repos/${repository}/actions/jobs/${Number(id)}/rerun`]);
}
if (ids.length === 0) console.log('nothing to rerun');
