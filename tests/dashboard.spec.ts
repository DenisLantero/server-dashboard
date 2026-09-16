import { test, expect, type Page } from "@playwright/test";
import type { ServerInfo } from "../src/lib/types";

async function mockDashboard(page: Page, servers?: ServerInfo[]) {
  const state = {
    authenticated: false,
    unavailable: false,
    conflict: false,
    actionError: false,
    delayState: false,
    logText: "2026-09-16T20:00:00+0200 Server ready\n",
    logStatus: 200,
    logRequests: 0,
    resourceRequests: 0,
    resourceStatus: 200,
    cpuPercent: 25,
    text: "difficulty=normal\n",
    actions: [] as { id: string; action: string }[],
    servers: servers ?? [
      {
        id: "minecraft",
        name: "Minecraft",
        description: "Server di test",
        unit: "minecraft.service",
        scope: "user",
        configs: ["server.properties"],
        state: "inactive",
        subState: "dead",
        enabled: false,
        canEnable: true,
        loaded: true,
      } satisfies ServerInfo,
    ],
  };
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const reply = (json: unknown, status = 200) =>
      route.fulfill({ json, status });
    if (path === "/api/login") {
      if (request.postDataJSON().password !== "test-password")
        return reply({ error: "Password errata." }, 401);
      state.authenticated = true;
      return reply({ ok: true });
    }
    if (!state.authenticated)
      return reply({ error: "Accedi alla dashboard." }, 401);
    if (path === "/api/logout") {
      state.authenticated = false;
      return reply({ ok: true });
    }
    if (path === "/api/servers")
      return state.unavailable
        ? reply({ error: "Non disponibile" }, 503)
        : reply(state.servers);
    if (path === "/api/resources") {
      state.resourceRequests++;
      return state.resourceStatus === 200
        ? reply({
            cpuPercent: state.cpuPercent,
            cpuCount: 8,
            memory: { used: 8 * 2 ** 30, total: 32 * 2 ** 30 },
            disk: { used: 100 * 2 ** 30, total: 500 * 2 ** 30 },
            uptimeSeconds: 90000,
          })
        : reply({ error: "Unavailable" }, state.resourceStatus);
    }
    if (path === "/api/logs") {
      state.logRequests++;
      expect(new URL(request.url()).searchParams.get("id")).toBe("minecraft");
      return state.logStatus === 200
        ? reply({ text: state.logText, limit: 200 })
        : reply({ error: "Log non disponibili." }, state.logStatus);
    }
    if (path === "/api/action") {
      const action = request.postDataJSON();
      state.actions.push(action);
      if (state.actionError)
        return reply({ error: "Comando non riuscito." }, 503);
      if (state.delayState) return reply({ ok: true });
      const server = state.servers.find((server) => server.id === action.id)!;
      if (action.action === "start" || action.action === "restart")
        server.state = "active";
      if (action.action === "stop") server.state = "inactive";
      if (action.action === "enable" || action.action === "disable")
        server.enabled = action.action === "enable";
      return reply({ ok: true });
    }
    if (path === "/api/config") {
      if (request.method() === "GET")
        return reply({
          text: state.text,
          revision: "revision-1",
          editable: state.servers[0].state === "inactive",
        });
      if (state.conflict)
        return reply(
          { error: "Il file è cambiato. Riaprilo prima di salvare." },
          409,
        );
      expect(request.postDataJSON()).toMatchObject({
        id: "minecraft",
        file: 0,
        revision: "revision-1",
      });
      state.text = request.postDataJSON().text;
      return reply({ ok: true });
    }
    return reply({ error: "Unexpected API request" }, 404);
  });
  return state;
}
async function login(page: Page) {
  await page.goto("/");
  await page.getByLabel("Password della dashboard").fill("test-password");
  await page.getByRole("button", { name: "Accedi", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Server", exact: true }),
  ).toBeVisible();
}

async function openDetail(page: Page) {
  await page.getByRole("link", { name: "Apri Minecraft", exact: true }).click();
  await expect(page).toHaveURL(/\/servers\/minecraft$/);
  await expect(
    page.getByRole("heading", { name: "Minecraft", exact: true }),
  ).toBeVisible();
}

test("login errors, empty state and logout", async ({ page }) => {
  await mockDashboard(page, []);
  await page.goto("/");
  await page.getByLabel("Password della dashboard").fill("wrong");
  await page.getByRole("button", { name: "Accedi", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText(
    /Password errata/,
  );
  await login(page);
  await expect(page.getByText("Nessun server configurato")).toBeVisible();
  await page.getByRole("button", { name: "Esci", exact: true }).click();
  await expect(page.getByLabel("Password della dashboard")).toBeVisible();
});

test("server actions require confirmation and autostart is independent", async ({
  page,
}) => {
  const state = await mockDashboard(page);
  await login(page);
  await openDetail(page);
  await page.getByRole("tab", { name: "Configurazione", exact: true }).click();
  await page.getByRole("switch", { name: "Avvio al boot Minecraft" }).click();
  await expect(
    page.getByRole("switch", { name: "Avvio al boot Minecraft" }),
  ).toBeChecked();
  await expect(
    page.getByRole("button", { name: "Avvia", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Avvia", exact: true }).click();
  await expect(page.getByRole("button", { name: "Arresta" })).toBeEnabled();
  await page.getByRole("button", { name: /Riavvia/ }).click();
  await page.getByRole("button", { name: "Annulla", exact: true }).click();
  expect(state.actions.map((a) => a.action)).toEqual(["enable", "start"]);
  await page.getByRole("button", { name: /Riavvia/ }).click();
  await page.getByRole("button", { name: "Conferma", exact: true }).click();
  await expect.poll(() => state.actions.at(-1)?.action).toBe("restart");
  await page.getByRole("button", { name: "Arresta" }).click();
  await page.getByRole("button", { name: "Conferma", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Avvia", exact: true }),
  ).toBeEnabled();
  expect(state.actions.at(-1)?.action).toBe("stop");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: test.info().outputPath("dashboard.png"),
    fullPage: true,
  });
});

test("editor preserves unsaved changes on conflict and saves with revision", async ({
  page,
}) => {
  const state = await mockDashboard(page);
  await login(page);
  await openDetail(page);
  await page.getByRole("tab", { name: "Configurazione", exact: true }).click();
  await page.getByRole("button", { name: /server.properties/ }).click();
  await expect(
    page.getByRole("button", { name: "Salva modifiche" }),
  ).toBeDisabled();
  await page.getByLabel("Contenuto configurazione").fill("difficulty=hard\n");
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("button", { name: "Chiudi", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Editor configurazione" }),
  ).toBeVisible();
  state.conflict = true;
  await page.getByRole("button", { name: "Salva modifiche" }).click();
  await expect(
    page.getByText("Il file è cambiato. Riaprilo prima di salvare."),
  ).toBeVisible();
  await expect(page.getByLabel("Contenuto configurazione")).toHaveValue(
    "difficulty=hard\n",
  );
  state.conflict = false;
  await page.getByRole("button", { name: "Salva modifiche" }).click();
  await expect(
    page.getByRole("region", { name: "Editor configurazione" }),
  ).not.toBeVisible();
  expect(state.text).toBe("difficulty=hard\n");
});

test("running configuration is read-only and connection loss blocks controls", async ({
  page,
}) => {
  const state = await mockDashboard(page);
  state.servers[0].state = "active";
  await login(page);
  await openDetail(page);
  await page.getByRole("tab", { name: "Configurazione", exact: true }).click();
  await page.getByRole("button", { name: /server.properties/ }).click();
  await expect(page.getByLabel("Contenuto configurazione")).toHaveAttribute(
    "readonly",
    "",
  );
  await expect(
    page.getByRole("button", { name: "Salva modifiche" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Chiudi", exact: true }).click();
  state.unavailable = true;
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Connessione non disponibile",
    { timeout: 10_000 },
  );
  await expect(page.getByRole("button", { name: "Arresta" })).toBeDisabled();
  await expect(page.getByRole("switch")).toBeDisabled();
  state.unavailable = false;
  await expect(page.getByRole("button", { name: "Arresta" })).toBeEnabled({
    timeout: 10_000,
  });
});

test("logs load on demand, refresh, pause and stop polling when closed", async ({
  page,
}) => {
  const state = await mockDashboard(page);
  await login(page);
  expect(state.logRequests).toBe(0);
  await openDetail(page);
  await expect(page.getByLabel("Log di Minecraft")).toContainText(
    "Server ready",
  );
  state.logText = "Player joined <script>alert('test')</script>";
  await expect(page.getByLabel("Log di Minecraft")).toHaveText(state.logText, {
    timeout: 10_000,
  });
  await page.getByRole("switch", { name: "Aggiorna automaticamente" }).click();
  await expect(
    page.getByRole("button", { name: "Aggiorna log", exact: true }),
  ).toBeEnabled();
  state.logText = "Manual refresh";
  await page.getByRole("button", { name: "Aggiorna log", exact: true }).click();
  await expect(page.getByLabel("Log di Minecraft")).toHaveText(
    "Manual refresh",
  );
  const count = state.logRequests;
  await page.waitForTimeout(4500);
  expect(state.logRequests).toBe(count);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: test.info().outputPath("logs.png"),
    fullPage: true,
  });
  await page.getByRole("switch", { name: "Aggiorna automaticamente" }).click();
  await expect(
    page.getByRole("button", { name: "Aggiorna log", exact: true }),
  ).toBeEnabled();
  await page.getByRole("link", { name: "Tutti i server", exact: true }).click();
  const closedCount = state.logRequests;
  await page.waitForTimeout(4500);
  expect(state.logRequests).toBe(closedCount);
  await expect(page.getByLabel("Log di Minecraft")).not.toBeVisible();
});

test("logs show empty, failed and expired-session states without stale content", async ({
  page,
}) => {
  const state = await mockDashboard(page);
  state.logText = "";
  await login(page);
  await openDetail(page);
  await expect(page.getByText(/Nessun log visibile/)).toBeVisible();
  state.logText = "Server ready";
  await page.getByRole("button", { name: "Aggiorna log", exact: true }).click();
  await expect(page.getByLabel("Log di Minecraft")).toHaveText("Server ready");
  state.logStatus = 503;
  await page.getByRole("button", { name: "Aggiorna log", exact: true }).click();
  await expect(page.getByText(/I log mostrati potrebbero/)).toBeVisible();
  await expect(page.getByLabel("Log di Minecraft")).toHaveText("Server ready");
  state.logStatus = 401;
  await page.getByRole("button", { name: "Aggiorna log", exact: true }).click();
  await expect(page.getByLabel("Log di Minecraft")).not.toBeVisible();
});

test("overview separates status from controls and routes to server details", async ({
  page,
}) => {
  const state = await mockDashboard(page);
  state.servers.push(
    {
      ...state.servers[0],
      id: "palworld",
      name: "Palworld",
      description: "Dedicated server",
      state: "active",
    },
    {
      ...state.servers[0],
      id: "valheim",
      name: "Valheim",
      description: "Mondo condiviso",
      state: "failed",
    },
    {
      ...state.servers[0],
      id: "terraria",
      name: "Terraria",
      description: "Sandbox",
      loaded: false,
    },
  );
  await login(page);
  await expect(
    page
      .getByRole("listitem", { name: "Minecraft", exact: true })
      .getByText("Spento", { exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("listitem", { name: "Palworld", exact: true })
      .getByText("Acceso", { exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("listitem", { name: "Valheim", exact: true })
      .getByText("In errore", { exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("listitem", { name: "Terraria", exact: true })
      .getByRole("button", { name: "Avvia", exact: true }),
  ).toBeDisabled();
  await expect(page.getByRole("switch")).toHaveCount(0);
  expect(state.logRequests).toBe(0);
  await page.screenshot({
    path: test.info().outputPath("overview.png"),
    fullPage: true,
  });
  await openDetail(page);
  await expect(page.getByLabel("Log di Minecraft")).toBeVisible();
  await page.screenshot({
    path: test.info().outputPath("detail.png"),
    fullPage: true,
  });
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Minecraft", exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Log", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("tab", { name: "Configurazione", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page.getByRole("link", { name: "Tutti i server", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
});

test("commands display progress until confirmed and success feedback expires", async ({
  page,
}) => {
  const state = await mockDashboard(page);
  state.delayState = true;
  await login(page);
  await page.getByRole("button", { name: "Avvia", exact: true }).click();
  await expect(page.getByText("Avvio in corso", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Attendi…", exact: true }),
  ).toBeDisabled();
  await expect(page.getByText("Acceso", { exact: true })).not.toBeVisible();
  state.servers[0].state = "active";
  await expect(page.getByText("Acceso", { exact: true })).toBeVisible({
    timeout: 10_000,
  });
  await expect(page.getByRole("listitem").getByRole("status")).toHaveText(
    /Operazione completata/,
  );
  await expect(
    page.getByText("Operazione completata.", { exact: true }),
  ).not.toBeVisible({ timeout: 8000 });
});

test("action failures stay beside the affected server and can be dismissed", async ({
  page,
}) => {
  const state = await mockDashboard(page);
  state.actionError = true;
  await login(page);
  await page.getByRole("button", { name: "Avvia", exact: true }).click();
  await expect(page.getByRole("listitem").getByRole("alert")).toContainText(
    "Comando non riuscito.",
  );
  await expect(page.getByText("Spento", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Chiudi messaggio" }).click();
  await expect(page.getByRole("listitem").getByRole("alert")).toHaveCount(0);
});

test("direct detail login, missing server and unsaved navigation guard", async ({
  page,
}) => {
  await mockDashboard(page);
  await page.goto("/servers/minecraft");
  await page.getByLabel("Password della dashboard").fill("test-password");
  await page.getByRole("button", { name: "Accedi", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Minecraft", exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Configurazione", exact: true }).click();
  await page.getByRole("button", { name: /server.properties/ }).click();
  await page.getByLabel("Contenuto configurazione").fill("changed");
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("tab", { name: "Log", exact: true }).click();
  await expect(page.getByLabel("Contenuto configurazione")).toHaveValue(
    "changed",
  );
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("link", { name: "Tutti i server", exact: true }).click();
  await expect(page).toHaveURL(/\/servers\/minecraft$/);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("link", { name: "Tutti i server", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/servers/missing");
  await expect(
    page.getByRole("heading", { name: "Server non trovato" }),
  ).toBeVisible();
});

test("unconfirmed command times out without falsely reporting success", async ({
  page,
}) => {
  await page.clock.install();
  const state = await mockDashboard(page);
  state.delayState = true;
  await login(page);
  await page.getByRole("button", { name: "Avvia", exact: true }).click();
  await expect.poll(() => state.actions.length).toBe(1);
  await expect(page.getByText("Avvio in corso", { exact: true })).toBeVisible();
  await page.clock.fastForward(25_000);
  await expect(page.getByRole("listitem").getByRole("alert")).toContainText(
    "Stato non confermato",
  );
  await expect(page.getByText("Spento", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Operazione completata.", { exact: true }),
  ).not.toBeVisible();
});

test("host resources refresh only in overview and recover from errors", async ({
  page,
}) => {
  const state = await mockDashboard(page);
  await login(page);
  const panel = page.getByRole("region", { name: "Risorse della macchina" });
  await expect(panel.getByText("25%", { exact: true })).toBeVisible();
  await expect(panel.getByText("8 / 32 GiB", { exact: true })).toBeVisible();
  await expect(panel.getByText("100 / 500 GiB", { exact: true })).toBeVisible();
  await expect(panel.getByText("1 g 1 h 0 min", { exact: true })).toBeVisible();
  state.resourceStatus = 503;
  await expect(panel.getByRole("status")).toContainText(
    "Metriche non disponibili",
    { timeout: 10_000 },
  );
  await expect(panel.getByText("25%", { exact: true })).not.toBeVisible();
  state.resourceStatus = 200;
  state.cpuPercent = 40;
  await expect(panel.getByText("40%", { exact: true })).toBeVisible({
    timeout: 10_000,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: test.info().outputPath("resources.png"),
    fullPage: true,
  });
  await openDetail(page);
  const count = state.resourceRequests;
  await page.waitForTimeout(4500);
  expect(state.resourceRequests).toBe(count);
  await expect(panel).not.toBeVisible();
});
