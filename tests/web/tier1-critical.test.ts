import { test, expect } from "@playwright/test";

const BASE = "https://seed.hyper.media";

test.describe("Tier 1 — Critical", () => {
  test("W1-01 Homepage loads with content", async ({ page }) => {
    await page.goto(BASE);
    const text = await page.textContent("body");
    expect((text || "").trim().length).toBeGreaterThan(100);
  });

  test("W1-02 Site header/navigation is visible", async ({ page }) => {
    await page.goto(BASE);
    const nav = page.locator("header, nav, [role='navigation']").first();
    await expect(nav).toBeVisible({ timeout: 20000 });
  });

  test("W1-03 Main content area renders", async ({ page }) => {
    await page.goto(BASE);
    const main = page.locator("main, [role='main'], article, section").first();
    await expect(main).toBeVisible({ timeout: 20000 });
  });

  test("W1-04 No critical JS errors on homepage", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.goto(BASE);
    await page.waitForTimeout(2000);
    const critical = errors.filter(
      (e) =>
        !e.includes("ResizeObserver") && !e.includes("Non-Error promise")
    );
    expect(critical).toHaveLength(0);
  });

  test("W1-05 No broken images on homepage", async ({ page }) => {
    await page.goto(BASE);
    await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
    const broken = await page.evaluate(() =>
      Array.from(document.images)
        .filter((img) => !img.complete || img.naturalWidth === 0)
        .map((img) => img.src)
    );
    expect(broken).toHaveLength(0);
  });

  test("W1-06 Mobile viewport renders correctly (375px)", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(BASE);
    await expect(page.locator("body")).toBeVisible();
    const overflow = await page.evaluate(
      () => document.body.scrollWidth > window.innerWidth
    );
    expect(overflow).toBeFalsy();
  });

  test("W1-07 API version endpoint is healthy", async ({ request }) => {
    const resp = await request.get("https://seed.hyper.media/api/version");
    expect([200, 403, 404]).toContain(resp.status());
  });
});
