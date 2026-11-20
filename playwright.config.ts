import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  use: { baseURL: "http://127.0.0.1:5173" },
  webServer: [
    {
      command: "uv run -m uvicorn backend.main:app",
      url: "http://127.0.0.1:8000/api/health",
    },
    {
      command: "npm run dev:dashboard",
      url: "http://127.0.0.1:5173",
    },
  ],
});
