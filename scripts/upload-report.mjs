#!/usr/bin/env node
/**
 * upload-report.mjs
 *
 * Compresses reports/ and test-results/ into a tar.gz, then creates a GitHub
 * Release on seed-hypermedia/seed-qa so the artifacts are accessible from
 * anywhere. Writes the release URL back into reports/summary.json so that
 * discord-notify.mjs can embed the link.
 *
 * Requires: gh CLI in PATH and GITHUB_TOKEN env var with repo scope.
 */
import { execSync, spawnSync } from "child_process";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");
const SUMMARY_PATH = join(PROJECT_ROOT, "reports", "summary.json");
const QA_REPO = "seed-hypermedia/seed-qa";

// ── helpers ──────────────────────────────────────────────────────────────────

function log(...a) { console.log(...a); }

function ghAvailable() {
  const r = spawnSync("gh", ["--version"], { encoding: "utf8" });
  return r.status === 0;
}

function run(cmd, opts = {}) {
  log(`▶ ${cmd}`);
  execSync(cmd, { stdio: "inherit", cwd: PROJECT_ROOT, ...opts });
}

// ── main ─────────────────────────────────────────────────────────────────────

if (!existsSync(SUMMARY_PATH)) {
  log("No summary found (reports/summary.json missing), skipping upload");
  process.exit(0);
}

if (!ghAvailable()) {
  log("gh CLI not found, skipping upload");
  process.exit(0);
}

const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
if (!token) {
  log("No GITHUB_TOKEN / GH_TOKEN set, skipping upload");
  process.exit(0);
}

const summary = JSON.parse(readFileSync(SUMMARY_PATH, "utf8"));
const { version = "unknown", platform = "unknown", startedAt = "" } = summary;

const ts = new Date(startedAt || Date.now())
  .toISOString()
  .replace(/[:.]/g, "-")
  .slice(0, 16);

const tag = `report-${version}-${platform}-${ts}`;
const archiveName = `${tag}.tar.gz`;

// Decide which directories to include
const dirsToArchive = ["reports"];
if (existsSync(join(PROJECT_ROOT, "test-results"))) {
  dirsToArchive.push("test-results");
}

log(`\n📦 Compressing ${dirsToArchive.join(", ")} → ${archiveName}`);
run(`tar -czf ${archiveName} ${dirsToArchive.join(" ")}`);

const passed = `${(summary.desktop?.passed ?? 0)}/${(summary.desktop?.total ?? 0)}`;
const chrome = `${(summary.web?.chrome?.passed ?? 0)}/${(summary.web?.chrome?.total ?? 0)}`;
const relNotes = `Desktop: ${passed} | Chrome: ${chrome} | Platform: ${platform}`;

log(`\n🚀 Creating GitHub release: ${tag}`);
run(
  `gh release create ${tag} ${archiveName} \
    --repo ${QA_REPO} \
    --title "Report: ${version} (${platform})" \
    --notes "${relNotes}"`,
  { env: { ...process.env, GITHUB_TOKEN: token, GH_TOKEN: token } }
);

// Read the release URL that gh just created
const urlResult = spawnSync(
  "gh",
  ["release", "view", tag, "--repo", QA_REPO, "--json", "url", "--jq", ".url"],
  {
    encoding: "utf8",
    env: { ...process.env, GITHUB_TOKEN: token, GH_TOKEN: token },
  }
);
const releaseUrl = (urlResult.stdout || "").trim();

if (releaseUrl) {
  summary.reportUrl = releaseUrl;
  writeFileSync(SUMMARY_PATH, JSON.stringify(summary, null, 2));
  log(`✅ Report uploaded: ${releaseUrl}`);
} else {
  log("⚠️  Could not read release URL — summary not updated");
}

// Clean up local archive
run(`${process.platform === "win32" ? "del" : "rm -f"} ${archiveName}`);
