#!/bin/bash
# Push to GitHub — run this from the Shell tab
# Usage: bash push_to_github.sh <your_github_pat>

TOKEN="$1"
if [ -z "$TOKEN" ]; then
  echo "Usage: bash push_to_github.sh <your_github_pat>"
  exit 1
fi

REPO="https://thanudiakeesha-cloud:${TOKEN}@github.com/thanudiakeesha-cloud/INFBOT.git"

rm -f .git/index.lock .git/config.lock

git config user.email "bot@infinitymd.online"
git config user.name "Infinity MD"

git remote remove github 2>/dev/null || true
git remote add github "$REPO"

git add -A
git commit -m "feat: language support, film3, menu redesign, connect manual" --allow-empty

git push github HEAD:main --force

git remote remove github

echo "Done! Check https://github.com/thanudiakeesha-cloud/INFBOT"
