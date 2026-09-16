import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { homedir } from "node:os";
import { basename, isAbsolute, join } from "node:path";
import { createHash, randomBytes } from "node:crypto";
import {
  readFile,
  mkdir,
  open,
  rename,
  unlink,
  stat,
  realpath,
} from "node:fs/promises";
import type { Action, ServerInfo } from "./types";

export const dataDir = () =>
  process.env.DASHBOARD_DATA_DIR ||
  join(homedir(), ".local/share/server-dashboard");
const exec = promisify(execFile);
type Definition = Pick<
  ServerInfo,
  "id" | "name" | "description" | "unit" | "scope" | "configs"
>;
export class ApiError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export async function definitions(): Promise<Definition[]> {
  const data = JSON.parse(
    await readFile(join(dataDir(), "servers.json"), "utf8"),
  );
  if (!Array.isArray(data))
    throw new ApiError("Elenco server non valido.", 500);
  const ids = new Set<string>();
  return data.map((s) => {
    if (
      !s ||
      !/^[a-z0-9_-]+$/.test(s.id) ||
      ids.has(s.id) ||
      typeof s.name !== "string" ||
      !/^[a-zA-Z0-9_.@:-]+\.service$/.test(s.unit) ||
      s.unit.startsWith("-") ||
      !Array.isArray(s.configs) ||
      !s.configs.every(
        (p: unknown) => typeof p === "string" && isAbsolute(p),
      ) ||
      (s.scope && !["user", "system"].includes(s.scope))
    )
      throw new ApiError("Definizione server non valida.", 500);
    ids.add(s.id);
    return {
      id: s.id,
      name: s.name,
      description: s.description || "Server dedicato",
      unit: s.unit,
      configs: s.configs,
      scope: s.scope || "user",
    };
  });
}
export async function findServer(id: unknown) {
  const server = (await definitions()).find((s) => s.id === id);
  if (!server) throw new ApiError("Server non configurato.", 404);
  return server;
}
async function systemctl(server: Definition, ...args: string[]) {
  try {
    const { stdout } = await exec(
      "systemctl",
      [...(server.scope === "user" ? ["--user"] : []), ...args, server.unit],
      {
        timeout: 15000,
        maxBuffer: 1024 * 1024,
        env: { ...process.env, LC_ALL: "C" },
      },
    );
    return stdout;
  } catch {
    throw new ApiError(
      "Systemd non ha completato il comando. Controlla i permessi e lo stato del servizio.",
      503,
    );
  }
}
export async function inspect(server: Definition): Promise<ServerInfo> {
  const output = await systemctl(
    server,
    "show",
    "--property=ActiveState,SubState,UnitFileState,LoadState",
  );
  const props = Object.fromEntries(
    output
      .trim()
      .split("\n")
      .filter((l) => l.includes("="))
      .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
  );
  return {
    ...server,
    configs: server.configs.map((p) => basename(p)),
    state: props.ActiveState,
    subState: props.SubState,
    enabled: props.UnitFileState === "enabled",
    canEnable: [
      "enabled",
      "disabled",
      "enabled-runtime",
      "linked",
      "linked-runtime",
    ].includes(props.UnitFileState),
    loaded: props.LoadState === "loaded",
  };
}
// Serialize all dashboard mutations, including config writes and queued start requests.
let queue: Promise<unknown> = Promise.resolve();
export function exclusive<T>(operation: () => Promise<T>): Promise<T> {
  const result = queue.then(operation);
  queue = result.catch(() => undefined);
  return result;
}
export async function control(id: unknown, action: unknown) {
  const allowed: Action[] = ["start", "stop", "restart", "enable", "disable"];
  if (!allowed.includes(action as Action))
    throw new ApiError("Azione non valida.");
  return exclusive(async () => {
    const server = await findServer(id);
    const info = await inspect(server);
    if (!info.loaded) throw new ApiError("Servizio non disponibile.");
    if (["enable", "disable"].includes(String(action)) && !info.canEnable)
      throw new ApiError(
        "Avvio automatico non modificabile per questo servizio.",
      );
    await systemctl(server, "--no-block", action as Action);
  });
}
const digest = (value: Buffer) =>
  createHash("sha256").update(value).digest("hex");
async function configPath(server: Definition, index: unknown) {
  if (
    !Number.isInteger(index) ||
    Number(index) < 0 ||
    Number(index) >= server.configs.length
  )
    throw new ApiError("File non configurato.", 404);
  return realpath(server.configs[Number(index)]);
}
async function bytes(path: string) {
  if ((await stat(path)).size > 200000)
    throw new ApiError("Il file supera il limite di 200 KB.");
  return readFile(path);
}
export async function readConfig(id: unknown, index: unknown) {
  const server = await findServer(id);
  const data = await bytes(await configPath(server, index));
  const info = await inspect(server);
  return {
    text: new TextDecoder("utf-8", { fatal: true }).decode(data),
    revision: digest(data),
    editable: ["inactive", "failed"].includes(info.state),
  };
}
export async function writeConfig(
  id: unknown,
  index: unknown,
  text: unknown,
  revision: unknown,
) {
  if (
    typeof text !== "string" ||
    Buffer.byteLength(text) > 200000 ||
    text.includes("\0")
  )
    throw new ApiError("Contenuto non valido o troppo grande.");
  return exclusive(async () => {
    const server = await findServer(id);
    if (!["inactive", "failed"].includes((await inspect(server)).state))
      throw new ApiError(
        "Spegni il server prima di salvare la configurazione.",
        409,
      );
    const path = await configPath(server, index);
    const previous = await bytes(path);
    if (digest(previous) !== revision)
      throw new ApiError("Il file è cambiato. Riaprilo prima di salvare.", 409);
    const backupDir = join(dataDir(), "backups", server.id);
    await mkdir(backupDir, { recursive: true, mode: 0o700 });
    const stamp =
      new Date().toISOString().replaceAll(":", "-") +
      "-" +
      randomBytes(4).toString("hex");
    const backup = await open(
      join(backupDir, `${basename(path)}.${stamp}.bak`),
      "wx",
      0o600,
    );
    try {
      await backup.writeFile(previous);
      await backup.sync();
    } finally {
      await backup.close();
    }
    const temporary = path + ".dashboard-" + randomBytes(8).toString("hex");
    try {
      const file = await open(temporary, "wx", (await stat(path)).mode & 0o777);
      try {
        await file.writeFile(text, "utf8");
        await file.sync();
      } finally {
        await file.close();
      }
      // Catch external edits that occurred while the backup was being written.
      if (digest(await bytes(path)) !== revision)
        throw new ApiError("Il file è cambiato durante il salvataggio.", 409);
      await rename(temporary, path);
    } finally {
      await unlink(temporary).catch(() => undefined);
    }
  });
}
