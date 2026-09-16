import {
  ArrowUpRight,
  Box,
  FileCode2,
  Gamepad2,
  LoaderCircle,
  Power,
  RotateCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import type { Action, ServerInfo } from "@/lib/types";
const states: Record<string, string> = {
  active: "Online",
  inactive: "Spento",
  failed: "Errore",
  activating: "Avvio in corso",
  deactivating: "Arresto in corso",
  reloading: "Ricaricamento",
};
type Props = {
  server: ServerInfo;
  pending: string | null;
  connectionError: boolean;
  onAction: (server: ServerInfo, action: Action) => Promise<void>;
  onConfirm: (server: ServerInfo, action: "stop" | "restart") => void;
  onOpenFile: (server: ServerInfo, file: number) => Promise<void>;
};
export function ServerCard({
  server,
  pending,
  connectionError,
  onAction,
  onConfirm,
  onOpenFile,
}: Props) {
  const active = server.state === "active";
  const stopped = ["inactive", "failed"].includes(server.state);
  const blocked = pending !== null || connectionError || !server.loaded;
  const Icon = server.id === "minecraft" ? Box : Gamepad2;
  return (
    <Card
      aria-labelledby={`server-${server.id}`}
      className="gap-0 overflow-hidden rounded-2xl border-white/[.08] py-0 shadow-none"
    >
      <div className="card-banner flex items-center justify-between border-b border-white/[.04] px-7 py-7">
        <div className="flex size-14 items-center justify-center rounded-2xl border border-violet-300/15 bg-violet-400/10 text-violet-300">
          <Icon className="size-7" strokeWidth={1.5} />
        </div>
        <Badge
          variant="outline"
          className={`gap-2 rounded-full px-3 py-1.5 text-xs font-normal ${active ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300" : server.state === "failed" ? "border-rose-500/20 bg-rose-500/10 text-rose-300" : "border-white/10 bg-black/20 text-zinc-400"}`}
        >
          <span
            className={`size-1.5 rounded-full ${active ? "bg-emerald-400" : "bg-current"}`}
          />
          {server.loaded
            ? states[server.state] || server.state
            : "Non disponibile"}
        </Badge>
      </div>
      <CardContent className="p-7">
        <h3
          id={`server-${server.id}`}
          className="break-words text-2xl font-semibold tracking-tight"
        >
          {server.name}
        </h3>
        <p className="mt-1.5 break-words text-sm text-muted-foreground">
          {server.description}
        </p>
        <div className="mt-7 flex gap-3">
          <Button
            className="h-11 flex-1"
            variant={active ? "secondary" : "default"}
            disabled={blocked || (!active && !stopped)}
            onClick={() =>
              active
                ? onConfirm(server, "stop")
                : void onAction(server, "start")
            }
          >
            {pending === server.id ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <Power className="size-4" />
            )}
            {active ? "Spegni server" : stopped ? "Accendi server" : "Attendi…"}
          </Button>
          <Button
            variant="outline"
            className="h-11 border-white/10 bg-transparent"
            disabled={blocked || !active}
            onClick={() => onConfirm(server, "restart")}
          >
            <RotateCw className="size-4" />
            <span className="hidden sm:inline">Riavvia</span>
            <span className="sr-only sm:hidden">Riavvia {server.name}</span>
          </Button>
        </div>
        <Separator className="my-7 bg-white/[.07]" />
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor={`auto-${server.id}`} className="block cursor-pointer">
            <span className="text-sm font-medium">Avvio automatico</span>
            <span className="mt-1.5 block text-xs font-normal text-muted-foreground">
              All’accensione del PC
            </span>
          </Label>
          <Switch
            id={`auto-${server.id}`}
            aria-label={`Avvio automatico ${server.name}`}
            checked={server.enabled}
            disabled={blocked || !server.canEnable}
            onCheckedChange={(enabled) =>
              void onAction(server, enabled ? "enable" : "disable")
            }
          />
        </div>
        <Separator className="my-7 bg-white/[.07]" />
        <div className="mb-3 flex items-center gap-2 text-[10px] font-medium tracking-[.15em] text-muted-foreground">
          <FileCode2 className="size-3.5" />
          CONFIGURAZIONE
        </div>
        <div className="space-y-1">
          {server.configs.length ? (
            server.configs.map((file, index) => (
              <Button
                key={index}
                variant="ghost"
                disabled={pending !== null || connectionError}
                className="h-auto min-h-10 w-full justify-between gap-2 px-0 py-2 text-left text-sm font-normal text-zinc-300 hover:bg-violet-500/5 hover:text-violet-300"
                onClick={() => void onOpenFile(server, index)}
              >
                <span className="min-w-0 break-all whitespace-normal">
                  {file}
                </span>
                <ArrowUpRight className="size-4 shrink-0 text-zinc-500" />
              </Button>
            ))
          ) : (
            <p className="text-xs text-muted-foreground">
              Nessun file configurato.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
