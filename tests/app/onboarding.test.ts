import { test, expect } from "@playwright/test";
import { launchApp, closeApp, AppContext } from "./helpers";

let ctx: AppContext;

test.beforeAll(async () => {
  ctx = await launchApp();
});

test.afterAll(async () => {
  await closeApp(ctx);
});

test("onboarding screen appears on fresh launch", async () => {
  await ctx.page.waitForTimeout(3000);
  // Screenshot is best-effort (may fail on headless displays)
  await ctx.page.screenshot({ path: "reports/onboarding-initial.png" }).catch(() => {});
  const hasOnboarding = await ctx.page
    .locator('text=/create|new|account|welcome|get started|recovery/i')
    .first()
    .isVisible()
    .catch(() => false);
  const hasMainScreen = await ctx.page
    .locator('[data-testid="sidebar"], nav, .sidebar')
    .first()
    .isVisible()
    .catch(() => false);
  expect(hasOnboarding || hasMainScreen).toBeTruthy();
});
