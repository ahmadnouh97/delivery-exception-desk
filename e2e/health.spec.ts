import { expect, test } from "@playwright/test";

test("the dashboard shows that the API is reachable", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Delivery Exception Desk" }),
  ).toBeVisible();
  await expect(page.getByRole("status")).toHaveText("Backend available");
});
