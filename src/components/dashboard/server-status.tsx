import {
  CircleCheck,
  CircleMinus,
  CircleAlert,
  LoaderCircle,
} from "lucide-react";
import { serverState } from "@/lib/server-state";
import type { Action, ServerInfo } from "@/lib/types";

export function ServerStatus({
  server,
  stale,
  pending,
}: {
  server: ServerInfo;
  stale?: boolean;
  pending?: Action;
}) {
  const state = serverState(server, stale, pending);
  const Icon =
    state.tone === "success"
      ? CircleCheck
      : state.tone === "error"
        ? CircleAlert
        : state.tone === "warning"
          ? LoaderCircle
          : CircleMinus;
  return (
    <span className={`server-status status-${state.tone}`}>
      <Icon aria-hidden="true" className="size-4 shrink-0" />
      {state.label}
    </span>
  );
}
