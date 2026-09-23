import { runJob, type TrialJob } from "../src/match-trials";

declare const self: Worker;

self.onmessage = (event: MessageEvent<{ index: number; job: TrialJob }>) => {
  self.postMessage({
    index: event.data.index,
    report: runJob(event.data.job),
  });
};
