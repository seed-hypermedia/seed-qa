import { _electron as electron } from "playwright";
import { join } from "path";
import { readFileSync, existsSync } from "fs";
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

  console.log(`[helpers] Launching: ${executablePath}`);

  const app = await electron.launch({
    executablePath,
    // Give the app 30s to start before timing out
    timeout: 30_000,
  });

  const page = await app.firstWindow();
  await page.waitForLoadState("domcontentloaded").catch(() => {});

  return { app, page };
}

export async function closeApp(ctx: AppContext) {
  await ctx.app.close().catch(() => {});
}
