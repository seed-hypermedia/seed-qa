#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");
const FORCE = process.argv.includes("--force");
const IS_WINDOWS = process.platform === "win32";
const SHELL = IS_WINDOWS ? "cmd" : "bash";
const SHELL_FLAG = IS_WINDOWS ? "/c" : "-c";

function log(...args) { console.log(...args); }
function header(msg) { log(`\n${"=".repeat(60)}\n${msg}\n${"=".repeat(60)}`); }

function loadJSON(p) {
  if (!existsSync(p)) return null;
  try { return JSON.parse(readFileSync(p, "utf8")); } catch { return null; }
}

function runCmd(cmd, opts = {}) {
  log(`\n▶ ${cmd}`);
  return spawnSync(SHELL, [SHELL_FLAG, cmd], {
    encoding: "utf8",
    cwd: PROJECT_ROOT,
    stdio: "inherit",
    env: { ...process.env },
    ...opts,
  });
}

function runCmdCapture(cmd, opts = {}) {
  return spawnSync(SHELL, [SHELL_FLAG, cmd], {
    encoding: "utf8",
    cwd: PROJECT_ROOT,
    env: { ...process.env },
    ...opts,
  });
}

function parseWebResults(results) {
  if (!results) return { chrome: { passed: 0, failed: 0, total: 0 }, firefox: { passed: 0, failed: 0, total: 0 } };
  const byProject = {};
  function walkSuite(suite) {
    for (const spec of suite.specs || []) {
      for (const test of spec.tests || []) {
        const project = test.projectName || "";
        if (!byProject[project]) byProject[project] = { passed: 0, failed: 0, total: 0 };
        byProject[project].total++;
        const last = (test.results || []).slice(-1)[0];
        if (last && last.status === "passed") byProject[project].passed++;
        else byProject[project].failed++;
      }
    }
    for (const child of suite.suites || []) walkSuite(child);
  }
  (results.suites || []).forEach((s) => walkSuite(s));
  const chrome = Object.entries(byProject).find(([k]) => k.toLowerCase().includes("chrom"))?.[1] || { passed: 0, failed: 0, total: 0 };
  const firefox = Object.entries(byProject).find(([k]) => k.toLowerCase().includes("firefox"))?.[1] || { passed: 0, failed: 0, total: 0 };
  return { chrome, firefox };
}

function parseDesktopResults(results) {
  if (!results) return { passed: 0, failed: 0, total: 0, skipped: 0 };
  let passed = 0, failed = 0, total = 0, skipped = 0;
  function walkSuite(suite) {
    for (const spec of suite.specs || []) {
      for (const test of spec.tests || []) {
        total++;
        const last = (test.results || []).slice(-1)[0];
        if (!last) { skipped++; continue; }
        if (last.status === "passed") passed++;
        else if (last.status === "skipped") skipped++;
        else failed++;
      }
    }
    for (const child of suite.suites || []) walkSuite(child);
  }
  (results.suites || []).forEach(walkSuite);
  return { passed, failed, total, skipped };
}

async function main() {
  const startedAt = new Date().toISOString();
  header(`Seed QA Full Run — ${startedAt}`);

  header("🔄 Syncing specs from seed-hypermedia/seed-qa...");
  runCmd("node scripts/sync-specs.mjs");

  let version = "unknown";

  if (!FORCE) {
    log("\n🔍 Checking for new release...");
    const check = runCmdCapture("node scripts/check-new-release.mjs");
    if (check.status === 1) {
      log("ℹ️ No new build. Use --force to run anyway.");
      process.exit(1);
    }
    version = (check.stdout || "").trim() || "unknown";
    log(`✅ New build: ${version}`);
  } else {
    log("⚡ --force: skipping version check");
  }

  header("📦 Downloading build...");
  runCmd("node scripts/download-build.mjs");
  const buildMeta = loadJSON(join(PROJECT_ROOT, "builds", "current.json"));
  if (buildMeta?.version) version = buildMeta.version;

  header("🖥️ Running desktop tests...");
  // No --reporter flag here: playwright.config.ts already configures json→reports/results.json + list
  runCmd("npx playwright test --config playwright.config.ts 2>&1");
  const desktop = parseDesktopResults(loadJSON(join(PROJECT_ROOT, "reports", "results.json")));
  log(`\n🖥️ Desktop: ${desktop.passed}/${desktop.total} passed`);

  header("🌐 Running web tests...");
  runCmd("npx playwright test --config playwright.web.config.ts 2>&1");
  const web = parseWebResults(loadJSON(join(PROJECT_ROOT, "reports", "web-results.json")));
  log(`\n🌐 Chrome: ${web.chrome.passed}/${web.chrome.total} | Firefox: ${web.firefox.passed}/${web.firefox.total}`);

  header("📋 Reporting failures...");
  runCmd("node scripts/report-failures.mjs");

  header("🔍 Verifying fixes...");
  const BASH = IS_WINDOWS ? '"C:\\Program Files\\Git\\bin\\bash.exe"' : "bash";
  runCmd(`${BASH} scripts/verify-fixes.sh`);

  header("🔧 Auto-fix...");
  const autoFix = runCmdCapture("node scripts/auto-fix.mjs");
  const prUrls = (autoFix.stdout || "")
    .split("\n")
    .filter((l) => l.startsWith("PR_URL:"))
    .map((l) => l.replace("PR_URL: ", "").trim());
  if (autoFix.stdout) process.stdout.write(autoFix.stdout);

  const finishedAt = new Date().toISOString();
  const summary = {
    version,
    platform: IS_WINDOWS ? "windows" : "linux",
    startedAt,
    finishedAt,
    desktop,
    web,
    issues: { filed: 0, closed: 0, urls: [] },
    prs: prUrls,
    notes: [],
  };
  // Write summary to a file — avoids shell quoting nightmares on Windows cmd.exe
  const SUMMARY_PATH = join(PROJECT_ROOT, "reports", "summary.json");
  writeFileSync(SUMMARY_PATH, JSON.stringify(summary, null, 2));
  log(`\n📄 Summary written to reports/summary.json`);

  header("💾 Saving report...");
  runCmd("node scripts/save-report.mjs");

  header("📣 Discord...");
  runCmd("node scripts/discord-notify.mjs");

  // Get current seed-qa git commit hash for change detection
  const gitResult = spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf8", cwd: PROJECT_ROOT });
  const qaCommit = (gitResult.stdout || "").trim();

  writeFileSync(
    join(PROJECT_ROOT, "reports", "last-tested.json"),
    JSON.stringify({ version, qaCommit, testedAt: finishedAt }, null, 2)
  );

  header("📊 Final Summary");
  log(`Version: ${version} | Desktop: ${desktop.passed}/${desktop.total} | Chrome: ${web.chrome.passed}/${web.chrome.total} | Firefox: ${web.firefox.passed}/${web.firefox.total}`);

  const hasFailures = desktop.failed > 0 || web.chrome.failed > 0;
  process.exit(hasFailures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
