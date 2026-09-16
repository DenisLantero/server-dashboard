import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

test("login, server cards, config editor, mobile layout and logout", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Il gioco parte da qui." }),
  ).toBeVisible();
  const directory =
    process.env.DASHBOARD_DATA_DIR ||
    join(homedir(), ".local/share/server-dashboard");
  const password = (await readFile(join(directory, "password"), "utf8")).trim();
  await page.getByLabel("Password della dashboard").fill(password);
  await page.getByRole("button", { name: "Accedi alla dashboard" }).click();
  await expect(
    page.getByRole("heading", { name: "I tuoi server." }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Minecraft", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Palworld", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("switch", { name: "Avvio automatico Minecraft" }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/dashboard-desktop.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "server.properties", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByLabel("Contenuto configurazione")).not.toHaveValue("");
  await expect(
    page.getByRole("button", { name: "Salva modifiche" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Chiudi", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("heading", { name: "Palworld", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/dashboard-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Esci", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Il gioco parte da qui." }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
