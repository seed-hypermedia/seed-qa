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

## Desktop — Fresh Launch (Keychain Reset)
These tests reset the account identity before launching to simulate a brand-new install.

| ID    | Description |
|-------|-------------|
| D4-01 | On a fresh launch (account identity deleted), the app must show an onboarding prompt (create / new account / welcome / get started / recovery / setup) |
| D4-02 | On a fresh launch, no crash dialogs or error overlays must be visible |

---

### Web — Comment URL Routing

| ID | Description |
|---|---|
| WC-01 | Navigate to `/:comments` on a document with comments. The page must render a comments list in the main content area without any document content visible. |
| WC-02 | Navigate to `/:comments` on the home document (root path). The comment editor must be visible above the comments list. |
| WC-03 | Navigate to `/:comments/UID/TSID` where UID/TSID is a valid comment ID. The comments list must render in the main content area and the specified comment must be visually highlighted (e.g., `bg-accent` class). |
| WC-04 | Navigate to `?panel=comments/UID/TSID` (no view term). The document content must render in the main area and a comments panel must be visible in the right sidebar with the specified comment highlighted. |
| WC-05 | Navigate to `/:comments?panel=comments/UID/TSID`. The comments list must render in the main content area AND a comments panel must be visible in the right sidebar with the specified comment highlighted. |
| WC-06 | Navigate to `/:discussions` (old URL format). The page must redirect or render the comments view identically to `/:comments` (backward compatibility). |
| WC-07 | Navigate to `?panel=comment/UID/TSID` (old `comment/` prefix). The document must render in the main area with a comments panel in the right sidebar, same as `?panel=comments/UID/TSID` (backward compatibility). |
| WC-08 | On the comments main view (`/:comments`), click the "Copy Comment Link" button on any comment. The clipboard must contain a URL with the comment ID in the path: `.../:comments/UID/TSID` (no `?panel=` query param). |
| WC-09 | On a document with the comments right panel open (`?panel=comments/UID/TSID`), click the "Copy Comment Link" button on any comment. The clipboard must contain a URL with the comment ID in the query param: `...?panel=comments/UID/TSID` (no `:comments` view term in path). |
| WC-10 | On the comments main view (`/:comments`), click the "Reply" button on a comment. The URL must update to `/:comments/UID/TSID` where UID/TSID is the comment being replied to, and the reply editor must be focused. |
| WC-11 | On a document with comments in the right panel, click the "Reply" button on a comment. The URL must update to include `?panel=comments/UID/TSID` and the reply editor must be focused in the right panel. |
| WC-12 | On a document with comments in the right panel, click on any block of the comment. The URL must update to include `?panel=comments/UID/TSID#BLOCK_ID+` where the BLOCK_ID is the actual block id for the block clicked. The `+` at the end should be there too (block expansion param). |
| WC-13 | On the comments main view, click on any block of the comment. The URL must update to include `/:comments/UID/TSID#BLOCK_ID+` where the BLOCK_ID is the actual block id for the block clicked. The `+` at the end should be there too (block expansion param). |

---

### Desktop — Comment URL Routing

| ID | Description |
|---|---|
| DC-01 | Paste a URL ending in `/:comments` into the omnibar and press Enter. The comments view must render in the main content area. |
| DC-02 | Paste a URL ending in `/:comments/UID/TSID` into the omnibar and press Enter. The comments view must render in the main content area with the specified comment highlighted. |
| DC-03 | Paste a URL with `?panel=comments/UID/TSID` (no view term) into the omnibar and press Enter. The document content must render in the main area and a comments panel must be visible in the right sidebar with the specified comment highlighted. |
| DC-04 | Paste a URL ending in `/:comments?panel=comments/UID/TSID` into the omnibar and press Enter. The comments list must render in the main content area AND a comments panel must be visible in the right sidebar with the specified comment highlighted. |
| DC-05 | On the comments main view, click the "Reply" button on a comment. The URL in the omnibar must update to show `/:comments/UID/TSID` and the reply editor must appear. |
| DC-06 | On a document with comments in the right panel, click the "Reply" button. The URL in the omnibar must update to include `?panel=comments/UID/TSID` and the reply editor must appear in the right panel. |
| DC-07 | On the comments main view, click the "Copy Comment Link" button. The clipboard URL must contain `/:comments/UID/TSID` in the path (not as a query param). |
| DC-08 | On a document with comments in the right panel, click the "Copy Comment Link" button. The clipboard URL must contain `?panel=comments/UID/TSID` as a query param (no `:comments` view term in path). |
| DC-09 | Paste a URL with the old `/:discussions` view term into the omnibar. The app must navigate to the comments view (backward compatibility). |
| DC-10 | Paste a URL with the old `?panel=comment/UID/TSID` format (singular `comment/`) into the omnibar. The app must open the document with the comments right panel and highlighted comment (backward compatibility). |
| DC-11 | Paste a URL ending in `/:comments/UID/TSID` into the titlebar URL field and press Enter. The comments view must render with the specified comment highlighted (same behavior as omnibar). |
| DC-12 | On a document with comments in the right panel, click on any block of the comment. The URL must update to include `?panel=comments/UID/TSID#BLOCK_ID+` where the BLOCK_ID is the actual block id for the block clicked. The `+` at the end should be there too (block expansion param). |
| DC-13 | On the comments main view, click on any block of the comment. The URL must update to include `/:comments/UID/TSID#BLOCK_ID+` where the BLOCK_ID is the actual block id for the block clicked. The `+` at the end should be there too (block expansion param). |

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
