import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { ApiError, findServer } from "./control";
import type { ServerLogs } from "./types";

const exec = promisify(execFile);

export async function readLogs(id: unknown): Promise<ServerLogs> {
  const server = await findServer(id);
  try {
    // Unit names come exclusively from validated server definitions, never the request.
    const { stdout } = await exec(
      "journalctl",
      [
        server.scope === "user"
          ? `--user-unit=${server.unit}`
          : `--unit=${server.unit}`,
        "--no-pager",
        "--quiet",
        "--lines=200",
        "--output=short-iso",
      ],
      {
        timeout: 10_000,
        maxBuffer: 1024 * 1024,
        env: {
          ...process.env,
          LC_ALL: "C",
          SYSTEMD_COLORS: "0",
          SYSTEMD_URLIFY: "0",
        },
      },
    );
    return { text: stdout, limit: 200 };
  } catch {
    throw new ApiError(
      "Log non disponibili. Controlla i permessi di lettura del journal; la richiesta potrebbe aver superato i limiti di tempo o dimensione.",
      503,
    );
  }
}
