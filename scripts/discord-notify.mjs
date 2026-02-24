#!/usr/bin/env node
import https from "https";
import { URL } from "url";

const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

if (!WEBHOOK_URL || WEBHOOK_URL === "PLACEHOLDER_SET_ME") {
  console.log("Discord: no webhook set, skipping");
  process.exit(0);
}

let summary;
try {
  summary = JSON.parse(process.argv[2] || "{}");
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
} = summary;

const allPassed = (desktop.failed || 0) === 0 && (web.chrome?.failed || 0) === 0;
const onlyFirefox =
  !allPassed &&
  (desktop.failed || 0) === 0 &&
  (web.chrome?.failed || 0) === 0;
const statusEmoji = allPassed ? "✅" : onlyFirefox ? "⚠️" : "❌";
const platformLabel = platform === "windows" || platform === "win32" ? "🪟 Windows" : platform === "linux" ? "🐧 Linux" : platform;

const lines = [
  `${statusEmoji} **Seed QA — v${version} [${platformLabel}]**`,
  ``,
  `🖥️ Desktop: ${desktop.passed || 0}/${desktop.total || 0} | 🌐 Chrome: ${web.chrome?.passed || 0}/${web.chrome?.total || 0} | 🦊 Firefox: ${web.firefox?.passed || 0}/${web.firefox?.total || 0}`,
  ``,
  (issues.filed || 0) > 0
    ? `📋 ${issues.filed} new issue(s) filed`
    : `📋 No new issues`,
  prs.length > 0 ? `🔧 ${prs.length} draft PR(s): ${prs.join(", ")}` : null,
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
