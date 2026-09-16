"use client";

import { useEffect, useState } from "react";
import { api, RequestError } from "@/lib/api-client";
import type { Capacity, HostResources } from "@/lib/types";

const decimal = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 1 });
function capacity(value: Capacity | null) {
  if (!value) return "Non disponibile";
  return `${decimal.format(value.used / 2 ** 30)} / ${decimal.format(value.total / 2 ** 30)} GiB`;
}
function UsageMeter({
  label,
  used,
  total,
}: {
  label: string;
  used: number;
  total: number;
}) {
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={used}
      aria-valuetext={`${decimal.format((used / total) * 100)}%`}
      className="h-1.5 overflow-hidden rounded-full bg-muted"
    >
      <div
        className="h-full rounded-full bg-violet-400"
        style={{
          width: `${Math.min(100, Math.max(0, (used / total) * 100))}%`,
        }}
      />
    </div>
  );
}
function CapacityMetric({
  name,
  value,
}: {
  name: string;
  value: Capacity | null;
}) {
  return (
    <div className="min-w-0 space-y-2">
      <dt className="text-xs text-muted-foreground">{name}</dt>
      <dd className="text-sm font-medium tabular-nums">{capacity(value)}</dd>
      {value && (
        <UsageMeter label={name} used={value.used} total={value.total} />
      )}
    </div>
  );
}
export function HostResourcePanel() {
  const [resources, setResources] = useState<HostResources | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function refresh() {
      let expired = false;
      try {
        const value = await api<HostResources>(
          "/api/resources",
          undefined,
          AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]),
        );
        if (controller.signal.aborted) return;
        setResources(value);
        setError(false);
      } catch (error) {
        if (controller.signal.aborted) return;
        expired = error instanceof RequestError && error.status === 401;
        setResources(null);
        setError(true);
      } finally {
        if (!controller.signal.aborted && !expired)
          timer = setTimeout(() => void refresh(), 4000);
      }
    }
    void refresh();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, []);
  const days = resources ? Math.floor(resources.uptimeSeconds / 86400) : 0;
  const hours = resources ? Math.floor(resources.uptimeSeconds / 3600) % 24 : 0;
  const minutes = resources ? Math.floor(resources.uptimeSeconds / 60) % 60 : 0;
  return (
    <section
      aria-label="Risorse della macchina"
      className="mb-8 border-y border-border py-5"
    >
      <h2 className="mb-4 text-sm font-medium">Risorse della macchina</h2>
      {resources ? (
        <dl className="grid grid-cols-2 gap-x-8 gap-y-6 md:grid-cols-4">
          <div className="space-y-2">
            <dt className="text-xs text-muted-foreground">
              CPU · {resources.cpuCount} core logici
            </dt>
            <dd className="text-sm font-medium tabular-nums">
              {resources.cpuPercent === null
                ? "Non disponibile"
                : `${decimal.format(resources.cpuPercent)}%`}
            </dd>
            {resources.cpuPercent !== null && (
              <UsageMeter label="CPU" used={resources.cpuPercent} total={100} />
            )}
          </div>
          <CapacityMetric name="RAM utilizzata" value={resources.memory} />
          <CapacityMetric name="Disco / occupato" value={resources.disk} />
          <div className="space-y-2">
            <dt className="text-xs text-muted-foreground">Tempo dall’avvio</dt>
            <dd className="text-sm font-medium tabular-nums">
              {days > 0 ? `${days} g ` : ""}
              {hours} h {minutes} min
            </dd>
          </div>
        </dl>
      ) : (
        <p role="status" className="min-h-14 text-sm text-muted-foreground">
          {error
            ? "Metriche non disponibili. Nuovo tentativo al prossimo aggiornamento."
            : "Lettura delle risorse…"}
        </p>
      )}
    </section>
  );
}
