#!/usr/bin/env bash
REPO="${SEED_QA_REPO:-seed-hypermedia/seed}"

echo "Checking GitHub notifications..."
gh api notifications --jq '.[] | select(.unread==true) | "\(.subject.title) [\(.reason)]"' 2>/dev/null | head -20 || echo "No unread notifications"
