#!/bin/bash

TOKEN=$1
USERNAME="thanudiakeesha-cloud"
REPO="thanudiakeesha-cloud/INFBOT"

# Reset remote
git remote remove origin 2>/dev/null
git remote add origin https://$USERNAME:$TOKEN@github.com/$REPO.git

# Add & commit
git add .
git commit -m "auto push" || echo "Nothing to commit"

# Ensure main branch
git branch -M main

# Push
git push -u origin main