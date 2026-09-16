import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.spec.ts",
  workers: 1,
  use: {
    baseURL: process.env.DASHBOARD_URL || "https://127.0.0.1:9080",
    ignoreHTTPSErrors: true,
    browserName: "chromium",
  },
});
