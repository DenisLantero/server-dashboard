import { Play, Square, RotateCw, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Action, ServerInfo } from "@/lib/types";
import type { PendingAction } from "@/lib/server-state";

type Props = {
  server: ServerInfo;
  pending: PendingAction | null;
  disabled: boolean;
  onAction: (server: ServerInfo, action: Action) => Promise<void>;
  onConfirm: (server: ServerInfo, action: "stop" | "restart") => void;
  detail?: boolean;
};
export function ServerActions({
  server,
  pending,
  disabled,
  onAction,
  onConfirm,
  detail,
}: Props) {
  const active = server.state === "active";
  const stopped = ["inactive", "failed"].includes(server.state);
  const busy = pending?.id === server.id;
  const blocked = disabled || pending !== null || !server.loaded;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant={active ? "outline" : "default"}
        className="h-10 min-w-28"
        disabled={blocked || (!active && !stopped)}
        onClick={() =>
          active ? onConfirm(server, "stop") : void onAction(server, "start")
        }
      >
        {busy ? (
          <LoaderCircle className="size-4 animate-spin" />
        ) : active ? (
          <Square className="size-3.5" />
        ) : (
          <Play className="size-4" />
        )}
        {busy ? "Attendi…" : active ? "Arresta" : "Avvia"}
      </Button>
      {detail && (
        <Button
          variant="ghost"
          className="h-10"
          disabled={blocked || !active}
          onClick={() => onConfirm(server, "restart")}
        >
          <RotateCw className="size-4" />
          Riavvia
        </Button>
      )}
    </div>
  );
}
