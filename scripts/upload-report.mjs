#!/usr/bin/env node
/**
 * upload-report.mjs
 *
 * Compresses reports/ and test-results/ into a tar.gz, then creates a GitHub
 * Release on seed-hypermedia/seed-qa so the artifacts are accessible from
 * anywhere. Writes the release URL back into reports/summary.json so that
 * discord-notify.mjs can embed the link.
 *
 * Auth: uses GH_TOKEN_QA if set (recommended — seed-germinator OAuth token with
 * push access to seed-qa). If not set, falls back to gh CLI's own stored
 * credentials so that machines where `gh auth login` was already run work
 * automatically after a plain `git pull`, with no extra env var setup needed.
 *
 * NOTE: GH_TOKEN and GITHUB_TOKEN are intentionally NOT used as a fallback
 * because the value typically set in the environment is a weaker PAT
 * (public_repo only) that cannot create releases on seed-qa.
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

/**
 * Build the env object to pass to gh commands.
 * If GH_TOKEN_QA is set, use it explicitly.
 * Otherwise, strip GH_TOKEN and GITHUB_TOKEN so gh falls back to its own
 * stored credentials (set up via `gh auth login` during machine bootstrap).
 */
function ghEnv() {
  if (process.env.GH_TOKEN_QA) {
    return { ...process.env, GH_TOKEN: process.env.GH_TOKEN_QA, GITHUB_TOKEN: process.env.GH_TOKEN_QA };
  }
  // Use gh's stored auth — remove any weak token overrides from the env
  const env = { ...process.env };
  delete env.GH_TOKEN;
  delete env.GITHUB_TOKEN;
  return env;
}

function run(cmd, opts = {}) {
  log(`▶ ${cmd}`);
  execSync(cmd, { stdio: "inherit", cwd: PROJECT_ROOT, env: ghEnv(), ...opts });
}

// ── preflight: verify gh can authenticate ────────────────────────────────────

if (!existsSync(SUMMARY_PATH)) {
  log("No summary found (reports/summary.json missing), skipping upload");
  process.exit(0);
}

if (!ghAvailable()) {
  log("gh CLI not found, skipping upload");
  process.exit(0);
}

const authCheck = spawnSync("gh", ["auth", "status"], { encoding: "utf8", env: ghEnv() });
if (authCheck.status !== 0) {
  log("gh is not authenticated — skipping upload");
  log("Run `gh auth login` on this machine or set GH_TOKEN_QA in the environment.");
  process.exit(0);
}

// ── main ─────────────────────────────────────────────────────────────────────

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
    --notes "${relNotes}"`
);

// Read the release URL that gh just created
const urlResult = spawnSync(
  "gh",
  ["release", "view", tag, "--repo", QA_REPO, "--json", "url", "--jq", ".url"],
  { encoding: "utf8", env: ghEnv() }
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
