# Seed QA — Reporting Specification

This document defines the standard format and requirements for QA result reporting,
so that all bots (Windows, Linux, macOS) produce consistent, identifiable output.

---

## Discord Webhook Format

Every QA run must post a message to the shared Discord webhook. The format is:

```
{status_emoji} **Seed QA — v{version} ({platform_label})**

🖥️ Desktop: {passed}/{total} | 🌐 Chrome: {passed}/{total} | 🦊 Firefox: {passed}/{total}

📋 {N new issue(s) filed | No new issues}
[🔧 N draft PR(s): {urls}]

⏱️ {ISO-8601 timestamp}
```

### Status emoji
| Condition | Emoji |
|---|---|
| All tests passed | ✅ |
| Only Firefox failures | ⚠️ |
| Any Chrome or desktop failure | ❌ |

### Platform label

Each bot **must** identify its platform clearly. Use the values below exactly:

| Platform | Label in message |
|---|---|
| Windows | `Windows` |
| Linux | `Linux` |
| macOS | `macOS` |

Example output:
```
✅ **Seed QA — v2026.2.6-dev.3 (Windows)**

🖥️ Desktop: 7/7 | 🌐 Chrome: 14/14 | 🦊 Firefox: 14/14

📋 No new issues

⏱️ 2026-02-24T08:00:00.000Z
```

### Discord username

All bots post using the username `Sprout QA 🌱`.

---

## GitHub Issues

When a test fails, the bot must:
1. Search for an existing open issue with the same test ID
2. If none exists, file a new issue with:
   - Title: `[{platform}] {test-id}: {short description}`
   - Body: failure details, screenshot if available, build version
   - Labels: `bug`, `qa-auto`, and the platform label (`platform:windows`, `platform:linux`, etc.)
3. If the issue already exists, add a comment with the new failure details

---

## Trigger conditions

| Run type | Trigger | Notes |
|---|---|---|
| Release watcher | Every 2 hours | Skips if version unchanged since last run |
| Daily web | 08:00 local time | Always runs regardless of version |
| Manual | On demand | Use `--force` flag to skip version check |

---

## Last-tested tracking

After each run, write `reports/last-tested.json`:
```json
{
  "version": "2026.2.6-dev.3",
  "testedAt": "2026-02-24T08:00:00.000Z"
}
```

This file is **local only** (in `.gitignore`). Each bot tracks its own state independently.
