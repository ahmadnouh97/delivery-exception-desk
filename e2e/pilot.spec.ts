import { expect, test } from "@playwright/test";

test("reviews an Arabic ticket and accepts a recommendation", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByLabel("Filter cases by status")).toHaveValue(
    "waiting",
  );
  await page.getByRole("button", { name: /DED-2001/ }).click();
  await expect(page.locator(".case-meta")).toContainText(
    "Reviewing as Maha A.",
  );
  await expect(page.getByText(/جاني/)).toHaveAttribute("dir", "rtl");
  await page.getByRole("button", { name: "العربية" }).click();
  await expect(page.getByRole("main")).toHaveAttribute("dir", "rtl");
  await expect(page.locator("#recommended-action")).toBeVisible();
  await expect(
    page.getByRole("link", { name: /أحدث تسجيل للتسليم/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "قبول التوصية" }).click();
  await expect(
    page.getByRole("heading", { name: /تم تسجيل القرار/ }),
  ).toBeVisible();
  await expect(
    page.getByText("تم تسجيل القرار.", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".case-meta")).toContainText("موظف الدعم Maha A.");
});

test("revises a replacement proposal and records supervisor approval", async ({
  page,
}) => {
  await page.goto("/?case=DED-2008");
  await expect(page.getByText("Supervisor review required")).toBeVisible();
  await page.getByRole("button", { name: "Edit reason" }).click();
  await expect(page.getByLabel("Reason")).toBeFocused();
  await page
    .getByLabel("Reason")
    .fill("Warehouse received the parcel. Stock and address confirmed.");
  await page.getByRole("button", { name: "Record decision" }).click();
  await expect(
    page.getByRole("heading", { name: /Awaiting supervisor review/ }),
  ).toBeVisible();
  await expect(page.getByText(/A supervisor acts next/)).toBeVisible();
  await page.getByLabel("Demo staff").selectOption("DED-H003");
  await expect(page.locator(".case-meta")).toContainText("Handled by Maha A.");
  await expect(page.getByLabel("Filter cases by status")).toHaveValue(
    "awaiting_supervisor",
  );
  const reviewNote = page.getByLabel("Review note");
  await reviewNote.fill("Explain how the address was confirmed.");
  await page.getByLabel("Filter cases by status").selectOption("all");
  await page.getByRole("button", { name: /DED-2007/ }).click();
  await expect(page.locator(".case-meta")).toContainText("No handler recorded");
  await page.getByRole("button", { name: /DED-2008/ }).click();
  await expect(reviewNote).toHaveValue(
    "Explain how the address was confirmed.",
  );
  await page.reload();
  await expect(page.getByLabel("Demo staff")).toHaveValue("DED-H003");
  await expect(reviewNote).toHaveValue(
    "Explain how the address was confirmed.",
  );
  await page.getByRole("button", { name: "Return for revision" }).click();
  await expect(
    page.getByText("Returned to the handler for revision."),
  ).toBeVisible();
  await expect(
    page.getByText("There are no more cases in your queue."),
  ).toBeVisible();
  await page.getByLabel("Demo staff").selectOption("DED-H002");
  await expect(page.locator(".case-meta")).toContainText("Handled by Maha A.");
  await expect(page.locator(".review-note")).toContainText(
    "Explain how the address was confirmed.",
  );
  await page.getByRole("button", { name: "Record decision" }).click();
  await expect(page.getByText(/A supervisor acts next/)).toBeVisible();
  await page.getByLabel("Demo staff").selectOption("DED-H003");
  await expect(reviewNote).toHaveValue("");
  await page.getByLabel("Review note").fill("Verified the replacement.");
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  await expect(page.getByRole("heading", { name: /Decided/ })).toBeVisible();
  await expect(
    page.getByText("Approved. The decision has been recorded."),
  ).toBeVisible();
  await page.reload();
  await expect(page.locator(".case-meta")).toContainText("Handled by Rami K.");
  await page.getByText("Decision history", { exact: true }).click();
  await expect(page.getByText(/Verified the replacement/)).toBeVisible();
  await expect(
    page
      .getByRole("article")
      .filter({ hasText: /Stock and address confirmed/ }),
  ).toHaveCount(2);
});

