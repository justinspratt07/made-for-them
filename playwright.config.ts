import { readFileSync } from "node:fs";
import { defineConfig } from "@playwright/test";

const fixture = JSON.parse(readFileSync(".preview-runtime.json", "utf8"));
const hosted = fixture.env.GIFT_DATA_SOURCE === "postgres";
export default defineConfig({
  testDir: "./tests/preview", workers: 1, fullyParallel: false,
  timeout: 60_000, reporter: [["list"], ["html", { open: "never" }]],
  use: { baseURL: fixture.env.ADMIN_ORIGIN,
    extraHTTPHeaders: { [fixture.env.ADMIN_CLIENT_IP_HEADER]: "192.0.2.50" },
    trace: "off", screenshot: "only-on-failure",
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?
      { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {},
  },
  webServer: {
    command: fixture.env.RENDER === "true" ? "node scripts/render-start.mjs" :
      `node node_modules/next/dist/bin/next ${hosted ? "start" : "dev"} --hostname 127.0.0.1 --port 3100`,
    url: `${fixture.env.ADMIN_ORIGIN}/api/health`, reuseExistingServer: false,
    timeout: 120_000, env: { ...fixture.env, NODE_ENV: hosted ? "production" : "development" },
  },
});
