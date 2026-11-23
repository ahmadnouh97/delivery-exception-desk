import {
  act,
  cleanup,
  render,
  renderHook,
  screen,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { App } from "./App";
import { useCaseDrafts } from "./caseDrafts";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  sessionStorage.clear();
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
                  order_id: "DED-ORD-2001",
                  tracking_id: "DED-TRK-2001",
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
      name: /DED-2001.*Needs decision/,
    }),
  ).toBeDefined();
});

it("offers a retry when the backend is unavailable", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
  render(<App />);
  expect(await screen.findByRole("alert")).toBeDefined();
  expect(screen.getByRole("button", { name: "Retry" })).toBeDefined();
});

it("restores drafts from session storage and discards only the selected draft", () => {
  const first = renderHook(useCaseDrafts);
  act(() => {
    first.result.current.saveDraft("handler:case", {
      action: "refund",
      reason: "Refund the order.",
    });
    first.result.current.saveDraft("supervisor:case", {
      action: "",
      reason: "Checked the receipt.",
    });
  });
  first.unmount();

  const restored = renderHook(useCaseDrafts);
  expect(restored.result.current.drafts["handler:case"]?.action).toBe("refund");
  act(() => restored.result.current.discardDraft("handler:case"));
  expect(restored.result.current.drafts).toEqual({
    "supervisor:case": { action: "", reason: "Checked the receipt." },
  });
});
