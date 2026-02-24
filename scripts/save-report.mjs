#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const RUNS_DIR = join(ROOT, "reports", "runs");
const INDEX_PATH = join(ROOT, "reports", "index.json");
const SUMMARY_PATH = join(ROOT, "reports", "summary.json");

mkdirSync(RUNS_DIR, { recursive: true });

let summary;
try {
  // Prefer reading from reports/summary.json (avoids shell quoting issues on Windows)
  if (existsSync(SUMMARY_PATH)) {
    summary = JSON.parse(readFileSync(SUMMARY_PATH, "utf-8"));
  } else if (process.argv[2]) {
    summary = JSON.parse(process.argv[2]);
  } else {
    console.error("No summary found (reports/summary.json missing and no argv[2])");
    process.exit(1);
  }
} catch {
  console.error("Invalid JSON");
  process.exit(1);
}

const { version = "unknown", startedAt = new Date().toISOString() } = summary;
const ts = new Date(startedAt).toISOString().replace(/[:.]/g, "-").slice(0, 16);
const slug = `${ts}-${version}`.replace(/[^a-z0-9-]/gi, "-");

writeFileSync(join(RUNS_DIR, `${slug}.json`), JSON.stringify(summary, null, 2));

const md = [
  `# Seed QA Run — ${version}`,
  `**Date:** ${startedAt}`,
  `**Platform:** ${summary.platform || "?"}`,
  ``,
  `## Results`,
  `- 🖥️ Desktop: ${summary.desktop?.passed || 0}/${summary.desktop?.total || 0} passed`,
  `- 🌐 Chrome: ${summary.web?.chrome?.passed || 0}/${summary.web?.chrome?.total || 0} passed`,
  `- 🦊 Firefox: ${summary.web?.firefox?.passed || 0}/${summary.web?.firefox?.total || 0} passed`,
  ``,
  `## Issues`,
  `- Filed: ${summary.issues?.filed || 0}`,
  `- Closed: ${summary.issues?.closed || 0}`,
  summary.prs?.length ? `\n## Draft PRs\n${summary.prs.join("\n")}` : "",
].join("\n");

writeFileSync(join(RUNS_DIR, `${slug}.md`), md);

const index = existsSync(INDEX_PATH)
  ? JSON.parse(readFileSync(INDEX_PATH, "utf-8"))
  : [];
index.unshift({
  version,
  platform: summary.platform,
  startedAt,
  finishedAt: summary.finishedAt,
  desktop: summary.desktop,
  web: summary.web,
  issues: summary.issues,
  prs: summary.prs,
});
writeFileSync(INDEX_PATH, JSON.stringify(index.slice(0, 50), null, 2));

console.log(`✅ Report saved: reports/runs/${slug}.md`);
