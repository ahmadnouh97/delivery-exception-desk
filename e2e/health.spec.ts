import { expect, test } from "@playwright/test";

test("the dashboard shows that the API is reachable", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("navigation").getByRole("button")).toHaveCount(
    24,
  );
});
