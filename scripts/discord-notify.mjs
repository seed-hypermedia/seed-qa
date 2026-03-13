#!/usr/bin/env node
import https from "https";
import { URL } from "url";
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SUMMARY_PATH = join(__dirname, "..", "reports", "summary.json");

const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

if (!WEBHOOK_URL || WEBHOOK_URL === "PLACEHOLDER_SET_ME") {
  console.log("Discord: no webhook set, skipping");
  process.exit(0);
}

let summary;
try {
  // Prefer reading from reports/summary.json (avoids shell quoting issues on Windows)
  if (existsSync(SUMMARY_PATH)) {
    summary = JSON.parse(readFileSync(SUMMARY_PATH, "utf-8"));
  } else if (process.argv[2]) {
    summary = JSON.parse(process.argv[2]);
  } else {
    console.error("No summary found (reports/summary.json missing and no argv[2])");
    process.exit(0);
  }
} catch {
  console.error("Invalid summary JSON");
  process.exit(0);
}

const {
  version = "?",
  platform = "?",
  startedAt = "",
  desktop = {},
  web = {},
  issues = {},
  prs = [],
  reportUrl = null,
} = summary;

const allPassed = (desktop.failed || 0) === 0 && (web.chrome?.failed || 0) === 0;
const onlyFirefox =
  !allPassed &&
  (desktop.failed || 0) === 0 &&
  (web.chrome?.failed || 0) === 0;
const statusEmoji = allPassed ? "✅" : onlyFirefox ? "⚠️" : "❌";
const platformLabel = platform === "windows" || platform === "win32" ? "Windows" : platform === "linux" ? "Linux" : platform;

// Collect failing test names from JSON results for a brief summary
function collectFailures(resultsPath) {
  if (!existsSync(resultsPath)) return [];
  try {
    const data = JSON.parse(readFileSync(resultsPath, "utf-8"));
    const failures = [];
    function walk(suite) {
      for (const spec of suite.specs || []) {
        for (const test of spec.tests || []) {
          const last = (test.results || []).slice(-1)[0];
          if (last && last.status !== "passed" && last.status !== "skipped") {
            failures.push(`• ${spec.title} [${test.projectName || "?"}]`);
          }
        }
      }
      for (const child of suite.suites || []) walk(child);
    }
    (data.suites || []).forEach(walk);
    return failures;
  } catch {
    return [];
  }
}

import { join as pathJoin, dirname as pathDirname } from "path";
const REPORTS_DIR = pathJoin(pathDirname(fileURLToPath(import.meta.url)), "..", "reports");
const desktopFailures = collectFailures(pathJoin(REPORTS_DIR, "results.json"));
const webFailures = collectFailures(pathJoin(REPORTS_DIR, "web-results.json"));
const allFailures = [...desktopFailures, ...webFailures].slice(0, 8); // cap at 8 to avoid wall of text

const lines = [
  `${statusEmoji} **Seed QA — v${version} (${platformLabel})**`,
  ``,
  `🖥️ Desktop: ${desktop.passed || 0}/${desktop.total || 0} | 🌐 Chrome: ${web.chrome?.passed || 0}/${web.chrome?.total || 0} | 🦊 Firefox: ${web.firefox?.passed || 0}/${web.firefox?.total || 0}`,
  allFailures.length > 0 ? `\n**Failed tests:**\n${allFailures.join("\n")}` : null,
  ``,
  (issues.filed || 0) > 0
    ? `📋 ${issues.filed} new issue(s) filed`
    : `📋 No new issues`,
  prs.length > 0 ? `🔧 ${prs.length} draft PR(s): ${prs.join(", ")}` : null,
  reportUrl ? `📊 [Full report + artifacts](${reportUrl})` : null,
  ``,
  `⏱️ ${startedAt}`,
]
  .filter(Boolean)
  .join("\n");

const body = JSON.stringify({ content: lines, username: "Sprout QA 🌱" });
const url = new URL(WEBHOOK_URL);

const req = https.request(
  {
    hostname: url.hostname,
    path: url.pathname + url.search,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(body),
    },
  },
  (res) => {
    res.on("data", () => {});
    res.on("end", () => console.log(`Discord: HTTP ${res.statusCode}`));
  }
);
req.on("error", (e) => console.error(`Discord failed: ${e.message}`));
req.write(body);
req.end();
