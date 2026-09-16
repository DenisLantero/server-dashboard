"use client";

import { useEffect, useState } from "react";
import { RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { api, RequestError } from "@/lib/api-client";
import type { ServerLogs } from "@/lib/types";

type Props = { serverId: string; serverName: string };

export function ServerLogViewer({ serverId, serverName }: Props) {
  const [logs, setLogs] = useState<ServerLogs | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
  const [automatic, setAutomatic] = useState(true);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function load() {
      setBusy(true);
      let expired = false;
      try {
        const data = await api<ServerLogs>(
          `/api/logs?id=${encodeURIComponent(serverId)}`,
          undefined,
          controller.signal,
        );
        if (controller.signal.aborted) return;
        setLogs(data);
        setError("");
      } catch (error) {
        if (controller.signal.aborted) return;
        expired = error instanceof RequestError && error.status === 401;
        if (expired) setLogs(null);
        setError(
          error instanceof Error
            ? error.message
            : "Connessione non disponibile.",
        );
      } finally {
        if (!controller.signal.aborted) {
          setBusy(false);
          if (automatic && !expired)
            timer = setTimeout(() => void load(), 4000);
        }
      }
    }
    void load();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [serverId, automatic, refresh]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Switch
            id={`logs-auto-${serverId}`}
            checked={automatic}
            onCheckedChange={setAutomatic}
          />
          <Label htmlFor={`logs-auto-${serverId}`}>
            Aggiorna automaticamente
          </Label>
        </div>
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => setRefresh((value) => value + 1)}
        >
          <RotateCw className={`size-3.5 ${busy ? "animate-spin" : ""}`} />
          Aggiorna log
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Ultimi {logs?.limit ?? 200} eventi, dal meno al più recente.
        {automatic
          ? " Aggiornamento ogni 4 secondi."
          : " Aggiornamento automatico in pausa."}
      </p>
      {error && (
        <p role="alert" className="text-sm text-rose-300">
          {error}
          {logs ? " I log mostrati potrebbero non essere aggiornati." : ""}
        </p>
      )}
      {!logs && busy && (
        <p role="status" className="text-sm text-muted-foreground">
          Caricamento log…
        </p>
      )}
      {logs &&
        (logs.text ? (
          <pre
            aria-label={`Log di ${serverName}`}
            tabIndex={0}
            className="min-h-80 max-h-[60vh] overflow-auto rounded-md border border-border bg-card/50 p-4 sm:p-5 font-mono text-xs leading-5 whitespace-pre-wrap break-all focus-visible:outline-2 focus-visible:outline-ring"
          >
            {logs.text}
          </pre>
        ) : (
          <p role="status" className="text-sm text-muted-foreground">
            Nessun log visibile. Il servizio potrebbe non aver scritto nel
            journal, oppure l’utente della dashboard non ha accesso ai suoi
            eventi.
          </p>
        ))}
    </div>
  );
}
