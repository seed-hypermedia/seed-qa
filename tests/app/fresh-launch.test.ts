import { test, expect } from "@playwright/test";
import { launchApp, closeApp, resetForFreshLaunch, restoreAfterFreshLaunch, AppContext } from "./helpers";

let ctx: AppContext;

test.beforeAll(async () => {
  resetForFreshLaunch();
  ctx = await launchApp();
});

test.afterAll(async () => {
  await closeApp(ctx);
  restoreAfterFreshLaunch();
});

test("D4-01 fresh launch shows onboarding flow", async () => {
  // Give the app a few seconds to render
  await ctx.page.waitForTimeout(4000);
  await ctx.page.screenshot({ path: "reports/fresh-launch.png" }).catch(() => {});

  const hasOnboarding = await ctx.page
    .locator("text=/create|new account|welcome|get started|recovery|setup/i")
    .first()
    .isVisible()
    .catch(() => false);

  const hasAnyContent = await ctx.page
    .evaluate(() => (document.body?.innerText?.trim().length ?? 0) > 10)
    .catch(() => false);

  // On a truly fresh start the onboarding MUST appear.
  // If hasAnyContent is true but hasOnboarding is false, fail with a useful message.
  if (!hasOnboarding && hasAnyContent) {
    const bodyText = await ctx.page.evaluate(() => document.body?.innerText?.trim().substring(0, 300)).catch(() => "");
    console.log("[D4-01] Body text sample:", bodyText);
  }

  expect(hasOnboarding).toBeTruthy();
});

test("D4-02 fresh launch has no crash dialogs", async () => {
  const errorDialog = ctx.page.locator('[role="alertdialog"], .error-boundary, .crash-screen');
  await expect(errorDialog).toHaveCount(0);
});
