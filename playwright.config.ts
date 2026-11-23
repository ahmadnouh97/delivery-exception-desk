import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  use: { baseURL: "http://127.0.0.1:5174" },
  webServer: [
    {
      command: "uv run -m uvicorn backend.tests.pilot_server:app --port 8001",
      url: "http://127.0.0.1:8001/api/health",
    },
    {
      command: "npm run dev:dashboard -- --port 5174",
      url: "http://127.0.0.1:5174",
      env: { DELIVERY_API_URL: "http://127.0.0.1:8001" },
    },
  ],
});
