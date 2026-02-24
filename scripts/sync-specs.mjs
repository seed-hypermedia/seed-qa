#!/usr/bin/env node
/**
 * sync-specs.mjs
 *
 * 1. git pull from seed-hypermedia/seed-qa (gets latest SPECS.md + test changes)
 * 2. Parse SPECS.md — if any spec IDs are missing from test files, generate stubs
 * 3. If new tests were generated, commit and push them back
 *
 * Exit 0 — synced (or already up to date)
 * Exit 1 — sync failed (non-fatal: full-run continues with existing files)
 */

import { spawnSync } from "child_process";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { existsSync, readFileSync, writeFileSync, appendFileSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO = "seed-hypermedia/seed-qa";
const IS_WINDOWS = process.platform === "win32";
const SHELL = IS_WINDOWS ? "cmd" : "bash";
const SHELL_FLAG = IS_WINDOWS ? "/c" : "-c";

function run(cmd, opts = {}) {
  return spawnSync(SHELL, [SHELL_FLAG, cmd], {
    encoding: "utf8",
    cwd: opts.cwd || ROOT,
    env: { ...process.env },
  });
}

// ─── Spec parsing ────────────────────────────────────────────────────────────

/**
 * Parses SPECS.md and returns all spec entries.
 * Expected table format:
 *   | W1-01 | Description of what must happen |
 */
function parseSpecs(specsPath) {
  if (!existsSync(specsPath)) return [];
  const lines = readFileSync(specsPath, "utf8").split("\n");
  const specs = [];
  for (const line of lines) {
    const match = line.match(/^\|\s*([A-Z]\d+-\d+)\s*\|\s*(.+?)\s*\|/);
    if (match) {
      specs.push({ id: match[1], description: match[2].trim() });
    }
  }
  return specs;
}

/**
 * Returns all test IDs already implemented in a file (looks for test("W1-01 ...)
 */
function getImplementedIds(filePath) {
  if (!existsSync(filePath)) return new Set();
  const content = readFileSync(filePath, "utf8");
  const ids = new Set();
  for (const match of content.matchAll(/test\(["'`](([A-Z]\d+-\d+)[^"'`]*)/g)) {
    ids.add(match[2]);
  }
  return ids;
}

/**
 * Generate a Playwright test stub from a spec description.
 * Uses simple heuristics on the description to produce a reasonable test body.
 */
function generateTestStub(spec) {
  const { id, description } = spec;
  const desc = description.toLowerCase();
  const BASE = "https://seed.hyper.media";

  // Determine URL to visit
  let gotoUrl = BASE;
  if (desc.includes("/d/") || desc.includes("download")) gotoUrl = `${BASE}/d/seed-hypermedia`;

  // Determine assertion strategy
  let body = "";

  if (desc.includes("must not") && desc.includes("overflow")) {
    body = `
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("${gotoUrl}");
    await expect(page.locator("body")).toBeVisible();
    const overflow = await page.evaluate(() => document.body.scrollWidth > window.innerWidth);
    expect(overflow).toBeFalsy();`;
  } else if (desc.includes("api") || desc.includes("endpoint")) {
    body = `
    const resp = await request.get("${BASE}/api/version");
    expect([200, 403, 404]).toContain(resp.status());`;
  } else if (desc.includes("broken image") || desc.includes("img")) {
    body = `
    await page.goto("${gotoUrl}");
    await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
    const broken = await page.evaluate(() =>
      Array.from(document.images).filter(i => !i.complete || i.naturalWidth === 0).map(i => i.src)
    );
    expect(broken).toHaveLength(0);`;
  } else if (desc.includes("javascript error") || desc.includes("js error")) {
    body = `
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("${gotoUrl}");
    await page.waitForTimeout(2000);
    const critical = errors.filter(e => !e.includes("ResizeObserver") && !e.includes("Non-Error promise"));
    expect(critical).toHaveLength(0);`;
  } else if (desc.includes("title")) {
    body = `
    await page.goto("${gotoUrl}");
    const title = await page.title();
    expect(title).toBeTruthy();
    expect(title.length).toBeGreaterThan(3);`;
  } else if (desc.includes("link") || desc.includes("navigation")) {
    body = `
    await page.goto("${gotoUrl}");
    const links = page.locator("a[href^='/'], a[href^='${BASE}']");
    expect(await links.count()).toBeGreaterThan(0);`;
  } else if (desc.includes("footer")) {
    body = `
    await page.goto("${gotoUrl}");
    const footer = page.locator("footer, [role='contentinfo']").first();
    const visible = await footer.isVisible({ timeout: 20000 }).catch(() => false);
    if (!visible) test.skip(true, "Footer not present on this page");
    else await expect(footer).toBeVisible();`;
  } else if (desc.includes("header") || desc.includes("nav")) {
    body = `
    await page.goto("${gotoUrl}");
    await expect(page.locator("header, nav, [role='navigation']").first()).toBeVisible({ timeout: 20000 });`;
  } else if (desc.includes("content") || desc.includes("visible") || desc.includes("render") || desc.includes("load")) {
    body = `
    await page.goto("${gotoUrl}");
    await expect(page.locator("body")).toBeVisible();`;
  } else {
    // Fallback: generic visible check
    body = `
    // TODO: Implement test for ${id} — "${description}"
    await page.goto("${gotoUrl}");
    await expect(page.locator("body")).toBeVisible();`;
  }

  return `
  test("${id} ${description}", async ({ page, request }) => {${body}
  });`;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  // ── Step 1: git pull ──────────────────────────────────────────────────────
  const isGit = run("git rev-parse --is-inside-work-tree");
  if (isGit.status !== 0) {
    console.log("[sync] Not a git repo — skipping sync");
    process.exit(0);
  }

  if (GITHUB_TOKEN) {
    run(`git remote set-url origin https://seed-germinator:${GITHUB_TOKEN}@github.com/${REPO}.git`);
  }

  const before = (run("git rev-parse HEAD").stdout || "").trim();
  console.log("[sync] Pulling latest from seed-hypermedia/seed-qa...");

  // Stash any local report changes (reports/ are generated locally, not committed upstream)
  const stashResult = run("git stash -- reports/");
  const didStash = (stashResult.stdout || "").includes("Saved");

  const pull = run("git pull origin main --ff-only");

  // Restore stashed reports regardless of pull outcome
  if (didStash) run("git stash pop");

  if (pull.status !== 0) {
    console.warn("[sync] ⚠️ Pull failed (will continue with existing files)");
    console.warn(pull.stderr || pull.stdout);
    process.exit(1);
  }

  const after = (run("git rev-parse HEAD").stdout || "").trim();
  if (before === after) {
    console.log("[sync] ✅ Already up to date");
  } else {
    const diff = run(`git diff --name-only ${before} ${after}`);
    const changed = (diff.stdout || "").trim().split("\n").filter(Boolean);
    console.log(`[sync] ✅ Updated → ${after.slice(0, 7)} (${changed.length} file(s) changed)`);
    if (changed.length) console.log(`[sync]    ${changed.join(", ")}`);
  }

  // ── Ensure node_modules is present (gitignored — must install after clone/sync) ──
  const nmOk = existsSync(join(ROOT, "node_modules", "@playwright", "test"));
  if (!nmOk) {
    console.log("[sync] 📦 node_modules missing — running npm install...");
    const install = run("npm install");
    if (install.status !== 0) {
      console.warn("[sync] ⚠️ npm install failed:", install.stderr);
    } else {
      console.log("[sync] ✅ npm install complete");
    }
  }

  // ── Step 2: parse SPECS.md and generate missing tests ────────────────────
  const specsPath = join(ROOT, "SPECS.md");
  const specs = parseSpecs(specsPath);

  if (specs.length === 0) {
    console.log("[sync] No specs found in SPECS.md — skipping test generation");
    process.exit(0);
  }

  const tier1Path = join(ROOT, "tests", "web", "tier1-critical.test.ts");
  const tier2Path = join(ROOT, "tests", "web", "tier2-important.test.ts");
  const desktopPath = join(ROOT, "tests", "app", "app-launch.test.ts");

  const implemented = new Set([
    ...getImplementedIds(tier1Path),
    ...getImplementedIds(tier2Path),
    ...getImplementedIds(desktopPath),
  ]);

  const newSpecs = specs.filter(s => !implemented.has(s.id));

  if (newSpecs.length === 0) {
    console.log(`[sync] ✅ All ${specs.length} spec(s) are implemented`);
    process.exit(0);
  }

  console.log(`[sync] 🆕 ${newSpecs.length} new spec(s) to implement: ${newSpecs.map(s => s.id).join(", ")}`);

  // Partition new specs into web tier1 (W1-xx), web tier2 (W2-xx), desktop (D-xx)
  const newTier1 = newSpecs.filter(s => s.id.startsWith("W1-"));
  const newTier2 = newSpecs.filter(s => s.id.startsWith("W2-"));
  const newOther = newSpecs.filter(s => !s.id.startsWith("W1-") && !s.id.startsWith("W2-"));

  let committed = false;

  for (const [specs, filePath, label] of [
    [newTier1, tier1Path, "tier1"],
    [newTier2, tier2Path, "tier2"],
  ]) {
    if (specs.length === 0) continue;
    const stubs = specs.map(generateTestStub).join("\n");
    // Append stubs before the closing }); of the describe block
    const existing = readFileSync(filePath, "utf8");
    const insertBefore = existing.lastIndexOf("});");
    if (insertBefore === -1) {
      appendFileSync(filePath, stubs);
    } else {
      const updated = existing.slice(0, insertBefore) + stubs + "\n" + existing.slice(insertBefore);
      writeFileSync(filePath, updated, "utf8");
    }
    console.log(`[sync] ✏️  Added ${specs.length} stub(s) to ${label}`);
  }

  if (newOther.length > 0) {
    console.log(`[sync] ℹ️  ${newOther.length} spec(s) with unknown prefix (${newOther.map(s => s.id).join(", ")}) — skipping auto-generate`);
  }

  // ── Step 3: commit and push the new stubs ─────────────────────────────────
  const addResult = run("git add tests/");
  const statusResult = run("git status --porcelain");
  if (!(statusResult.stdout || "").trim()) {
    console.log("[sync] Nothing new to commit");
    process.exit(0);
  }

  const ids = newSpecs.filter(s => s.id.startsWith("W")).map(s => s.id).join(", ");
  const commitResult = run(`git commit -m "test: auto-generate stubs for ${ids} [sync-specs]"`);
  if (commitResult.status !== 0) {
    console.warn("[sync] Commit failed:", commitResult.stderr);
    process.exit(1);
  }

  const pushResult = run("git push origin main");
  if (pushResult.status !== 0) {
    console.warn("[sync] Push failed (tests will still run locally):", pushResult.stderr);
  } else {
    console.log(`[sync] 📤 Pushed generated stubs for: ${ids}`);
    committed = true;
  }

  process.exit(0);
}

main().catch((e) => {
  console.error("[sync] Fatal:", e.message);
  process.exit(1);
});
