#!/usr/bin/env node
import { execSync } from "child_process";
import { mkdirSync, existsSync, writeFileSync, readFileSync } from "fs";
import { join } from "path";
import https from "https";

const BUILDS_DIR = join(process.cwd(), "builds");
const S3_LATEST = "https://seedappdev.s3.eu-west-2.amazonaws.com/dev/latest.json";

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

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const get = async (u) => {
      https.get(u, { headers: { "User-Agent": "seed-qa" } }, async (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location)
          return get(res.headers.location);
        const { createWriteStream } = await import("fs");
        const file = createWriteStream(dest);
        const total = parseInt(res.headers["content-length"] || "0", 10);
        let downloaded = 0;
        res.on("data", (chunk) => {
          downloaded += chunk.length;
          file.write(chunk);
          if (total > 0) process.stdout.write(`\r  ${((downloaded / total) * 100).toFixed(1)}%`);
        });
        res.on("end", () => {
          file.end();
          console.log("");
          resolve();
        });
        res.on("error", reject);
      }).on("error", reject);
    };
    get(url);
  });
}

async function main() {
  const platform = process.platform === "win32" ? "windows" : "linux";
  console.log(`[download] Platform: ${platform}`);

  const resp = await fetch(S3_LATEST);
  if (resp.status !== 200) {
    console.error(`Failed: HTTP ${resp.status}`);
    process.exit(1);
  }

  const latest = JSON.parse(resp.data);
  const version = latest.version || latest.tag_name || latest.name || "unknown";
  console.log(`[download] Latest: ${version}`);

  const files = latest.files || [];
  let asset;
  if (platform === "windows") {
    asset = files.find((f) => f.url?.endsWith(".exe"));
  } else {
    asset = files.find((f) => f.url?.endsWith(".AppImage") || f.url?.includes("AppImage"));
  }

  if (!asset) {
    console.error(`No ${platform} build found. Available: ${files.map((f) => f.url).join(", ")}`);
    process.exit(1);
  }

  mkdirSync(BUILDS_DIR, { recursive: true });
  const baseUrl = S3_LATEST.replace("/latest.json", "");
  const downloadUrl = asset.url.startsWith("http") ? asset.url : `${baseUrl}/${asset.url}`;
  const filename = asset.url.split("/").pop();
  const dest = join(BUILDS_DIR, filename);
  const metaPath = join(BUILDS_DIR, "current.json");

  if (existsSync(metaPath)) {
    const current = JSON.parse(readFileSync(metaPath, "utf-8"));
    if (current.version === version && existsSync(dest)) {
      console.log(`[download] Already have ${version}, skipping`);
      return;
    }
  }

  console.log(`[download] Downloading ${filename}...`);
  await download(downloadUrl, dest);

  writeFileSync(
    metaPath,
    JSON.stringify(
      { version, file: filename, path: dest, platform, downloadedAt: new Date().toISOString() },
      null,
      2
    )
  );
  console.log(`[download] ✅ Ready: ${dest}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
