#!/usr/bin/env node
/**
 * download-build.mjs
 * Downloads and installs the latest Seed dev build.
 *
 * Linux: downloads .deb → installs via sudo dpkg -i → detects binary path
 * Windows: downloads .exe → records path for manual install or Playwright launch
 */
import { spawnSync } from "child_process";
import { mkdirSync, existsSync, writeFileSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import https from "https";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUILDS_DIR = join(__dirname, "..", "builds");
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

import { createWriteStream } from "fs";

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const get = (u) => {
      https.get(u, { headers: { "User-Agent": "seed-qa" } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location)
          return get(res.headers.location);
        const file = createWriteStream(dest);
        const total = parseInt(res.headers["content-length"] || "0", 10);
        let downloaded = 0;
        res.on("data", (chunk) => {
          downloaded += chunk.length;
          file.write(chunk);
          if (total > 0)
            process.stdout.write(`\r  Downloading: ${((downloaded / total) * 100).toFixed(1)}% (${(downloaded / 1e6).toFixed(1)} MB)`);
        });
        res.on("end", () => { file.end(); console.log(""); resolve(); });
        res.on("error", reject);
      }).on("error", reject);
    };
    get(url);
  });
}

/** Extract package name from .deb filename, e.g. "seed-dev_2026.2.6-dev.3_amd64.deb" → "seed-dev" */
function debPackageName(filename) {
  return filename.split("_")[0];
}

/**
 * Extracts a .deb without installing (no sudo needed).
 * Uses `dpkg-deb --extract <deb> <destDir>`.
 * Returns the path to the main executable inside the extracted tree.
 */
function extractDeb(debPath, extractDir) {
  mkdirSync(extractDir, { recursive: true });

  const result = spawnSync("dpkg-deb", ["--extract", debPath, extractDir], { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`dpkg-deb --extract failed: ${result.stderr}`);
  }

  // Search for the main binary: prefer usr/bin/, then usr/lib/*/<AppName>, then opt/*/
  const findResult = spawnSync("bash", [
    "-c",
    `find "${extractDir}/usr/bin" -type f 2>/dev/null | head -1 || ` +
    `find "${extractDir}/usr/lib" -maxdepth 2 -type f ! -name "*.so*" ! -name "*.pak" ! -name "*.dat" ! -name "*.html" ! -name "*.bin" ! -name "*.json" ! -name "version" -executable 2>/dev/null | grep -v crashpad | grep -v sandbox | head -1 || ` +
    `find "${extractDir}/opt" -maxdepth 3 -type f -executable 2>/dev/null | head -1`,
  ], { encoding: "utf8" });

  const binary = (findResult.stdout || "").trim();
  if (binary) {
    spawnSync("chmod", ["+x", binary]);
    return binary;
  }
  return null;
}

async function main() {
  const platform = process.platform === "win32" ? "windows" : "linux";
  console.log(`[download] Platform: ${platform}`);
  console.log(`[download] Fetching latest build info...`);

  const resp = await fetch(S3_LATEST);
  if (resp.status !== 200) {
    console.error(`[download] Failed to fetch latest.json: HTTP ${resp.status}`);
    process.exit(1);
  }

  const latest = JSON.parse(resp.data);
  const version = latest.version || latest.tag_name || latest.name || "unknown";
  console.log(`[download] Latest version: ${version}`);

  // ── Select the right asset ──────────────────────────────────────────────
  let downloadUrl;
  if (platform === "linux") {
    downloadUrl = latest.assets?.linux?.deb?.download_url;
    if (!downloadUrl) {
      console.error("[download] No Linux .deb found in latest.json");
      console.error("[download] Available:", JSON.stringify(Object.keys(latest.assets?.linux || {})));
      process.exit(1);
    }
  } else {
    downloadUrl = latest.assets?.win32?.x64?.download_url;
    if (!downloadUrl) {
      console.error("[download] No Windows .exe found in latest.json");
      process.exit(1);
    }
  }

  mkdirSync(BUILDS_DIR, { recursive: true });

  const filename = downloadUrl.split("/").pop();
  const dest = join(BUILDS_DIR, filename);
  const metaPath = join(BUILDS_DIR, "current.json");

  // ── Skip if already extracted/downloaded at same version ──────────────
  const extractDir = join(BUILDS_DIR, "extracted");
  if (existsSync(metaPath)) {
    const current = JSON.parse(readFileSync(metaPath, "utf-8"));
    if (current.version === version) {
      const binaryExists = current.executablePath && existsSync(current.executablePath);
      if (binaryExists) {
        console.log(`[download] ✅ Already have ${version} → ${current.executablePath}`);
        return;
      }
      console.log(`[download] Version matches but binary missing — re-extracting`);
    }
  }

  // ── Download ────────────────────────────────────────────────────────────
  console.log(`[download] Downloading ${filename}...`);
  await download(downloadUrl, dest);

  // ── Extract .deb (Linux, no sudo needed) ──────────────────────────────
  let executablePath = dest;

  if (platform === "linux") {
    console.log(`[download] Extracting ${filename} (no sudo needed)...`);
    try {
      const binary = extractDeb(dest, extractDir);
      if (binary) {
        executablePath = binary;
        console.log(`[download] ✅ Extracted binary: ${binary}`);
      } else {
        console.warn(`[download] ⚠️ Could not find binary in extracted .deb — check builds/extracted/`);
      }
    } catch (e) {
      console.error(`[download] ⚠️ Extraction failed: ${e.message}`);
    }
  }

  // ── Write metadata ──────────────────────────────────────────────────────
  writeFileSync(metaPath, JSON.stringify({
    version,
    file: filename,
    path: dest,
    executablePath,
    platform,
    downloadedAt: new Date().toISOString(),
  }, null, 2));

  console.log(`[download] ✅ Ready — executablePath: ${executablePath}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