test("shows concise evidence and filters the queue across languages", async ({
  page,
}) => {
  await page.goto("/?case=DED-2004");
  await page
    .getByRole("combobox", { name: "Filter cases by status" })
    .selectOption("awaiting_supervisor");
  await expect(
    page.getByRole("navigation").getByRole("button", { name: /DED-2004/ }),
  ).toHaveCount(0);
  await page
    .getByRole("combobox", { name: "Filter cases by status" })
    .selectOption("waiting");
  await expect(
    page.getByRole("navigation").getByRole("button", { name: /DED-2004/ }),
  ).toBeVisible();
  await expect(
    page.getByText("Received at warehouse", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("At carrier depot", { exact: true })).toHaveCount(
    0,
  );
  await expect(
    page.getByText("Delivery attempted", { exact: true }),
  ).toBeHidden();
  await expect(
    page.getByText("Request confirmation of the new delivery address"),
  ).toBeVisible();
  await expect(page.getByText(/Refund.*0\.00/)).toHaveCount(0);
  await expect(page.getByRole("textbox", { name: "Reason" })).toHaveCount(0);
  const policy = page.locator(".policy-details").first();
  await policy.locator("summary").press("Enter");
  await expect(policy.getByRole("list")).toContainText(
    "Refund the full order total",
  );
  await page.getByRole("button", { name: "العربية" }).click();
  await expect(policy.getByRole("list")).toContainText("أعِد كامل مبلغ الطلب");
  await policy.locator("summary").press("Space");
  await expect(policy.getByRole("list")).toBeHidden();
  await expect(page.locator(".decision-facts li")).toHaveText([
    "عنوان الشحن الجديد بحاجة لتأكيد.",
    "البديل متوفر.",
    "استلم المستودع الطلب المُعاد.",
  ]);
  await expect(page.getByText(/استلام الطلب المُعاد في المستودع/)).toBeVisible();
  await expect(page.locator(".case-header time")).toContainText("أكتوبر");
  const ticket = page.getByText(/The speaker stand was returned/);
  await expect(ticket).toHaveAttribute("lang", "en");
  await expect(ticket).toHaveCSS("direction", "ltr");
  await expect(ticket).toHaveCSS("text-align", "start");
  await expect(page.getByText("التحديثات السابقة (٢)")).toBeVisible();
  await expect(page.getByText(/Retailer intake recorded/)).toHaveCSS(
    "text-align",
    "start",
  );
  await page.getByText("شرح التوصية الأصلي", { exact: true }).click();
  const explanation = page.getByText(
    "The carrier confirmed warehouse receipt.",
  );
  await expect(explanation).toBeVisible();
  await expect(explanation).toHaveCSS("text-align", "start");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("navigation")).toBeHidden();
  const evidenceLink = page.getByRole("link", {
    name: "عنوان الشحن الجديد بحاجة لتأكيد.",
  });
  const accept = page.getByRole("button", { name: "قبول التوصية" });
  expect((await evidenceLink.boundingBox())!.y).toBeLessThan(
    (await accept.boundingBox())!.y,
  );
  await evidenceLink.click();
  await expect(page.locator("#evidence-order")).toBeFocused();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page.getByRole("button", { name: "العودة إلى قائمة الحالات" }).click();
  await expect(page.getByRole("navigation")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "قائمة الحالات" }),
  ).toBeFocused();
});

