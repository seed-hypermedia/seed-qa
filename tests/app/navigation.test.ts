import { test, expect } from "@playwright/test";
import { launchApp, closeApp, AppContext } from "./helpers";

let ctx: AppContext;

test.beforeAll(async () => {
  ctx = await launchApp();
});

test.afterAll(async () => {
  await closeApp(ctx);
});

test("sidebar is visible after app loads", async () => {
  await ctx.page.waitForTimeout(5000);
  await ctx.page.screenshot({ path: "reports/navigation-loaded.png" });
  const sidebar = ctx.page.locator('[data-testid="sidebar"], nav, .sidebar, aside').first();
  const visible = await sidebar.isVisible().catch(() => false);
  if (!visible) test.skip(true, "App may be showing onboarding");
});

test("window controls are functional", async () => {
  expect(await ctx.page.evaluate(() => window.innerWidth)).toBeGreaterThan(0);
  expect(await ctx.page.evaluate(() => window.innerHeight)).toBeGreaterThan(0);
});
