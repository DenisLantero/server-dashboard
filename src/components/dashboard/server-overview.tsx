import { HostResourcePanel } from "./host-resource-panel";
import Link from "next/link";
import { ChevronRight, Server } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DashboardController } from "@/hooks/use-dashboard";
import { Feedback, ServerIcon, serverControls } from "./dashboard-shared";
import { ServerStatus } from "./server-status";
import { ServerActions } from "./server-actions";
export function ServerOverview({
  dashboard,
}: {
  dashboard: DashboardController;
}) {
  const { servers, connectionError, notice, setNotice, pending } = dashboard;
  const online = servers.filter(
    (item) => item.loaded && item.state === "active",
  ).length;
  const controls = serverControls(dashboard);
  return (
    <>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Server</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {connectionError
              ? "In attesa di connessione"
              : `${online} ${online === 1 ? "acceso" : "accesi"} su ${servers.length}`}
          </p>
        </div>
        <span className="text-xs text-muted-foreground">
          Aggiornamento ogni 4 s
        </span>
      </div>
      <HostResourcePanel />
      {servers.length ? (
        <div className="overflow-hidden rounded-xl border border-border bg-card/40">
          <div className="hidden grid-cols-[minmax(0,1fr)_190px_210px] gap-5 border-b border-border px-6 py-3 text-xs font-medium text-muted-foreground md:grid">
            <span>Server</span>
            <span>Stato</span>
            <span className="text-right">Azioni</span>
          </div>
          <ul className="divide-y divide-border">
            {servers.map((item) => (
              <li
                key={item.id}
                aria-label={item.name}
                className="px-4 py-5 sm:px-6"
              >
                <div className="grid items-center gap-x-5 gap-y-4 md:grid-cols-[minmax(0,1fr)_190px_210px]">
                  <Link
                    href={`/servers/${encodeURIComponent(item.id)}`}
                    className="group flex min-w-0 items-center gap-3 rounded-md focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    <ServerIcon id={item.id} />
                    <div className="min-w-0">
                      <h2 className="break-words text-base font-semibold group-hover:text-violet-300">
                        {item.name}
                      </h2>
                      <p className="mt-1 truncate text-sm text-muted-foreground">
                        {item.description}
                      </p>
                    </div>
                  </Link>
                  <ServerStatus
                    server={item}
                    stale={connectionError}
                    pending={
                      pending?.id === item.id ? pending.action : undefined
                    }
                  />
                  <div className="flex items-center justify-between gap-3 md:justify-end">
                    <ServerActions {...controls} server={item} />
                    <Button
                      asChild
                      variant="ghost"
                      className="h-10 text-muted-foreground"
                    >
                      <Link
                        href={`/servers/${encodeURIComponent(item.id)}`}
                        aria-label={`Apri ${item.name}`}
                      >
                        Apri
                        <ChevronRight className="size-4" />
                      </Link>
                    </Button>
                  </div>
                </div>
                {notice?.id === item.id && (
                  <div className="mt-2">
                    <Feedback notice={notice} dismiss={() => setNotice(null)} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border px-6 py-14">
          <Server className="mb-4 size-6 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Nessun server configurato</h2>
          <p className="mt-2 max-w-prose text-sm text-muted-foreground">
            Aggiungi le unità systemd al file servers.json per iniziare.
          </p>
        </div>
      )}
    </>
  );
}