test("records a manual decision when the service is unavailable", async ({
  page,
}) => {
  await page.goto("/?case=DED-2002");
  await page.getByRole("button", { name: "العربية" }).click();
  await page.reload();
  await expect(page.getByRole("main")).toHaveAttribute("dir", "rtl");
  await expect(
    page.getByRole("link", { name: "إثبات التسليم لا يطابق الشحنة" }),
  ).toHaveAttribute("href", "#evidence-proof");
  await expect(page.getByRole("alert")).toContainText("التوصية غير متاحة");
  await expect(
    page.getByRole("button", { name: "إعادة محاولة إنشاء التوصية" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "المتابعة يدويًا" }).click();
  await page
    .getByRole("combobox", { name: /^الإجراء/ })
    .selectOption("open_carrier_investigation");
  await page
    .getByLabel("السبب")
    .fill("The visible parcel label belongs to another shipment.");
  await page.getByRole("button", { name: "تسجيل القرار" }).click();
  await expect(
    page.getByRole("heading", { name: /تم تسجيل القرار/ }),
  ).toBeVisible();
});

test("preserves drafts by case and staff through reload and save errors", async ({
  page,
}) => {
  await page.goto("/?case=DED-2020");
  await page.getByRole("button", { name: "Edit reason" }).click();
  const reason = page.getByLabel("Reason");
  await reason.fill(
    "Confirm the address before sending the available replacement.",
  );
  await page.getByRole("button", { name: /DED-2005/ }).click();
  await page.getByRole("button", { name: /DED-2020/ }).click();
  await expect(reason).toHaveValue(/Confirm the address/);
  await page.getByLabel("Demo staff").selectOption("DED-H002");
  await page.getByRole("button", { name: "Edit reason" }).click();
  await reason.fill("Second staff member draft.");
  await page.getByLabel("Demo staff").selectOption("DED-H001");
  await expect(reason).toHaveValue(/Confirm the address/);
  await page.reload();
  await expect(reason).toHaveValue(/Confirm the address/);
  const decision = "**/api/cases/DED-2020/decision";
  await page.route(decision, (route) => route.fulfill({ status: 403 }), {
    times: 1,
  });
  await page.getByRole("button", { name: "Record decision" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Check the selected staff member",
  );
  await expect(reason).toHaveValue(/Confirm the address/);
  await page.route(decision, (route) => route.fulfill({ status: 503 }), {
    times: 1,
  });
  await page.getByRole("button", { name: "Record decision" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Could not confirm the save",
  );
  await expect(reason).toHaveValue(/Confirm the address/);
  await page.route(decision, (route) => route.fulfill({ status: 409 }), {
    times: 1,
  });
  await page.getByRole("button", { name: "Record decision" }).click();
  await expect(page.getByRole("alert")).toContainText("The case changed");
  await expect(reason).toHaveValue(/Confirm the address/);
  await page.getByRole("button", { name: "Discard draft" }).click();
  await expect(reason).toBeHidden();
  await page.getByRole("button", { name: "Edit reason" }).click();
  await expect(reason).toHaveValue(
    "The carrier confirmed receipt at the retailer warehouse.",
  );
  await reason.fill(
    "Ask for the new delivery address before sending the replacement.",
  );
  await page.getByRole("button", { name: "Record decision" }).click();
  await expect(
    page.getByText("Decision recorded.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Discard draft" }),
  ).toBeHidden();
  await expect(page.getByRole("button", { name: "Next case" })).toBeVisible();
  await page.getByLabel("Demo staff").selectOption("DED-H002");
  await expect(page.getByText("Second staff member draft.")).toBeVisible();
});

test("searches all ID types and preserves the mobile queue filters", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");
  const search = page.getByRole("searchbox");
  const row = page.getByRole("button", { name: /DED-2009/ });
  for (const id of ["  ded-2009 ", "DED-ORD-2009", "DED-TRK-2009"]) {
    await search.fill(id);
    await expect(row).toBeVisible();
    await expect(page.locator(".queue-list li")).toHaveCount(1);
  }
  await row.press("Enter");
  await expect(
    page.getByRole("region", { name: "Case details" }),
  ).toBeFocused();
  await expect(
    page.getByRole("link", {
      name: "A refund was already completed for this issue.",
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Back to cases" }).click();
  await expect(search).toHaveValue("DED-TRK-2009");
  await page.getByLabel("Filter cases by status").selectOption("decided");
  await page.getByRole("button", { name: "Search all cases" }).click();
  await expect(row).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(360);
});

test("retries a recommendation and keeps a case open when evidence is insufficient", async ({
  page,
}) => {
  const recommendation = "**/api/cases/DED-2007/recommendation";
  await page.route(recommendation, (route) => route.fulfill({ status: 503 }), {
    times: 1,
  });
  await page.goto("/?case=DED-2007");
  await expect(
    page.getByRole("link", {
      name: "The last return scan was at the carrier depot.",
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Retry recommendation" }).click();
  await expect(
    page.getByText("Wait for update", { exact: true }),
  ).toBeVisible();

  await page.route("**/api/cases/DED-2015/recommendation", (route) =>
    route.fulfill({ status: 422 }),
  );
  await page.goto("/?case=DED-2015");
  await expect(page.getByRole("alert")).toContainText(
    "The evidence available at report time is insufficient",
  );
  await expect(
    page.getByRole("button", { name: "Continue manually" }),
  ).toBeHidden();
  await expect(
    page.getByRole("heading", { name: /Waiting for decision/ }),
  ).toBeVisible();
});

test("shows the shared retry interval and keeps manual review available", async ({
  page,
}) => {
  await page.clock.install();
  await page.route("**/api/cases/DED-2017/recommendation", (route) =>
    route.fulfill({ status: 429, headers: { "Retry-After": "20" } }),
  );
  await page.goto("/?case=DED-2017");
  await expect(page.getByRole("alert")).toContainText(
    "temporarily rate-limited",
  );
  await expect(page.getByRole("button", { name: /Retry in/ })).toBeDisabled();
  await page.getByRole("button", { name: "العربية" }).click();
  await expect(page.getByRole("alert")).toContainText("حد الاستخدام");
  await expect(
    page.getByRole("button", { name: "المتابعة يدويًا" }),
  ).toBeEnabled();
  await expect(
    page.getByRole("button", { name: /أعد المحاولة بعد/ }),
  ).toBeDisabled();
  await page.clock.fastForward(20000);
  await expect(
    page.getByRole("button", { name: "إعادة محاولة إنشاء التوصية" }),
  ).toBeEnabled();
});

test("does not replace the current case when a recommendation returns late", async ({
  page,
}) => {
  let finishRequest = () => {};
  const responseReady = new Promise<void>((resolve) => {
    finishRequest = resolve;
  });
  await page.route("**/api/cases/DED-2013/recommendation", async (route) => {
    await responseReady;
    await route.continue();
  });
  await page.goto("/?case=DED-2013");
  await expect(page.getByText("Preparing recommendation…")).toBeVisible();
  await page.getByRole("button", { name: /DED-2006/ }).click();
  await expect(page.getByRole("heading", { name: /DED-2006/ })).toBeVisible();
  const response = page.waitForResponse("**/api/cases/DED-2013");
  finishRequest();
  await response;
  await expect(
    page.getByRole("button", { name: "Accept recommendation" }),
  ).toBeEnabled();
  await expect(page.getByRole("heading", { name: /DED-2006/ })).toBeVisible();
});

test("keeps a draft readable when another handler records the decision first", async ({
  page,
}) => {
  await page.goto("/?case=DED-2021");
  await page.getByRole("button", { name: "Edit reason" }).click();
  await page.getByLabel("Reason").fill("Draft from the first handler.");

  const path = "/api/cases/DED-2021";
  const detail = await page.request.get(path);
  const { version, recommendation } = (await detail.json()) as {
    version: number;
    recommendation: { action: string };
  };
  const recorded = await page.request.post(path + "/decision", {
    data: {
      handler_id: "DED-H002",
      version,
      action: recommendation.action,
      rationale: "Decision from the second handler.",
    },
  });
  expect(recorded.ok()).toBe(true);
  await page.getByRole("button", { name: "Record decision" }).click();
  await expect(page.getByRole("alert")).toContainText("The case changed");
  await expect(page.getByRole("heading", { name: /Decided/ })).toBeVisible();
  await expect(page.getByText("Draft from the first handler.")).toBeVisible();
  const current = await page.request.get(path);
  expect(
    ((await current.json()) as { history: unknown[] }).history,
  ).toHaveLength(1);
});

test("keeps a manual draft editable when a recommendation arrives later", async ({
  page,
}) => {
  await page.route(
    "**/api/cases/DED-2016/recommendation",
    (route) => route.fulfill({ status: 503 }),
    { times: 1 },
  );
  await page.goto("/?case=DED-2016");
  await page.getByRole("button", { name: "Continue manually" }).click();
  const actions = page.getByRole("combobox", { name: /^Action/ });
  await actions.selectOption("wait_for_update");
  await page.getByLabel("Reason").fill("Check receipt at the warehouse.");
  const recommendation = await page.request.post(
    "/api/cases/DED-2016/recommendation",
  );
  expect(recommendation.ok()).toBe(true);
  await page.reload();

  await expect(actions).toHaveValue("wait_for_update");
  await actions.selectOption("replace");
  await expect(page.getByLabel("Reason")).toHaveValue(
    "Check receipt at the warehouse.",
  );
  await page.getByRole("button", { name: "Record decision" }).click();
  await expect(page.getByRole("heading", { name: /Decided/ })).toBeVisible();
  await page.getByText("Decision history", { exact: true }).click();
  await expect(
    page.getByText("The carrier confirmed return_received.", { exact: true }),
  ).toBeVisible();
});
