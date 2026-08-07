import base from "./playwright.config";
import { defineConfig } from "@playwright/test";

export default defineConfig({
  ...base,
  use: { ...base.use, baseURL: "http://127.0.0.1:3200" },
  webServer: {
    command: "node scripts/static-server.mjs 3200 dist/client",
    url: "http://127.0.0.1:3200",
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
