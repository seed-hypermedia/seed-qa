# Sprout (Windows) 🪟 — Setup Guide

Complete setup for the Windows QA bot. Follow steps in order on a fresh Windows machine.

---

## Prerequisites

Install these before starting:

| Tool | Install | Min version |
|------|---------|-------------|
| Node.js | https://fnm.vercel.app or https://nodejs.org | v18+ |
| Git | https://git-scm.com | any |
| GitHub CLI (`gh`) | https://cli.github.com | any |
| OpenClaw | `npm install -g openclaw` | latest |

Verify:
```powershell
node --version
git --version
gh --version
openclaw --version
```

Also confirm Git Bash is available (installed with Git for Windows) — the QA scripts use bash shebang lines.

---

## 1. Run the OpenClaw wizard

```powershell
openclaw wizard
```

- Choose **local** mode
- Set your workspace to `%USERPROFILE%\.openclaw\workspace`
- Add your Anthropic API key when prompted

---

## 2. Clone seed-qa

```powershell
cd $env:USERPROFILE\.openclaw\workspace
git clone https://github.com/seed-hypermedia/seed-qa.git seed-qa
cd seed-qa
npm install
npx playwright install chromium firefox
```

---

## 3. Set up workspace identity files

Create these files in `%USERPROFILE%\.openclaw\workspace\`:

**`IDENTITY.md`**
```markdown
# IDENTITY.md - Who Am I?

- **Name:** Sprout (Windows)
- **Creature:** QA bot — relentless bug-hunter running on Windows
- **Vibe:** Methodical but sharp. I notice things. I break things (on purpose). I write it all down.
- **Emoji:** 🪟
- **Purpose:** Test Seed Hypermedia (desktop + web) on Windows. Find issues. Open GitHub issues. Keep quality high.

I am Sprout (Windows). I run the app, poke it, prod it, and report what breaks.
```

**`USER.md`**
```markdown
# USER.md - About Your Human

- **Name:** Horacio
- **Timezone:** GMT+1 (Europe)
- **Notes:** Developer/owner working on Seed Hypermedia
```

**`TOOLS.md`** — copy from Linux workspace and update Windows-specific paths:
```markdown
### GitHub
- Repo: `seed-hypermedia/seed`
- Token: stored in `SECRETS.md` as `GITHUB_TOKEN`

### Seed QA
- QA repo: %USERPROFILE%\.openclaw\workspace\seed-qa\
- Run full QA: cd %USERPROFILE%\.openclaw\workspace\seed-qa && npm run full-run
- Force run (skip version check): npm run full-run -- --force
```

**`SECRETS.md`** — create this and keep it private:
```markdown
# SECRETS.md — DO NOT COMMIT

GITHUB_TOKEN=ghp_your_token_here
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
```

For `GITHUB_TOKEN`: generate a PAT at https://github.com/settings/tokens with `public_repo` scope on the `seed-germinator` account (or your own).

For `DISCORD_WEBHOOK_URL`: create a webhook in your Discord channel settings → Integrations → Webhooks.

---

## 4. Configure OpenClaw (Discord + agent identity)

Edit `%USERPROFILE%\.openclaw\openclaw.json` and add/merge:

```json
{
  "channels": {
    "discord": {
      "enabled": true,
      "token": "WINDOWS_BOT_TOKEN_HERE",
      "groupPolicy": "allowlist",
      "guilds": {
        "631404144640393217": {
          "channels": {
            "1475503759575482402": {
              "allow": true,
              "requireMention": true
            }
          }
        }
      }
    }
  }
}
```

Replace `WINDOWS_BOT_TOKEN_HERE` with the token from your Windows Discord bot (must be a **separate bot** from the Linux one — two instances can't share the same token).

Then restart the gateway:
```powershell
openclaw gateway restart
```

---

## 5. Create the QA cron job

Run this once to register the release watcher:

```powershell
openclaw cron add `
  --name "Seed QA — Release Watcher (Windows)" `
  --every 7200000 `
  --session-target isolated `
  --message "You are Sprout (Windows) 🪟, the Seed Hypermedia QA bot running on Windows. Run the Seed QA release check: cd $env:USERPROFILE\.openclaw\workspace\seed-qa && npm run full-run. If tests ran, report the summary. If no new build, reply NO_NEW_BUILD. Sign off as Sprout (Windows) 🪟" `
  --timeout 1800 `
  --delivery-channel discord `
  --delivery-to channel:1475503759575482402
```

Or add it via the OpenClaw web UI at http://localhost:18789.

---

## 6. Create the Discord bot

1. Go to https://discord.com/developers/applications → **New Application**
2. Name it `Seed QA (Windows)` or similar
3. Go to **Bot** → **Add Bot** → copy the token → paste it into the OpenClaw config above
4. Under **Privileged Gateway Intents**, enable:
   - ✅ Message Content Intent
   - ✅ Server Members Intent
5. Go to **OAuth2 → URL Generator**:
   - Scopes: `bot`, `applications.commands`
   - Permissions: View Channels, Send Messages, Read Message History, Add Reactions, Attach Files, Embed Links
6. Copy the generated URL, open it in a browser, invite the bot to the Seed server

---

## 7. Verify the setup

Force a full QA run to confirm everything works:

```powershell
cd $env:USERPROFILE\.openclaw\workspace\seed-qa
npm run full-run -- --force
```

Expected output:
- Downloads the latest Seed Windows build
- Runs desktop tests (Playwright + Electron)
- Runs web tests (Chrome + Firefox)
- Posts results to Discord
- Creates GitHub issues for any failures

---

## Windows-specific notes

| Topic | Linux | Windows |
|-------|-------|---------|
| Build format | `.deb` | `.exe` (NSIS installer) |
| App data dir | `~/.config/Seed-dev/` | `%APPDATA%\Seed-dev\` |
| Binary location | `/usr/lib/seed-dev/SeedDev` | `%LOCALAPPDATA%\Programs\Seed-dev\Seed-dev.exe` |
| Keychain reset backup | `~/.config/Seed-dev-qa-backup/` | `%APPDATA%\Seed-dev-qa-backup\` |
| Install command | `dpkg -i` | Silent NSIS: `installer.exe /S` |
| Kill app | `pkill seed-dev` | `taskkill /IM Seed-dev.exe /F` |

The `helpers.ts` `resetForFreshLaunch()` and `restoreAfterFreshLaunch()` functions already handle Windows paths via `process.platform === "win32"`.

---

## Quick reference: what each machine does

| | Linux 🌱 | Windows 🪟 |
|---|---|---|
| Desktop tests | `.deb` on Linux | `.exe` on Windows |
| Web tests | Chrome + Firefox | Chrome + Firefox |
| Discord bot | Bot A (separate token) | Bot B (separate token) |
| QA channel | same channel | same channel |
| GitHub issues | ✅ | ✅ |
