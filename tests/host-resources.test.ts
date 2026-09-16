import test from "node:test";
import assert from "node:assert/strict";
import type { CpuInfo } from "node:os";
import {
  cpuUsage,
  memoryUsage,
  readHostResources,
} from "../src/lib/host-resources";
const cpu = (user: number, idle: number): CpuInfo => ({
  model: "test",
  speed: 1000,
  times: { user, idle, nice: 0, sys: 0, irq: 0 },
});
test("CPU usage measures deltas across all cores, not lifetime utilization", () => {
  assert.equal(
    cpuUsage(
      [cpu(1000, 1000), cpu(500, 500)],
      [cpu(1025, 1075), cpu(525, 575)],
    ),
    25,
  );
  assert.equal(cpuUsage([cpu(1, 1)], [cpu(101, 1)]), 100);
  assert.equal(cpuUsage([cpu(1, 1)], [cpu(1, 101)]), 0);
  assert.equal(cpuUsage([], []), null);
  assert.equal(cpuUsage([cpu(1, 1)], [cpu(1, 1)]), null);
  assert.equal(cpuUsage([cpu(100, 100)], [cpu(0, 0)]), null);
  assert.equal(cpuUsage([cpu(1, 1)], [cpu(1, 1), cpu(1, 1)]), null);
});
test("RAM excludes reclaimable memory reported by MemAvailable", () => {
  assert.deepEqual(
    memoryUsage("MemTotal: 1000 kB\nMemFree: 100 kB\nMemAvailable: 400 kB\n"),
    { used: 600 * 1024, total: 1000 * 1024 },
  );
  assert.equal(memoryUsage("MemTotal: 1000 kB\n"), null);
  assert.equal(memoryUsage("MemTotal: 0 kB\nMemAvailable: 0 kB\n"), null);
  assert.equal(memoryUsage("MemTotal: 1 kB\nMemAvailable: 2 kB\n"), null);
});
test("concurrent viewers share a real host sample", async () => {
  const [first, second] = await Promise.all([
    readHostResources(),
    readHostResources(),
  ]);
  assert.strictEqual(first, second);
  assert.strictEqual(await readHostResources(), first);
  assert.ok(
    first.cpuPercent === null ||
      (first.cpuPercent >= 0 && first.cpuPercent <= 100),
  );
  assert.ok(first.uptimeSeconds >= 0);
  assert.ok(first.memory === null || first.memory.used <= first.memory.total);
});
