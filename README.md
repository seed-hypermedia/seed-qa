# seed-qa

Shared QA specs and test suite for [Seed Hypermedia](https://seed.hyper.media).

Tests run automatically on every new build on both Windows and Linux machines.
Results are posted to Discord and filed as GitHub issues on failures.

## Structure

```
SPECS.md                  ← plain-English test descriptions (edit this to add/change tests)
tests/web/                ← Playwright web tests (auto-maintained by QA bots)
tests/app/                ← Playwright desktop/Electron tests
scripts/                  ← run, sync, report, notify scripts
playwright.web.config.ts  ← web test config (Chromium + Firefox)
playwright.config.ts      ← desktop test config
```

## Adding or changing a test

1. Edit `SPECS.md` — add a row with the next ID and a plain-English description
2. Commit and push to `main`
3. The QA bots will pick it up on their next sync, implement the test, and start running it

## Running manually

```bash
# Web tests only
npx playwright test --config playwright.web.config.ts

# Desktop tests only
npx playwright test --config playwright.config.ts

# Full run (sync + download build + all tests + report)
node scripts/full-run.mjs

# Force run (skip version check)
node scripts/full-run.mjs --force
```

## Machines

| Machine | OS | Bot |
|---|---|---|
| mintter-win32 | Windows 10 | Sprout (Windows) 🌱 |
| Linux | Linux | Sprout (Linux) 🌱 |

## Reports

Results are posted to Discord after each run.
Failures are filed as GitHub issues in [seed-hypermedia/seed](https://github.com/seed-hypermedia/seed)
with the label `qa-automated` and the appropriate platform label (`windows` or `linux`).
