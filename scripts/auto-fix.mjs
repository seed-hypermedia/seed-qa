#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";
import { homedir } from "os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SEED_REPO = join(homedir(), "seed-hypermedia", "seed");
const LOG_PATH = join(ROOT, "reports", "auto-fix-log.json");
const IS_WINDOWS = process.platform === "win32";
const SHELL = IS_WINDOWS ? "cmd" : "bash";
const SHELL_FLAG = IS_WINDOWS ? "/c" : "-c";

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const SEED_QA_REPO = process.env.SEED_QA_REPO || "seed-hypermedia/seed";

function run(cmd, cwd) {
  return spawnSync(SHELL, [SHELL_FLAG, cmd], {
    encoding: "utf8",
    cwd: cwd || SEED_REPO,
    env: { ...process.env },
  });
}

function loadJSON(p) {
  if (!existsSync(p)) return null;
  try { return JSON.parse(readFileSync(p, "utf8")); } catch { return null; }
}

function extractFailures(results) {
  if (!results) return [];
  const failures = [];
  function walkSuite(suite) {
    for (const spec of suite.specs || []) {
      for (const test of spec.tests || []) {
        const failed = (test.results || []).some((r) => r.status === "failed");
        if (failed)
          failures.push({
            title: spec.title,
            errors: (test.results || [])
              .filter((r) => r.status === "failed")
              .flatMap((r) => (r.errors || []).map((e) => e.message || "")),
          });
      }
    }
    for (const child of suite.suites || []) walkSuite(child);
  }
  (results.suites || []).forEach(walkSuite);
  return failures;
}

async function main() {
  const allFailures = [
    ...extractFailures(loadJSON(join(ROOT, "reports", "web-results.json"))),
    ...extractFailures(loadJSON(join(ROOT, "reports", "results.json"))),
  ];

  if (allFailures.length === 0) {
    console.log("✅ No failures to auto-fix");
    writeFileSync(LOG_PATH, "[]");
    process.exit(0);
  }

  const seoFailure = allFailures.find(
    (f) => f.title.includes("W2-06") || f.title.toLowerCase().includes("seo")
  );
  const log_entries = [];

  if (seoFailure) {
    console.log("🔧 Attempting W2-06 SEO title fix...");
    const attempt = {
      pattern: "W2-06-seo-title",
      started: new Date().toISOString(),
      success: false,
      notes: [],
      prUrl: null,
    };

    if (GITHUB_TOKEN)
      run(
        `git remote set-url origin https://seed-germinator:${GITHUB_TOKEN}@github.com/${SEED_QA_REPO}.git`
      );

    const pull = run("git pull origin main --ff-only");
    if (pull.status !== 0) {
      attempt.notes.push(`pull failed: ${pull.stderr}`);
      log_entries.push(attempt);
    } else {
      const emptyTitles = run(
        `git grep -l "<title></title>" -- "*.html" 2>/dev/null | head -5`
      );
      const files = (emptyTitles.stdout || "").split("\n").filter(Boolean);

      if (files.length > 0) {
        run(`git checkout -b qa/fix-W2-06-seo-title 2>/dev/null || git checkout qa/fix-W2-06-seo-title`);
        let changed = false;
        for (const f of files) {
          const p = join(SEED_REPO, f);
          const content = readFileSync(p, "utf8").replace(
            "<title></title>",
            "<title>Seed Hypermedia</title>"
          );
          writeFileSync(p, content);
          run(`git add "${f}"`);
          changed = true;
        }
        if (changed) {
          run(`git commit -m "fix: add page title for SEO [QA auto-fix]"`);
          const push = run(`git push origin qa/fix-W2-06-seo-title --force-with-lease`);
          if (push.status === 0) {
            const pr = run(
              `gh pr create --repo "${SEED_QA_REPO}" --draft --assignee horacioh --title "fix: add page title for SEO" --body "QA auto-fix: W2-06 empty title tag" --head qa/fix-W2-06-seo-title`
            );
            if (pr.status === 0) {
              attempt.prUrl = pr.stdout.trim();
              attempt.success = true;
              process.stdout.write(`PR_URL: ${attempt.prUrl}\n`);
            }
          }
        }
      } else {
        attempt.notes.push("No empty title tags found");
      }
      log_entries.push(attempt);
    }
  } else {
    console.log("ℹ️ No auto-fixable patterns detected");
  }

  writeFileSync(LOG_PATH, JSON.stringify(log_entries, null, 2));
}

main().catch((e) => {
  console.error(e);
  writeFileSync(LOG_PATH, JSON.stringify([{ error: e.message }]));
  process.exit(0);
});
