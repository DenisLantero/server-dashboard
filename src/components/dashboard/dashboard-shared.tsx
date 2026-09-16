import { Box, Gamepad2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Notice, DashboardController } from "@/hooks/use-dashboard";
import type { ServerInfo } from "@/lib/types";
export function Feedback({
  notice,
  dismiss,
}: {
  notice: Notice;
  dismiss: () => void;
}) {
  return (
    <div
      role={notice.error ? "alert" : "status"}
      className={`flex items-start gap-2 text-sm ${notice.error ? "text-rose-300" : "text-emerald-300"}`}
    >
      <p className="py-2">{notice.text}</p>
      <Button
        variant="ghost"
        size="icon"
        className="ml-auto shrink-0"
        aria-label="Chiudi messaggio"
        onClick={dismiss}
      >
        <X className="size-4" />
      </Button>
    </div>
  );
}
export function ServerIcon({ id }: { id: string }) {
  const Icon = id === "minecraft" ? Box : Gamepad2;
  return (
    <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border bg-muted/50 text-muted-foreground">
      <Icon className="size-5" strokeWidth={1.5} />
    </div>
  );
}

export function serverControls(dashboard: DashboardController) {
  return {
    pending: dashboard.pending,
    disabled:
      dashboard.connectionError || dashboard.saving || dashboard.fileBusy,
    onAction: dashboard.perform,
    onConfirm: (server: ServerInfo, action: "stop" | "restart") =>
      dashboard.setConfirmation({ server, action }),
  };
}
