#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { execSync } from "child_process";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { platform } from "os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const RESULTS_PATH = join(ROOT, "reports", "results.json");
const WEB_RESULTS_PATH = join(ROOT, "reports", "web-results.json");
const BUILDS_PATH = join(ROOT, "builds", "current.json");
const REPO = process.env.SEED_QA_REPO || "seed-hypermedia/seed";

const buildInfo = existsSync(BUILDS_PATH)
  ? JSON.parse(readFileSync(BUILDS_PATH, "utf-8"))
  : { version: "unknown" };

const os = platform() === "win32" ? "Windows" : "Linux";
const failures = [];

function collectFailures(results, source) {
  if (!results) return;
  function walkSuite(suite) {
    for (const spec of suite.specs || []) {
      for (const test of spec.tests || []) {
        const last = (test.results || []).slice(-1)[0];
        if (last && last.status !== "passed" && last.status !== "skipped") {
          failures.push({
            name: spec.title,
            suite: suite.title,
            file: spec.file || source,
            error: last.errors?.[0]?.message || "Unknown error",
            snippet: last.errors?.[0]?.snippet || "",
          });
        }
      }
    }
    for (const child of suite.suites || []) walkSuite(child);
  }
  (results.suites || []).forEach(walkSuite);
}

collectFailures(
  existsSync(RESULTS_PATH) ? JSON.parse(readFileSync(RESULTS_PATH, "utf-8")) : null,
  "desktop"
);
collectFailures(
  existsSync(WEB_RESULTS_PATH) ? JSON.parse(readFileSync(WEB_RESULTS_PATH, "utf-8")) : null,
  "web"
);

if (failures.length === 0) {
  console.log("✅ No failures");
  process.exit(0);
}

console.log(`❌ ${failures.length} failure(s)...`);
mkdirSync(join(ROOT, "reports", "issues"), { recursive: true });

// Use platform-appropriate shell for .sh scripts
const IS_WINDOWS = process.platform === "win32";
const BASH = IS_WINDOWS ? "bash" : "/bin/bash"; // bash via Git for Windows on Win, system bash on Linux

for (const fail of failures) {
  const title = `[QA/${os}] ${fail.name}`;
  const body = `### Environment\n- **Platform:** ${os}\n- **Build:** ${buildInfo.version}\n- **Date:** ${new Date().toISOString().split("T")[0]}\n\n### What happened\n\`${fail.name}\` in \`${fail.file}\` failed.\n\n### Error\n\`\`\`\n${fail.error}\n\`\`\`\n\n---\n*Automated report by Sprout 🌱*`;
  const bodyFile = join(ROOT, "reports", "issues", `${fail.name.replace(/[^a-z0-9]/gi, "-")}.md`);
  writeFileSync(bodyFile, body);
  try {
    const result = execSync(
      `"${BASH}" scripts/create-issue.sh "${title.replace(/"/g, '\\"')}" "${bodyFile}"`,
      { encoding: "utf-8", cwd: ROOT }
    );
    console.log(result.trim());
  } catch (e) {
    console.error(`Failed: ${e.message}`);
  }
}
