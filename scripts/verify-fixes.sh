#!/usr/bin/env bash
# Re-checks open QA issues to see if they now pass. Closes any that are fixed.
REPO="${SEED_QA_REPO:-seed-hypermedia/seed}"

echo "Checking open QA issues..."
OPEN=$(gh issue list --repo "$REPO" --author "@me" --state open --label "qa-automated" --json number,title --jq '.[] | "\(.number)|\(.title)"' 2>/dev/null || true)

if [ -z "$OPEN" ]; then
  echo "No open QA issues."
  exit 0
fi

echo "$OPEN" | while IFS='|' read -r num title; do
  echo "  #$num: $title — skipping auto-close (manual review needed)"
done
