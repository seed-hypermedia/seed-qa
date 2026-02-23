import { _electron as electron } from "playwright";
import { join } from "path";
import { readFileSync, existsSync } from "fs";
import { ElectronApplication, Page } from "playwright";

export interface AppContext {
  app: ElectronApplication;
  page: Page;
}

export async function launchApp(): Promise<AppContext> {
  const metaPath = join(process.cwd(), "builds", "current.json");
  if (!existsSync(metaPath)) {
    throw new Error("No build found. Run: npm run download");
  }
  const meta = JSON.parse(readFileSync(metaPath, "utf-8"));
  const app = await electron.launch({ args: [meta.path] });
  const page = await app.firstWindow();
  await page.waitForLoadState("domcontentloaded").catch(() => {});
  return { app, page };
}

export async function closeApp(ctx: AppContext) {
  await ctx.app.close().catch(() => {});
}
