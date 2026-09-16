"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpRight,
  Box,
  Check,
  ChevronRight,
  Circle,
  FileCode2,
  Gamepad2,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  Power,
  Radio,
  RotateCw,
  Server,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import type { Action, ConfigFile, ServerInfo } from "@/lib/types";

class RequestError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
async function api<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(path, {
    cache: "no-store",
    ...(body === undefined
      ? {}
      : {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Dashboard": "1" },
          body: JSON.stringify(body),
        }),
  });
  const data = await response.json();
  if (!response.ok)
    throw new RequestError(
      data.error || "Operazione non riuscita.",
      response.status,
    );
  return data;
}
const states: Record<string, string> = {
  active: "Online",
  inactive: "Spento",
  failed: "Errore",
  activating: "Avvio in corso",
  deactivating: "Arresto in corso",
  reloading: "Ricaricamento",
};
const message = (error: unknown) =>
  error instanceof Error ? error.message : "Connessione non disponibile.";
type Editor = ConfigFile & {
  id: string;
  file: number;
  name: string;
  serverName: string;
  original: string;
};

export default function Dashboard() {
  const [servers, setServers] = useState<ServerInfo[]>([]);
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [loginBusy, setLoginBusy] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(
    null,
  );
  const [connectionError, setConnectionError] = useState(false);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [saving, setSaving] = useState(false);
  const [editorError, setEditorError] = useState("");
  const [confirmation, setConfirmation] = useState<{
    server: ServerInfo;
    action: Action;
  } | null>(null);
  const refreshing = useRef(false);
  const dirty = editor !== null && editor.text !== editor.original;
  const notify = (text: string, error = false) => setNotice({ text, error });
  const refresh = useCallback(async () => {
    if (refreshing.current) return;
    refreshing.current = true;
    try {
      const data = await api<ServerInfo[]>("/api/servers");
      setServers(data);
      setAuthenticated(true);
      setConnectionError(false);
    } catch (error) {
      if (error instanceof RequestError && error.status === 401) {
        setAuthenticated(false);
        setServers([]);
        setEditor(null);
      } else {
        setConnectionError(true);
      }
    } finally {
      refreshing.current = false;
    }
  }, []);
  useEffect(() => {
    const initial = setTimeout(() => void refresh(), 0);
    const interval = setInterval(() => void refresh(), 4000);
    return () => {
      clearTimeout(initial);
      clearInterval(interval);
    };
  }, [refresh]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  async function perform(server: ServerInfo, action: Action) {
    setPending(server.id);
    setConfirmation(null);
    try {
      await api("/api/action", { id: server.id, action });
      notify(
        action === "enable"
          ? `${server.name} si avvierà all’accensione del PC.`
          : action === "disable"
            ? `Avvio automatico disabilitato per ${server.name}.`
            : `Comando inviato a ${server.name}. Lo stato si aggiornerà tra pochi secondi.`,
      );
      await refresh();
    } catch (error) {
      notify(message(error), true);
    } finally {
      setPending(null);
    }
  }
  async function openFile(server: ServerInfo, file: number) {
    setPending(server.id);
    try {
      const data = await api<ConfigFile>(
        `/api/config?id=${encodeURIComponent(server.id)}&file=${file}`,
      );
      setEditor({
        ...data,
        id: server.id,
        file,
        name: server.configs[file],
        serverName: server.name,
        original: data.text,
      });
      setEditorError("");
    } catch (error) {
      notify(message(error), true);
    } finally {
      setPending(null);
    }
  }
  function closeEditor() {
    if (saving) return;
    if (dirty && !window.confirm("Chiudere senza salvare le modifiche?"))
      return;
    setEditor(null);
  }
  async function saveFile() {
    if (!editor) return;
    setSaving(true);
    setEditorError("");
    try {
      await api("/api/config", {
        id: editor.id,
        file: editor.file,
        text: editor.text,
        revision: editor.revision,
      });
      setEditor(null);
      notify("Configurazione salvata. Copia di backup creata.");
    } catch (error) {
      setEditorError(message(error));
    } finally {
      setSaving(false);
    }
  }
  const online = servers.filter((s) => s.state === "active").length;
  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b border-white/[.06]">
        <div className="mx-auto flex h-20 max-w-6xl items-center justify-between px-5 sm:px-8">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl border border-violet-400/20 bg-violet-500/15 text-violet-400">
              <Server className="size-5" />
            </div>
            <span className="text-lg font-semibold tracking-tight">
              server<span className="font-normal text-violet-400">space</span>
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Badge
              variant="outline"
              className="hidden gap-2 rounded-full border-white/10 px-3 py-1.5 text-xs font-normal text-muted-foreground sm:flex"
            >
              <span className="size-1.5 rounded-full bg-violet-400" />
              Il tuo spazio di gioco
            </Badge>
            {authenticated && (
              <Button
                variant="ghost"
                size="icon"
                aria-label="Esci"
                onClick={async () => {
                  if (dirty && !window.confirm("Uscire senza salvare?")) return;
                  try {
                    await api("/api/logout", {});
                    setAuthenticated(false);
                    setServers([]);
                    setEditor(null);
                    setNotice(null);
                  } catch (error) {
                    notify(message(error), true);
                  }
                }}
              >
                <LogOut className="size-4" />
              </Button>
            )}
          </div>
        </div>
      </nav>
      <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
        {connectionError && (
          <div
            role="alert"
            className="mb-6 rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-200"
          >
            Connessione non disponibile. I controlli saranno riattivati al
            prossimo aggiornamento riuscito.
          </div>
        )}
        {notice && (
          <div
            role="status"
            className={`mb-6 flex items-center justify-between gap-4 rounded-xl border p-4 text-sm ${notice.error ? "border-rose-500/20 bg-rose-500/10 text-rose-200" : "border-violet-500/20 bg-violet-500/10 text-violet-200"}`}
          >
            <span>{notice.text}</span>
            <Button
              size="icon"
              variant="ghost"
              aria-label="Chiudi messaggio"
              onClick={() => setNotice(null)}
            >
              <X className="size-4" />
            </Button>
          </div>
        )}
        {authenticated === null ? (
          <div className="flex min-h-80 items-center justify-center gap-3 text-muted-foreground">
            <LoaderCircle className="size-5 animate-spin" />
            Connessione alla dashboard…
          </div>
        ) : !authenticated ? (
          <div className="mx-auto max-w-md pt-8 sm:pt-16">
            <div className="mb-8 text-center">
              <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-2xl border border-violet-500/30 bg-violet-500/10 text-violet-400">
                <Gamepad2 className="size-8" />
              </div>
              <h1 className="text-3xl font-semibold tracking-tight">
                Il gioco parte da qui.
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                I tuoi server, un solo posto.
                <br />
                Accedi per prendere il controllo.
              </p>
            </div>
            <Card className="border-white/[.08] bg-card shadow-2xl shadow-violet-950/10">
              <CardContent className="p-6">
                <form
                  onSubmit={async (event) => {
                    event.preventDefault();
                    setLoginBusy(true);
                    try {
                      await api("/api/login", { password });
                      setPassword("");
                      setNotice(null);
                      await refresh();
                    } catch (error) {
                      notify(message(error), true);
                    } finally {
                      setLoginBusy(false);
                    }
                  }}
                >
                  <Label htmlFor="password" className="mb-3">
                    Password della dashboard
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="h-11 bg-background"
                    placeholder="Inserisci la tua password"
                  />
                  <Button
                    type="submit"
                    className="mt-5 h-11 w-full"
                    disabled={loginBusy}
                  >
                    {loginBusy ? (
                      <LoaderCircle className="size-4 animate-spin" />
                    ) : (
                      <LockKeyhole className="size-4" />
                    )}
                    Accedi alla dashboard
                    <ChevronRight className="ml-auto size-4" />
                  </Button>
                </form>
              </CardContent>
            </Card>
            <p className="mt-5 flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="size-3.5" />
              Accesso personale · Connessione cifrata
            </p>
          </div>
        ) : (
          <>
            <div className="mb-10 flex flex-wrap items-end justify-between gap-6">
              <div>
                <p className="mb-3 flex items-center gap-2 text-xs font-medium tracking-[.15em] text-violet-400">
                  <Radio className="size-3.5" />
                  CENTRO DI CONTROLLO
                </p>
                <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
                  I tuoi server<span className="text-violet-400">.</span>
                </h1>
                <p className="mt-4 text-sm text-muted-foreground sm:text-base">
                  Accendi un mondo. Il resto è a portata di clic.
                </p>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-white/[.08] bg-card px-4 py-2.5 text-xs text-muted-foreground">
                <span
                  className={`size-2 rounded-full ${online ? "bg-emerald-400" : "bg-zinc-500"}`}
                />
                <span className="font-medium text-foreground">{online}</span>
                online<span className="px-1 text-zinc-700">/</span>
                {servers.length} configurati
              </div>
            </div>
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-sm font-medium">
                Tutti i server{" "}
                <span className="ml-2 rounded-md bg-white/5 px-2 py-0.5 text-xs text-muted-foreground">
                  {servers.length}
                </span>
              </h2>
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                <RotateCw className="size-3" />
                Aggiornamento automatico
              </span>
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              {servers.map((server) => {
                const active = server.state === "active";
                const stopped = ["inactive", "failed"].includes(server.state);
                const blocked =
                  pending !== null || connectionError || !server.loaded;
                const Icon = server.id === "minecraft" ? Box : Gamepad2;
                return (
                  <Card
                    key={server.id}
                    className="server-card gap-0 overflow-hidden rounded-2xl border-white/[.08] py-0 shadow-none"
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
                      <h3 className="text-2xl font-semibold tracking-tight">
                        {server.name}
                      </h3>
                      <p className="mt-1.5 text-sm text-muted-foreground">
                        {server.description}
                      </p>
                      <div className="mt-7 flex gap-3">
                        <Button
                          className="h-11 flex-1"
                          variant={active ? "secondary" : "default"}
                          disabled={blocked || (!active && !stopped)}
                          onClick={() =>
                            active
                              ? setConfirmation({ server, action: "stop" })
                              : void perform(server, "start")
                          }
                        >
                          {pending === server.id ? (
                            <LoaderCircle className="size-4 animate-spin" />
                          ) : (
                            <Power className="size-4" />
                          )}
                          {active
                            ? "Spegni server"
                            : stopped
                              ? "Accendi server"
                              : "Attendi…"}
                        </Button>
                        <Button
                          variant="outline"
                          className="h-11 border-white/10 bg-transparent"
                          disabled={blocked || !active}
                          onClick={() =>
                            setConfirmation({ server, action: "restart" })
                          }
                        >
                          <RotateCw className="size-4" />
                          <span className="hidden sm:inline">Riavvia</span>
                          <span className="sr-only sm:hidden">
                            Riavvia {server.name}
                          </span>
                        </Button>
                      </div>
                      <Separator className="my-7 bg-white/[.07]" />
                      <div className="flex items-center justify-between gap-4">
                        <Label
                          htmlFor={`auto-${server.id}`}
                          className="block cursor-pointer"
                        >
                          <span className="text-sm font-medium">
                            Avvio automatico
                          </span>
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
                            void perform(server, enabled ? "enable" : "disable")
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
                              onClick={() => void openFile(server, index)}
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
              })}
            </div>
            {!servers.length && (
              <Card className="border-dashed p-10 text-center">
                <Server className="mx-auto mb-4 size-8 text-violet-400" />
                <h3 className="font-medium">Pronto per il tuo primo server</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Aggiungi i servizi al file servers.json della dashboard.
                </p>
              </Card>
            )}
            <div className="mt-8 flex items-start gap-3 rounded-xl border border-violet-400/10 bg-violet-400/[.03] px-5 py-4">
              <Sparkles className="mt-0.5 size-4 shrink-0 text-violet-400" />
              <p className="text-xs leading-relaxed text-muted-foreground">
                Le configurazioni si modificano a server spento. A ogni
                salvataggio, una copia di backup conserva la versione
                precedente.
              </p>
            </div>
            <footer className="mt-9 flex flex-wrap items-center justify-between gap-3 text-[11px] text-zinc-500">
              <span>Il tuo PC. I tuoi mondi.</span>
              <span className="flex items-center gap-1.5">
                <Circle className="size-2 fill-violet-400 text-violet-400" />
                Serverspace
              </span>
            </footer>
          </>
        )}
      </main>
      <Dialog
        open={editor !== null}
        onOpenChange={(open) => {
          if (!open) closeEditor();
        }}
      >
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <p className="mb-2 text-xs text-violet-400">
              {editor?.serverName} / Configurazione
            </p>
            <DialogTitle className="break-all pr-5">{editor?.name}</DialogTitle>
            <DialogDescription>
              {editor?.editable
                ? "Salva le modifiche e avvia il server per applicarle. La versione precedente viene conservata in un backup."
                : "Il server è acceso o sta cambiando stato. Spegnilo e riapri il file per modificarlo."}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            aria-label="Contenuto configurazione"
            spellCheck={false}
            readOnly={!editor?.editable || saving}
            value={editor?.text || ""}
            onChange={(event) =>
              setEditor((current) =>
                current ? { ...current, text: event.target.value } : null,
              )
            }
            className="h-[45dvh] min-h-64 resize-y overflow-auto bg-background font-mono text-xs leading-6 whitespace-pre"
          />
          <p role="status" className="text-sm text-rose-300">
            {editorError}
          </p>
          <DialogFooter className="items-center gap-3">
            <span className="mr-auto flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="size-3.5" />
              Backup automatico
            </span>
            <Button variant="outline" disabled={saving} onClick={closeEditor}>
              Chiudi
            </Button>
            <Button
              disabled={!editor?.editable || saving || !dirty}
              onClick={() => void saveFile()}
            >
              {saving ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <ArrowDownToLine className="size-4" />
              )}
              Salva modifiche
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={confirmation !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmation(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmation?.action === "stop" ? "Spegnere" : "Riavviare"}{" "}
              {confirmation?.server.name}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              I giocatori connessi verranno disconnessi. Il server riceverà il
              comando di{" "}
              {confirmation?.action === "stop" ? "arresto" : "riavvio"}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmation)
                  void perform(confirmation.server, confirmation.action);
              }}
            >
              <Check className="size-4" />
              Conferma
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
