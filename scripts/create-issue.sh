#!/usr/bin/env bash
set -euo pipefail

REPO="${SEED_QA_REPO:-seed-hypermedia/seed}"
TITLE="$1"
BODY_FILE="$2"
LABELS="${3:-bug,qa-automated}"

PLATFORM=$(uname -s | tr '[:upper:]' '[:lower:]')
[[ "$PLATFORM" == "linux" ]] && LABELS="$LABELS,linux"
[[ "$PLATFORM" == *"mingw"* || "$PLATFORM" == *"msys"* || "$PLATFORM" == *"cygwin"* ]] && LABELS="$LABELS,windows"

EXISTING=$(gh issue list --repo "$REPO" --search "$TITLE" --author "@me" --state open --json number --jq '.[0].number // empty' 2>/dev/null || true)

if [ -n "$EXISTING" ]; then
  echo "⚠️ Existing issue #$EXISTING — adding comment..."
  gh issue comment "$EXISTING" --repo "$REPO" --body-file "$BODY_FILE"
  exit 0
fi

ISSUE_URL=$(gh issue create --repo "$REPO" --title "$TITLE" --body-file "$BODY_FILE" --label "$LABELS")
echo "✅ Issue created: $ISSUE_URL"
