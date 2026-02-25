import { _electron as electron } from "playwright";
import { join } from "path";
import { readFileSync, existsSync, cpSync, rmSync, mkdirSync } from "fs";
import { homedir } from "os";
import type { ElectronApplication, Page } from "playwright";

// Use process.cwd() — Playwright always runs from the project root
const META_PATH = join(process.cwd(), "builds", "current.json");

export interface AppContext {
  app: ElectronApplication;
  page: Page;
}

export async function launchApp(): Promise<AppContext> {
  if (!existsSync(META_PATH)) {
    throw new Error("No build found. Run: npm run download");
  }

  const meta = JSON.parse(readFileSync(META_PATH, "utf-8"));

  // On Linux the .deb is installed — use the system binary path.
  // On Windows the .exe is a self-contained launcher.
  const executablePath = meta.executablePath || meta.path;

  if (!existsSync(executablePath)) {
    throw new Error(
      `Build binary not found at: ${executablePath}\n` +
      `Run 'npm run download' to download and install the latest build.`
    );
  }

  // On Windows: kill any existing SeedDev instance before launching.
  // The app uses a single-instance lock and will exit immediately if another copy is running.
  if (process.platform === "win32") {
    const { spawnSync } = await import("child_process");
    const appName = executablePath.split("\\").pop()?.replace(".exe", "") || "SeedDev";
    spawnSync("taskkill", ["/F", "/IM", `${appName}.exe`], { encoding: "utf8" });
    // Brief pause to let the OS release the lock
    await new Promise((r) => setTimeout(r, 1000));
  }

  console.log(`[helpers] Launching: ${executablePath}`);

  const app = await electron.launch({
    executablePath,
    timeout: 30_000,
  });

  // firstWindow() may return a utility window (e.g. Find-in-Page).
  // Wait up to 10s for a window that isn't a known helper.
  let page = await app.firstWindow();
  await page.waitForLoadState("domcontentloaded").catch(() => {});

  const HELPER_PATTERNS = [/find[_-]?in[_-]?page/i, /find\.html/i, /splash/i];
  const isHelper = (url: string) => HELPER_PATTERNS.some((p) => p.test(url));

  if (isHelper(page.url())) {
    // Wait for the real main window (up to 15s)
    const deadline = Date.now() + 15_000;
    while (Date.now() < deadline) {
      const wins = app.windows();
      const main = wins.find((w) => !isHelper(w.url()));
      if (main) { page = main; break; }
      await new Promise((r) => setTimeout(r, 500));
    }
    await page.waitForLoadState("domcontentloaded").catch(() => {});
  }

  return { app, page };
}

export async function closeApp(ctx: AppContext) {
  await ctx.app.close().catch(() => {});
}

// ── Keychain reset helpers ────────────────────────────────────────────────────

function getSeedDataDir(): string {
  if (process.platform === "win32") {
    return join(process.env.APPDATA || join(homedir(), "AppData", "Roaming"), "Seed-dev");
  }
  return join(homedir(), ".config", "Seed-dev");
}

function getSeedDataBackupDir(): string {
  if (process.platform === "win32") {
    return join(process.env.APPDATA || join(homedir(), "AppData", "Roaming"), "Seed-dev-qa-backup");
  }
  return join(homedir(), ".config", "Seed-dev-qa-backup");
}

/** Items within the Seed data dir that constitute "account identity" */
const IDENTITY_ITEMS = ["SecureStore.json", "daemon"];

export function resetForFreshLaunch(): void {
  const dataDir = getSeedDataDir();
  const backupDir = getSeedDataBackupDir();

  // Remove any stale backup
  rmSync(backupDir, { recursive: true, force: true });
  mkdirSync(backupDir, { recursive: true });

  for (const item of IDENTITY_ITEMS) {
    const src = join(dataDir, item);
    const dest = join(backupDir, item);
    if (existsSync(src)) {
      cpSync(src, dest, { recursive: true });
      rmSync(src, { recursive: true, force: true });
    }
  }
  console.log("[helpers] Keychain reset: identity items backed up and removed.");
}

export function restoreAfterFreshLaunch(): void {
  const dataDir = getSeedDataDir();
  const backupDir = getSeedDataBackupDir();

  for (const item of IDENTITY_ITEMS) {
    const src = join(backupDir, item);
    const dest = join(dataDir, item);
    if (existsSync(src)) {
      // Remove any data created during the fresh-launch test
      rmSync(dest, { recursive: true, force: true });
      cpSync(src, dest, { recursive: true });
    }
  }
  rmSync(backupDir, { recursive: true, force: true });
  console.log("[helpers] Keychain restored from backup.");
}
