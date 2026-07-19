import assert from "node:assert/strict";
import { JobMonitorService } from "./job-monitor.service.js";

const monitor = new JobMonitorService();

monitor.registerJob({
  name: "sicredi_open_issued_sync",
  enabled: true,
  registered: false,
  intervalMs: 10_000,
});

let status = monitor.getStatus();
assert.equal(status.pid, process.pid);
assert.equal(status.jobs.length, 1);
assert.equal(status.jobs[0]?.registered, false);
assert.equal(status.jobs[0]?.tickCount, 0);
assert.equal(status.jobs[0]?.running, false);

monitor.markRegistered("sicredi_open_issued_sync", true);
monitor.recordTick("sicredi_open_issued_sync");
monitor.recordRunStarted("sicredi_open_issued_sync");

status = monitor.getStatus();
assert.equal(status.jobs[0]?.registered, true);
assert.equal(status.jobs[0]?.tickCount, 1);
assert.equal(status.jobs[0]?.running, true);
assert.ok(status.jobs[0]?.lastTickAt);
assert.ok(status.jobs[0]?.lastRunStartedAt);
assert.ok(status.jobs[0]?.nextRunEstimatedAt);

monitor.recordRunError(
  "sicredi_open_issued_sync",
  new Error("request failed token=secret-value"),
);

status = monitor.getStatus();
assert.equal(status.jobs[0]?.running, false);
assert.ok(status.jobs[0]?.lastRunFinishedAt);
assert.equal(status.jobs[0]?.lastError?.type, "Error");
assert.equal(status.jobs[0]?.lastError?.message.includes("secret-value"), false);
