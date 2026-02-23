#!/usr/bin/env node
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import https from "https";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const S3_LATEST = "https://seedappdev.s3.eu-west-2.amazonaws.com/dev/latest.json";
const LAST_TESTED_PATH = join(ROOT, "reports", "last-tested.json");

function fetch(url) {
  return new Promise((resolve, reject) => {
    const get = (u) => {
      https.get(u, { headers: { "User-Agent": "seed-qa" } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location)
          return get(res.headers.location);
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => resolve({ status: res.statusCode, data }));
      }).on("error", reject);
    };
    get(url);
  });
}

async function main() {
  const resp = await fetch(S3_LATEST);
  if (resp.status !== 200) {
    console.error(`Failed: HTTP ${resp.status}`);
    process.exit(2);
  }

  const latest = JSON.parse(resp.data);
  const latestVersion = latest.version || latest.tag_name || latest.name || "unknown";

  if (!existsSync(LAST_TESTED_PATH)) {
    console.log(`NEW: ${latestVersion} (no prior test record)`);
    process.stdout.write(latestVersion);
    process.exit(0);
  }

  const lastTested = JSON.parse(readFileSync(LAST_TESTED_PATH, "utf-8"));
  if (lastTested.version === latestVersion) {
    process.stderr.write(`SAME: ${latestVersion} already tested at ${lastTested.testedAt}\n`);
    process.exit(1);
  }

  console.log(`NEW: ${latestVersion} (last tested: ${lastTested.version})`);
  process.stdout.write(latestVersion);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
