import { expect, test } from "@playwright/test";

test("reviews an Arabic ticket and accepts a recommendation", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /DED-2001/ }).click();
  await expect(page.getByText(/جاني/)).toHaveAttribute("dir", "rtl");
  await page.getByRole("button", { name: "العربية" }).click();
  await expect(page.getByRole("main")).toHaveAttribute("dir", "rtl");
  await page.getByRole("button", { name: "إنشاء توصية" }).click();
  await expect(
    page.getByRole("paragraph").filter({ hasText: /قبل أقل من/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "قبول التوصية" }).click();
  await expect(
    page.getByRole("heading", { name: /تم تسجيل القرار/ }),
  ).toBeVisible();
});

test("revises a replacement proposal and records supervisor approval", async ({
  page,
}) => {
  await page.goto("/?case=DED-2008");
  await page.getByRole("button", { name: "Generate recommendation" }).click();
  await expect(page.getByText("Supervisor review required")).toBeVisible();
  await page
    .getByLabel("Reason")
    .fill("Warehouse received the parcel. Stock and address confirmed.");
  await page.getByRole("button", { name: "Record decision" }).click();
  await expect(
    page.getByRole("heading", { name: /Awaiting supervisor review/ }),
  ).toBeVisible();
  await page.getByLabel("Demo staff").selectOption("DED-H003");
  await page.getByLabel("Review note").fill("Verified the replacement.");
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  await expect(page.getByRole("heading", { name: /Decided/ })).toBeVisible();
  await page.reload();
  await expect(page.getByText(/Verified the replacement/)).toBeVisible();
  await expect(page.getByText(/Stock and address confirmed/)).toBeVisible();
});

test("records a manual decision when the service is unavailable", async ({
  page,
}) => {
  await page.goto("/?case=DED-2002");
  await page.getByRole("button", { name: "Generate recommendation" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Recommendation unavailable",
  );
  await page
    .getByRole("combobox", { name: /^Action/ })
    .selectOption("open_carrier_investigation");
  await page
    .getByLabel("Reason")
    .fill("The visible parcel label belongs to another shipment.");
  await page.getByRole("button", { name: "Record decision" }).click();
  await expect(page.getByRole("heading", { name: /Decided/ })).toBeVisible();
});
