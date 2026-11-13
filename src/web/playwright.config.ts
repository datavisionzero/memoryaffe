import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  workers: 1,
  retries: 0,
  timeout: 60000,
  use: {
    baseURL: process.env.WEB_URL || "http://127.0.0.1:5173",
    headless: true,
    trace: "off",
    screenshot: "only-on-failure",
  },
  webServer: process.env.WEB_URL
    ? undefined
    : {
        command: "npm run dev -- --port 5173",
        url: "http://127.0.0.1:5173",
        reuseExistingServer: true,
      },
});
