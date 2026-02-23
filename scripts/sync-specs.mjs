#!/usr/bin/env node
/**
 * sync-specs.mjs
 * 
 * Pulls the latest specs from the shared seed-qa repo (seed-hypermedia/seed-qa)
 * and applies any changes. Called at the start of every full-run.
 * 
 * Exit codes:
 *   0 — synced successfully (or already up to date)
 *   1 — sync failed (non-fatal: we continue with existing files)
 */

import { spawnSync } from "child_process";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { existsSync, readFileSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO = "seed-hypermedia/seed-qa";

function run(cmd, opts = {}) {
  return spawnSync("cmd", ["/c", cmd], {
    encoding: "utf8",
    cwd: ROOT,
    env: { ...process.env },
    ...opts,
  });
}

async function main() {
  // Check if we're inside a git repo
  const status = run("git rev-parse --is-inside-work-tree");
  if (status.status !== 0) {
    console.log("[sync] Not a git repo — nothing to sync");
    process.exit(0);
  }

  // Set remote URL with auth token
  if (GITHUB_TOKEN) {
    run(`git remote set-url origin https://seed-germinator:${GITHUB_TOKEN}@github.com/${REPO}.git`);
  }

  // Get current HEAD before pulling
  const before = run("git rev-parse HEAD");
  const beforeHash = (before.stdout || "").trim();

  // Pull latest
  console.log("[sync] Pulling latest specs from seed-hypermedia/seed-qa...");
  const pull = run("git pull origin main --ff-only");

  if (pull.status !== 0) {
    console.warn("[sync] ⚠️ Pull failed (local changes may conflict):");
    console.warn(pull.stderr);
    process.exit(1);
  }

  // Get HEAD after pulling
  const after = run("git rev-parse HEAD");
  const afterHash = (after.stdout || "").trim();

  if (beforeHash === afterHash) {
    console.log("[sync] ✅ Already up to date");
  } else {
    // Show what changed
    const diff = run(`git diff --name-only ${beforeHash} ${afterHash}`);
    const changed = (diff.stdout || "").trim().split("\n").filter(Boolean);
    console.log(`[sync] ✅ Updated (${beforeHash.slice(0, 7)} → ${afterHash.slice(0, 7)})`);
    console.log(`[sync] Changed files:\n  ${changed.join("\n  ")}`);

    // If SPECS.md changed, log a reminder to review new/changed test descriptions
    if (changed.includes("SPECS.md")) {
      console.log("[sync] 📋 SPECS.md changed — review new test descriptions");
    }
  }

  process.exit(0);
}

main().catch((e) => {
  console.error("[sync] Error:", e.message);
  process.exit(1);
});
