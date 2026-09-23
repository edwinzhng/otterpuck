import { availableParallelism } from "node:os";
import type { TrialJob, TrialReport } from "../src/match-trials";

// One full match takes about 1.3 s on one core. Trials share no state, so they
// run on one worker per core and return in job order.
const SIZE = Math.max(1, availableParallelism() - 1);
const workers = Array.from(
  { length: SIZE },
  (): Worker => new Worker(new URL("./trial-worker.ts", import.meta.url)),
);

export const runJobs = (jobs: readonly TrialJob[]): Promise<TrialReport[]> =>
  new Promise((resolve): void => {
    const reports: TrialReport[] = new Array(jobs.length);
    let next = 0;
    let done = 0;
    if (jobs.length === 0) resolve(reports);
    const feed = (worker: Worker): void => {
      if (next >= jobs.length) return;
      worker.postMessage({ index: next, job: jobs[next] });
      next += 1;
    };
    for (const worker of workers) {
      worker.onmessage = (
        event: MessageEvent<{ index: number; report: TrialReport }>,
      ): void => {
        reports[event.data.index] = event.data.report;
        done += 1;
        if (done === jobs.length) resolve(reports);
        else feed(worker);
      };
      feed(worker);
    }
  });

export const closePool = (): void => {
  for (const worker of workers) worker.terminate();
};
