import type { Action, ServerInfo } from "./types";

export type PendingAction = { id: string; action: Action };
export function serverState(
  server: ServerInfo,
  stale = false,
  pending?: Action,
) {
  if (stale) return { label: "Stato non aggiornato", tone: "warning" } as const;
  if (!server.loaded)
    return { label: "Non disponibile", tone: "muted" } as const;
  if (pending === "start")
    return { label: "Avvio in corso", tone: "warning" } as const;
  if (pending === "stop")
    return { label: "Arresto in corso", tone: "warning" } as const;
  if (pending === "restart")
    return { label: "Riavvio richiesto", tone: "warning" } as const;
  switch (server.state) {
    case "active":
      return { label: "Acceso", tone: "success" } as const;
    case "inactive":
      return { label: "Spento", tone: "muted" } as const;
    case "failed":
      return { label: "In errore", tone: "error" } as const;
    case "activating":
      return { label: "Avvio in corso", tone: "warning" } as const;
    case "deactivating":
      return { label: "Arresto in corso", tone: "warning" } as const;
    case "reloading":
      return { label: "Ricaricamento", tone: "warning" } as const;
    default:
      return { label: "Stato sconosciuto", tone: "warning" } as const;
  }
}

export function actionCompleted(server: ServerInfo, action: Action) {
  switch (action) {
    case "start":
      return server.state === "active";
    case "stop":
      return server.state === "inactive" || server.state === "failed";
    case "enable":
      return server.enabled;
    case "disable":
      return !server.enabled;
    // A restart may complete between polls. Only acknowledge the request.
    case "restart":
      return true;
  }
}
