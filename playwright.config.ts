import { defineConfig } from "@playwright/test";

const testConfigured = Boolean(
  process.env.DATABASE_URL &&
  process.env.E2E_SUPERADMIN_EMAIL &&
  process.env.E2E_SUPERADMIN_PASSWORD &&
  process.env.TAFRIHBAN_TEST_OTP_SINK === "1",
);
const baseURL = process.env.E2E_BASE_URL || "http://127.0.0.1:3000";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 180_000,
  expect: { timeout: 20_000 },
  reporter: "list",
  use: {
    baseURL,
    browserName: "chromium",
    trace: "off",
  },
  ...(testConfigured && !process.env.E2E_BASE_URL ? {
    webServer: {
      command: "npm.cmd run dev -- --hostname 127.0.0.1",
      url: baseURL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  } : {}),
});
