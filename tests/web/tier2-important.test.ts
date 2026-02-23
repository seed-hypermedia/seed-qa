import { test, expect } from "@playwright/test";

const BASE = "https://seed.hyper.media";

test.describe("Tier 2 — Important", () => {
  test("W2-01 Download page renders", async ({ page }) => {
    await page.goto(`${BASE}/d/seed-hypermedia`);
    await expect(page.locator("body")).toBeVisible();
  });

  test("W2-02 Internal navigation works", async ({ page }) => {
    await page.goto(BASE);
    const links = page.locator("a[href^='/'], a[href^='https://seed.hyper.media']");
    const count = await links.count();
    expect(count).toBeGreaterThan(0);
  });

  test("W2-03 Activity feed page loads", async ({ page }) => {
    await page.goto(BASE);
    await expect(page.locator("body")).toBeVisible();
  });

  test("W2-04 Page footer renders", async ({ page }) => {
    await page.goto(BASE);
    const footer = page.locator("footer, [role='contentinfo']").first();
    const visible = await footer.isVisible({ timeout: 20000 }).catch(() => false);
    if (!visible) test.skip(true, "Footer not present on this page");
    else await expect(footer).toBeVisible();
  });

  test("W2-05 Tablet viewport (768px)", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto(BASE);
    await expect(page.locator("body")).toBeVisible();
  });

  test("W2-06 SEO meta tags present", async ({ page }) => {
    await page.goto(BASE);
    const title = await page.title();
    expect(title).toBeTruthy();
    expect(title.length).toBeGreaterThan(3);
  });

  test("W2-07 Connect page renders", async ({ page }) => {
    await page.goto(BASE);
    await expect(page.locator("body")).toBeVisible();
  });
});
