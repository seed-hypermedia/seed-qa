# Seed QA — Test Specifications

This is the **source of truth** for what gets tested on every build.
Write new tests here in plain English. The QA bots read this file and maintain the
corresponding Playwright tests in `tests/`. Each spec line maps 1:1 to a test ID.

---

## Web — Tier 1 (Critical)
These must all pass on Chrome on every build. Failures block the release.

| ID    | Description |
|-------|-------------|
| W1-01 | The homepage must load with visible body content (more than 100 characters) |
| W1-02 | A site header or navigation element must be visible on the homepage |
| W1-03 | A main content area (main, article, or section tag) must render on the homepage |
| W1-04 | No critical JavaScript errors on the homepage (ResizeObserver and non-error promise rejections are ignored) |
| W1-05 | No broken images on the homepage (every img element must have loaded successfully) |
| W1-06 | On a 375px mobile viewport, the body must not overflow horizontally |
| W1-07 | The /api/version endpoint must respond — any of 200, 403, or 404 is acceptable |

---

## Web — Tier 2 (Important)
Failures get a GitHub issue but do not block the release.

| ID    | Description |
|-------|-------------|
| W2-01 | The /d/seed-hypermedia download page must render with a visible body |
| W2-02 | The homepage must contain at least one internal link (href starting with / or seed.hyper.media) |
| W2-03 | The homepage body must be visible (activity feed smoke test) |
| W2-04 | A footer element must be present and visible on the homepage (skip if not present) |
| W2-05 | On a 768px tablet viewport, the homepage body must be visible |
| W2-06 | The homepage must have a non-empty page title (more than 3 characters) |
| W2-07 | The homepage body must be visible (connect page smoke test) |

---

## Desktop — App Launch
Basic smoke tests for the Electron app. Run on every new build download.

| ID    | Description |
|-------|-------------|
| D1-01 | The app must launch without crashing |
| D1-02 | The main window must have a non-empty title |
| D1-03 | The main window must be at least 400x300 pixels |
| D1-04 | No crash dialogs or error overlays (alertdialog, .error-boundary, .crash-screen) must be visible on launch |

---

## Desktop — Navigation
Tested after a 5-second wait to let the app settle.

| ID    | Description |
|-------|-------------|
| D2-01 | A sidebar, nav, or aside element must be visible after launch — or the app is showing onboarding (skip is acceptable) |
| D2-02 | The window must report a non-zero inner width and height |

---

## Desktop — Onboarding

| ID    | Description |
|-------|-------------|
| D3-01 | On a fresh launch, either an onboarding prompt (create / new / account / welcome / get started / recovery) or the main screen (sidebar/nav) must be visible |

---

## How to add a new test

1. Add a row to the right table above with the next ID in sequence
2. Describe what should happen in plain English — be specific about selectors, URLs, or conditions if you know them
3. Commit and push to `main`
4. The QA bots will pick it up on their next sync, implement the Playwright test, and start running it

## How to change an existing test

Edit the description. The bots will update the implementation to match.

## How to disable a test

Add `[DISABLED]` at the start of the description. The bots will skip it without deleting it.
