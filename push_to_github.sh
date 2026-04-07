#!/bin/bash
# Push to GitHub — run this script once from the Shell tab
TOKEN="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"
REPO="https://thanudiakeesha-cloud:${TOKEN}@github.com/thanudiakeesha-cloud/INFBOT.git"

rm -f .git/index.lock .git/config.lock

git config user.email "bot@infinitymd.online"
git config user.name "Infinity MD"

git remote remove github 2>/dev/null || true
git remote add github "$REPO"

git add -A
git commit -m "feat: language support, film3, menu redesign, connect manual" --allow-empty

git push github HEAD:main --force

echo "✅ Done! Check https://github.com/thanudiakeesha-cloud/INFBOT"
