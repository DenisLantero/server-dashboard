"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, RequestError } from "@/lib/api-client";
import { actionCompleted, type PendingAction } from "@/lib/server-state";
import type { Action, ConfigFile, ServerInfo } from "@/lib/types";
import type { Editor } from "@/components/dashboard/config-editor";
export type Notice = { text: string; error: boolean; id?: string };
const message = (error: unknown) =>
  error instanceof Error ? error.message : "Connessione non disponibile.";
export function useDashboard() {
  const [servers, setServers] = useState<ServerInfo[]>([]);
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [loginBusy, setLoginBusy] = useState(false);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const waiting = useRef<(PendingAction & { deadline: number }) | null>(null);
  const requestVersion = useRef(0);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [loginError, setLoginError] = useState("");
  const [connectionError, setConnectionError] = useState(false);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [fileBusy, setFileBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editorError, setEditorError] = useState("");
  const [confirmation, setConfirmation] = useState<{
    server: ServerInfo;
    action: Action;
  } | null>(null);
  const refreshing = useRef(false);
  const dirty = editor !== null && editor.text !== editor.original;
  const notify = (text: string, error = false, id?: string) =>
    setNotice({ text, error, id });
  useEffect(() => {
    if (!notice || notice.error) return;
    const timer = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(timer);
  }, [notice]);
  const refresh = useCallback(async () => {
    if (refreshing.current) return;
    refreshing.current = true;
    const version = requestVersion.current;
    try {
      const data = await api<ServerInfo[]>("/api/servers");
      if (version !== requestVersion.current) return;
      setServers(data);
      const command = waiting.current;
      if (command) {
        const server = data.find((item) => item.id === command.id);
        if (server && actionCompleted(server, command.action)) {
          waiting.current = null;
          setPending(null);
          setNotice({
            id: command.id,
            error: false,
            text:
              command.action === "restart"
                ? "Riavvio richiesto."
                : "Operazione completata.",
          });
        } else if (Date.now() >= command.deadline) {
          waiting.current = null;
          setPending(null);
          setNotice({
            id: command.id,
            error: true,
            text: "Stato non confermato. Controlla i log prima di riprovare.",
          });
        }
      }
      setAuthenticated(true);
      setConnectionError(false);
    } catch (error) {
      if (version !== requestVersion.current) return;
      if (error instanceof RequestError && error.status === 401) {
        waiting.current = null;
        setPending(null);
        setConfirmation(null);
        setNotice(null);
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
    if (pending) return;
    requestVersion.current++;
    setPending({ id: server.id, action });
    setNotice(null);
    setConfirmation(null);
    try {
      await api("/api/action", { id: server.id, action });
      requestVersion.current++;
      waiting.current = { id: server.id, action, deadline: Date.now() + 20000 };
      await refresh();
    } catch (error) {
      setPending(null);
      waiting.current = null;
      notify(message(error), true, server.id);
    }
  }
  async function openFile(server: ServerInfo, file: number) {
    if (!canLeave()) return;
    setFileBusy(true);
    const version = requestVersion.current;
    try {
      const data = await api<ConfigFile>(
        `/api/config?id=${encodeURIComponent(server.id)}&file=${file}`,
      );
      if (version !== requestVersion.current) return;
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
      notify(message(error), true, server.id);
    } finally {
      setFileBusy(false);
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
      notify("Configurazione salvata. Backup creato.", false, editor.id);
    } catch (error) {
      setEditorError(message(error));
    } finally {
      setSaving(false);
    }
  }

  function canLeave() {
    return (
      !saving &&
      (!dirty || window.confirm("Uscire senza salvare le modifiche?"))
    );
  }
  async function login(event: React.FormEvent) {
    event.preventDefault();
    setLoginBusy(true);
    setLoginError("");
    try {
      await api("/api/login", { password });
      setPassword("");
      requestVersion.current++;
      await refresh();
    } catch (error) {
      setLoginError(message(error));
    } finally {
      setLoginBusy(false);
    }
  }
  async function logout() {
    if (!canLeave()) return;
    try {
      await api("/api/logout", {});
      requestVersion.current++;
      waiting.current = null;
      setPending(null);
      setAuthenticated(false);
      setServers([]);
      setEditor(null);
      setConfirmation(null);
      setNotice(null);
    } catch (error) {
      notify(message(error), true);
    }
  }
  return {
    servers,
    authenticated,
    password,
    setPassword,
    loginBusy,
    loginError,
    login,
    logout,
    pending,
    notice,
    setNotice,
    connectionError,
    refresh,
    editor,
    setEditor,
    fileBusy,
    saving,
    editorError,
    confirmation,
    setConfirmation,
    perform,
    openFile,
    closeEditor,
    saveFile,
    canLeave,
  };
}

export type DashboardController = ReturnType<typeof useDashboard>;
