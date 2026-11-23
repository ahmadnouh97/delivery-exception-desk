import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { App } from "./App";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("shows the queue with readable case statuses", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation((path: string) =>
      Promise.resolve(
        Response.json(
          path.endsWith("/cases")
            ? [
                {
                  case_id: "DED-2001",
                  status: "waiting",
                  exception_type: "delivered_not_received",
                  language: "ar",
                },
              ]
            : [],
        ),
      ),
    ),
  );
  render(<App />);
  expect(
    await screen.findByRole("button", {
      name: /DED-2001.*Waiting for decision/,
    }),
  ).toBeDefined();
});

it("offers a retry when the backend is unavailable", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
  render(<App />);
  expect(await screen.findByRole("alert")).toBeDefined();
  expect(screen.getByRole("button", { name: "Retry" })).toBeDefined();
});
