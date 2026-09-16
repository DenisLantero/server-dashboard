"use client";

import Link from "next/link";
import { LogOut, Server } from "lucide-react";
import { useDashboard, type DashboardController } from "@/hooks/use-dashboard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Feedback } from "./dashboard-shared";
import { ServerDetail } from "./server-detail";
import { ServerOverview } from "./server-overview";

type Controller = DashboardController;

export function Dashboard({ serverId }: { serverId?: string }) {
  const dashboard = useDashboard();
  const {
    servers,
    authenticated,
    connectionError,
    notice,
    setNotice,
    pending,
  } = dashboard;
  const server = servers.find((item) => item.id === serverId);
  const guardNavigation = (event: React.MouseEvent) => {
    if (!dashboard.canLeave()) event.preventDefault();
  };
  return (
    <div className="min-h-screen">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:z-50 focus:bg-background focus:p-4"
      >
        Vai al contenuto
      </a>
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5 sm:px-8">
          <Link
            href="/"
            onClick={guardNavigation}
            className="flex items-center gap-2.5 rounded-md font-semibold tracking-tight focus-visible:outline-2 focus-visible:outline-ring"
            aria-label="Serverspace, tutti i server"
          >
            <Server className="size-5 text-violet-400" />
            serverspace
          </Link>
          {authenticated && (
            <Button
              variant="ghost"
              className="h-10 text-muted-foreground"
              onClick={() => void dashboard.logout()}
            >
              <LogOut className="size-4" />
              Esci
            </Button>
          )}
        </div>
      </header>
      <main id="main" className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-12">
        {connectionError && (
          <div
            role="alert"
            className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-400/25 bg-amber-400/5 px-4 py-3 text-sm text-amber-200"
          >
            <span>
              Connessione non disponibile. Gli stati potrebbero non essere
              aggiornati.
            </span>
            <Button
              variant="outline"
              className="h-9"
              onClick={() => void dashboard.refresh()}
            >
              Riprova
            </Button>
          </div>
        )}
        {notice && !notice.id && (
          <Feedback notice={notice} dismiss={() => setNotice(null)} />
        )}
        {authenticated === null ? (
          <div role="status" className="space-y-4 py-6">
            <span className="text-sm text-muted-foreground">
              Caricamento server…
            </span>
            <div className="h-24 animate-pulse rounded-lg bg-muted/60" />
            <div className="h-24 animate-pulse rounded-lg bg-muted/40" />
          </div>
        ) : !authenticated ? (
          <Login dashboard={dashboard} />
        ) : serverId ? (
          server ? (
            <ServerDetail dashboard={dashboard} server={server} />
          ) : (
            <div className="py-12">
              <h1 className="text-2xl font-semibold">Server non trovato</h1>
              <p className="mt-2 text-muted-foreground">
                Il server non è più presente nella configurazione.
              </p>
              <Button asChild variant="outline" className="mt-6 h-10">
                <Link href="/">Torna ai server</Link>
              </Button>
            </div>
          )
        ) : (
          <ServerOverview dashboard={dashboard} />
        )}
      </main>
      <AlertDialog
        open={dashboard.confirmation !== null}
        onOpenChange={(open) => {
          if (!open) dashboard.setConfirmation(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {dashboard.confirmation?.action === "stop"
                ? "Arrestare"
                : "Riavviare"}{" "}
              {dashboard.confirmation?.server.name}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              I giocatori connessi verranno disconnessi.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending !== null || connectionError}
              onClick={() => {
                if (dashboard.confirmation)
                  void dashboard.perform(
                    dashboard.confirmation.server,
                    dashboard.confirmation.action,
                  );
              }}
            >
              Conferma
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Login({ dashboard }: { dashboard: Controller }) {
  return (
    <section className="mx-auto max-w-sm py-12 sm:py-20">
      <h1 className="text-2xl font-semibold tracking-tight">
        Accedi a Serverspace
      </h1>
      <form onSubmit={dashboard.login} className="mt-8 space-y-5">
        <div className="space-y-2">
          <Label htmlFor="password">Password della dashboard</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={dashboard.password}
            onChange={(event) => dashboard.setPassword(event.target.value)}
            className="h-11"
          />
        </div>
        {dashboard.loginError && (
          <p role="alert" className="text-sm text-rose-300">
            {dashboard.loginError}
          </p>
        )}
        <Button
          type="submit"
          className="h-11 w-full"
          disabled={dashboard.loginBusy}
        >
          {dashboard.loginBusy ? "Accesso…" : "Accedi"}
        </Button>
      </form>
    </section>
  );
}
