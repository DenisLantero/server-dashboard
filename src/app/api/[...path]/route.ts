import { NextRequest, NextResponse } from "next/server";
import { randomBytes, timingSafeEqual, createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  ApiError,
  control,
  dataDir,
  definitions,
  inspect,
  readConfig,
  writeConfig,
} from "@/lib/control";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const sessions = new Map<string, number>();
let failures: number[] = [];
function json(value: unknown, status = 200) {
  return NextResponse.json(value, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
function authenticated(request: NextRequest) {
  const token = request.cookies.get("dashboard-session")?.value || "";
  if ((sessions.get(token) || 0) <= Date.now())
    throw new ApiError("Accedi alla dashboard.", 401);
}
async function body(request: NextRequest) {
  if (
    request.headers.get("X-Dashboard") !== "1" ||
    request.headers.get("Content-Type")?.split(";")[0].trim().toLowerCase() !==
      "application/json"
  )
    throw new ApiError("Richiesta non valida.", 403);
  const origin = request.headers.get("Origin");
  if (origin && origin !== `https://${request.headers.get("Host")}`)
    throw new ApiError("Origine non valida.", 403);
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError("Richiesta vuota.");
  let length = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > 1250000) {
      await reader.cancel();
      throw new ApiError("Richiesta troppo grande.", 413);
    }
    chunks.push(value);
  }
  let value: unknown;
  try {
    value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new ApiError("JSON non valido.");
  }
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new ApiError("Richiesta non valida.");
  return value as Record<string, unknown>;
}
function errorResponse(error: unknown) {
  if (error instanceof ApiError)
    return json({ error: error.message }, error.status);
  console.error(
    "Dashboard request failed:",
    error instanceof Error ? error.message : "Unknown error",
  );
  return json(
    {
      error:
        "Operazione non riuscita. Controlla i file configurati e i permessi della dashboard.",
    },
    500,
  );
}
export async function GET(request: NextRequest) {
  try {
    authenticated(request);
    if (request.nextUrl.pathname === "/api/servers")
      return json(await Promise.all((await definitions()).map(inspect)));
    if (request.nextUrl.pathname === "/api/config") {
      const index = request.nextUrl.searchParams.get("file");
      if (index === null || !/^\d+$/.test(index))
        throw new ApiError("File non valido.");
      return json(
        await readConfig(request.nextUrl.searchParams.get("id"), Number(index)),
      );
    }
    return json({ error: "Non trovato." }, 404);
  } catch (error) {
    return errorResponse(error);
  }
}
export async function POST(request: NextRequest) {
  try {
    const data = await body(request);
    const path = request.nextUrl.pathname;
    if (path === "/api/login") {
      failures = failures.filter((t) => t > Date.now() - 60000);
      if (failures.length >= 15)
        throw new ApiError("Troppi tentativi. Riprova tra un minuto.", 429);
      const password = (
        await readFile(join(dataDir(), "password"), "utf8")
      ).trim();
      const hash = (text: string) => createHash("sha256").update(text).digest();
      if (
        !password ||
        typeof data.password !== "string" ||
        !timingSafeEqual(hash(password), hash(data.password))
      ) {
        failures.push(Date.now());
        throw new ApiError("Password errata.", 401);
      }
      for (const [key, expires] of sessions)
        if (expires <= Date.now()) sessions.delete(key);
      if (sessions.size >= 100) sessions.delete(sessions.keys().next().value!);
      const token = randomBytes(32).toString("hex");
      sessions.set(token, Date.now() + 12 * 3600000);
      const response = json({ ok: true });
      response.cookies.set("dashboard-session", token, {
        httpOnly: true,
        secure: true,
        sameSite: "strict",
        path: "/",
        maxAge: 43200,
      });
      return response;
    }
    authenticated(request);
    if (path === "/api/logout") {
      sessions.delete(request.cookies.get("dashboard-session")?.value || "");
      const response = json({ ok: true });
      response.cookies.set("dashboard-session", "", {
        httpOnly: true,
        secure: true,
        sameSite: "strict",
        path: "/",
        maxAge: 0,
      });
      return response;
    }
    if (path === "/api/action") await control(data.id, data.action);
    else if (path === "/api/config")
      await writeConfig(data.id, data.file, data.text, data.revision);
    else return json({ error: "Non trovato." }, 404);
    return json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
