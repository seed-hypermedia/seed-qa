import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/app",
  testMatch: "**/*.test.ts",
  timeout: 60_000,
  retries: 1,
  workers: 1,
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "reports/html" }],
    ["json", { outputFile: "reports/results.json" }],
  ],
  use: {
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    trace: "retain-on-failure",
  },
});
