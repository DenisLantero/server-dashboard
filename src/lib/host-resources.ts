import { cpus, uptime, type CpuInfo } from "node:os";
import { readFile, statfs } from "node:fs/promises";
import { setTimeout } from "node:timers/promises";
import type { Capacity, HostResources } from "./types";

export function cpuUsage(before: CpuInfo[], after: CpuInfo[]): number | null {
  if (!before.length || before.length !== after.length) return null;
  let total = 0;
  let idle = 0;
  for (let index = 0; index < before.length; index++) {
    const previous = before[index].times;
    const current = after[index].times;
    for (const key of ["user", "nice", "sys", "idle", "irq"] as const) {
      const delta = current[key] - previous[key];
      if (delta < 0) return null;
      total += delta;
      if (key === "idle") idle += delta;
    }
  }
  return total > 0 ? Math.round(((total - idle) / total) * 1000) / 10 : null;
}

export function memoryUsage(meminfo: string): Capacity | null {
  const fields = Object.fromEntries(
    [...meminfo.matchAll(/^(MemTotal|MemAvailable):\s+(\d+)\s+kB$/gm)].map(
      (match) => [match[1], Number(match[2]) * 1024],
    ),
  );
  if (
    !Number.isFinite(fields.MemTotal) ||
    fields.MemTotal <= 0 ||
    !Number.isFinite(fields.MemAvailable) ||
    fields.MemAvailable > fields.MemTotal
  )
    return null;
  return {
    total: fields.MemTotal,
    used: fields.MemTotal - fields.MemAvailable,
  };
}

async function sample(): Promise<HostResources> {
  const before = cpus();
  const [memory, disk] = await Promise.all([
    readFile("/proc/meminfo", "utf8")
      .then(memoryUsage)
      .catch(() => null),
    statfs("/")
      .then((stat) =>
        stat.blocks > 0
          ? {
              total: stat.blocks * stat.bsize,
              used: (stat.blocks - stat.bfree) * stat.bsize,
            }
          : null,
      )
      .catch(() => null),
    setTimeout(250),
  ]);
  const after = cpus();
  return {
    cpuPercent: cpuUsage(before, after),
    cpuCount: after.length,
    memory,
    disk,
    uptimeSeconds: uptime(),
  };
}

// One bounded sample shared by concurrent viewers; no background timer.
let cached: { value: HostResources; expires: number } | undefined;
let inFlight: Promise<HostResources> | undefined;
export function readHostResources(): Promise<HostResources> {
  if (cached && cached.expires > Date.now())
    return Promise.resolve(cached.value);
  if (!inFlight) {
    inFlight = sample()
      .then((value) => {
        cached = { value, expires: Date.now() + 3000 };
        return value;
      })
      .finally(() => {
        inFlight = undefined;
      });
  }
  return inFlight;
}
