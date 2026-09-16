import { test, expect, type Page } from "@playwright/test";
import type { ServerInfo } from "../src/lib/types";

async function mockDashboard(page: Page, servers?: ServerInfo[]) {
  const state = {
    authenticated: false,
    unavailable: false,
    conflict: false,
    logText: "2026-09-16T20:00:00+0200 Server ready\n",
    logStatus: 200,
    logRequests: 0,
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
  await page.getByRole("button", { name: "Accedi alla dashboard" }).click();
  await expect(
    page.getByRole("heading", { name: "I tuoi server." }),
  ).toBeVisible();
}

test("login errors, empty state and logout", async ({ page }) => {
  await mockDashboard(page, []);
  await page.goto("/");
  await page.getByLabel("Password della dashboard").fill("wrong");
  await page.getByRole("button", { name: "Accedi alla dashboard" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText(
    /Password errata/,
  );
  await login(page);
  await expect(page.getByText("Pronto per il tuo primo server")).toBeVisible();
  await page.getByRole("button", { name: "Esci", exact: true }).click();
  await expect(page.getByLabel("Password della dashboard")).toBeVisible();
});

test("server actions require confirmation and autostart is independent", async ({
  page,
}) => {
  const state = await mockDashboard(page);
  await login(page);
  await page.getByRole("switch").click();
  await expect(page.getByRole("switch")).toBeChecked();
  await expect(
    page.getByRole("button", { name: "Accendi server" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Accendi server" }).click();
  await expect(
    page.getByRole("button", { name: "Spegni server" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: /Riavvia/ }).click();
  await page.getByRole("button", { name: "Annulla", exact: true }).click();
  expect(state.actions.map((a) => a.action)).toEqual(["enable", "start"]);
  await page.getByRole("button", { name: /Riavvia/ }).click();
  await page.getByRole("button", { name: "Conferma", exact: true }).click();
  await expect.poll(() => state.actions.at(-1)?.action).toBe("restart");
  await page.getByRole("button", { name: "Spegni server" }).click();
  await page.getByRole("button", { name: "Conferma", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Accendi server" }),
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
  await page
    .getByRole("button", { name: "server.properties", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Salva modifiche" }),
  ).toBeDisabled();
  await page.getByLabel("Contenuto configurazione").fill("difficulty=hard\n");
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("button", { name: "Chiudi", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
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
  await expect(page.getByRole("dialog")).not.toBeVisible();
  expect(state.text).toBe("difficulty=hard\n");
});

test("running configuration is read-only and connection loss blocks controls", async ({
  page,
}) => {
  const state = await mockDashboard(page);
  state.servers[0].state = "active";
  await login(page);
  await page
    .getByRole("button", { name: "server.properties", exact: true })
    .click();
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
  await expect(
    page.getByRole("button", { name: "Spegni server" }),
  ).toBeDisabled();
  await expect(page.getByRole("switch")).toBeDisabled();
  state.unavailable = false;
  await expect(page.getByRole("button", { name: "Spegni server" })).toBeEnabled(
    { timeout: 10_000 },
  );
});

test("logs load on demand, refresh, pause and stop polling when closed", async ({
  page,
}) => {
  const state = await mockDashboard(page);
  await login(page);
  expect(state.logRequests).toBe(0);
  await page.getByRole("button", { name: "Log del server" }).click();
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
  await page.getByRole("button", { name: "Log del server" }).click();
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
  await page.getByRole("button", { name: "Log del server" }).click();
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
