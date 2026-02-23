import { test, expect } from "@playwright/test";
import { launchApp, closeApp, AppContext } from "./helpers";

let ctx: AppContext;

test.beforeAll(async () => {
  ctx = await launchApp();
});

test.afterAll(async () => {
  await closeApp(ctx);
});

test("app launches without crash", async () => {
  expect(ctx.app).toBeTruthy();
  expect(ctx.page).toBeTruthy();
});

test("main window has correct title", async () => {
  const title = await ctx.page.title();
  expect(title).toBeTruthy();
});

test("main window has reasonable size", async () => {
  // Use Electron's native API — works regardless of display/xvfb state
  const bounds = await ctx.app.evaluate(async ({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0];
    return win ? win.getBounds() : { width: 0, height: 0 };
  });
  expect(bounds.width).toBeGreaterThan(400);
  expect(bounds.height).toBeGreaterThan(300);
});

test("no crash dialogs or error overlays", async () => {
  const errorDialog = ctx.page.locator('[role="alertdialog"], .error-boundary, .crash-screen');
  await expect(errorDialog).toHaveCount(0);
});
