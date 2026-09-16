import { useState } from "react";
import Link from "next/link";
import { Tabs } from "radix-ui";
import {
  ArrowLeft,
  ArrowUpRight,
  FileText,
  Settings2,
  Terminal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { DashboardController } from "@/hooks/use-dashboard";
import type { ServerInfo } from "@/lib/types";
import { Feedback, ServerIcon, serverControls } from "./dashboard-shared";
import { ServerStatus } from "./server-status";
import { ServerActions } from "./server-actions";
import { ServerLogViewer } from "./server-log-viewer";
import { ConfigEditor } from "./config-editor";

export function ServerDetail({
  dashboard,
  server,
}: {
  dashboard: DashboardController;
  server: ServerInfo;
}) {
  const [tab, setTab] = useState("logs");
  const { pending, connectionError, notice, setNotice } = dashboard;
  const controls = serverControls(dashboard);
  const guardNavigation = (event: React.MouseEvent) => {
    if (!dashboard.canLeave()) event.preventDefault();
  };
  return (
    <>
      <Link
        href="/"
        onClick={guardNavigation}
        className="mb-7 inline-flex min-h-10 items-center gap-2 rounded text-sm text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
      >
        <ArrowLeft className="size-4" />
        Tutti i server
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="flex min-w-0 items-start gap-4">
          <ServerIcon id={server.id} />
          <div className="min-w-0">
            <h1 className="break-words text-3xl font-semibold tracking-tight">
              {server.name}
            </h1>
            <p className="mt-2 max-w-prose break-words text-sm text-muted-foreground">
              {server.description}
            </p>
          </div>
        </div>
        <ServerActions {...controls} server={server} detail />
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        <ServerStatus
          server={server}
          stale={connectionError}
          pending={pending?.id === server.id ? pending.action : undefined}
        />
        <span className="break-all font-mono text-xs text-muted-foreground">
          {server.unit}
        </span>
      </div>
      <div className="mt-3 min-h-10">
        {notice?.id === server.id && (
          <Feedback notice={notice} dismiss={() => setNotice(null)} />
        )}
      </div>
      <Tabs.Root
        value={tab}
        onValueChange={(value) => {
          if (dashboard.canLeave()) {
            dashboard.setEditor(null);
            setTab(value);
          }
        }}
      >
        <Tabs.List
          aria-label="Sezioni del server"
          className="mb-6 flex gap-6 border-b border-border"
        >
          <Tabs.Trigger value="logs" className="server-tab">
            <Terminal className="size-4" />
            Log
          </Tabs.Trigger>
          <Tabs.Trigger value="settings" className="server-tab">
            <Settings2 className="size-4" />
            Configurazione
          </Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content
          value="logs"
          className="focus-visible:outline-2 focus-visible:outline-ring"
        >
          <ServerLogViewer serverId={server.id} serverName={server.name} />
        </Tabs.Content>
        <Tabs.Content
          value="settings"
          className="space-y-9 focus-visible:outline-2 focus-visible:outline-ring"
        >
          <section className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-7">
            <div>
              <Label
                htmlFor={`auto-${server.id}`}
                className="text-base font-medium"
              >
                Avvio al boot
              </Label>
              <p className="mt-1 text-sm text-muted-foreground">
                Avvia il server all’accensione di Ubuntu.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">
                {server.enabled ? "Abilitato" : "Disabilitato"}
              </span>
              <Switch
                id={`auto-${server.id}`}
                aria-label={`Avvio al boot ${server.name}`}
                checked={server.enabled}
                disabled={
                  controls.disabled ||
                  pending !== null ||
                  !server.loaded ||
                  !server.canEnable
                }
                onCheckedChange={(enabled) =>
                  void dashboard.perform(server, enabled ? "enable" : "disable")
                }
              />
            </div>
            {!server.canEnable && (
              <p className="w-full text-xs text-muted-foreground">
                L’avvio al boot non è modificabile per questa unità.
              </p>
            )}
          </section>
          <section>
            <h2 className="text-lg font-semibold">File di configurazione</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Modifica a server spento. Il backup viene creato a ogni
              salvataggio.
            </p>
            <div className="mt-5 divide-y divide-border border-y border-border">
              {server.configs.map((file, index) => (
                <Button
                  key={index}
                  variant="ghost"
                  disabled={controls.disabled || pending !== null}
                  onClick={() => void dashboard.openFile(server, index)}
                  className="h-auto min-h-14 w-full justify-start gap-3 rounded-none px-2 text-left font-normal"
                >
                  <FileText className="size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 break-all whitespace-normal">
                    {file}
                  </span>
                  <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                    Apri
                  </span>
                  <ArrowUpRight className="size-4" />
                </Button>
              ))}
            </div>
            {!server.configs.length && (
              <p className="py-6 text-sm text-muted-foreground">
                Nessun file configurato per questo server.
              </p>
            )}
            {dashboard.fileBusy && (
              <p role="status" className="mt-3 text-sm text-muted-foreground">
                Apertura file…
              </p>
            )}
            <ConfigEditor
              editor={dashboard.editor}
              saving={dashboard.saving}
              error={dashboard.editorError}
              onClose={dashboard.closeEditor}
              onSave={dashboard.saveFile}
              onChange={(text) =>
                dashboard.setEditor((current) =>
                  current ? { ...current, text } : null,
                )
              }
            />
          </section>
        </Tabs.Content>
      </Tabs.Root>
    </>
  );
}
