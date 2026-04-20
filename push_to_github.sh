#!/bin/bash
# ════════════════════════════════════════════════════════════
#   CyberSOC — one-shot Git push to GitHub
#   Run this once after creating your GitHub repo.
# ════════════════════════════════════════════════════════════

set -e
cd "$(dirname "$0")"

echo ""
echo "🛡️  CyberSOC — push to GitHub"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Clean any stale lock file
rm -f .git/index.lock 2>/dev/null || true

# Make sure we have a git identity
if [ -z "$(git config user.email)" ]; then
  git config user.email "dharshanjr1101@gmail.com"
fi
if [ -z "$(git config user.name)" ]; then
  git config user.name "Dharshan G"
fi

# Stage + commit if anything is uncommitted
if [ -n "$(git status --porcelain)" ]; then
  git add .
  if git log -1 >/dev/null 2>&1; then
    git commit -m "Deployment-ready updates" || true
  else
    git commit -m "Initial CyberSOC commit"
  fi
fi

# Make sure the branch is called main
git branch -M main

REPO_URL="https://github.com/dharshang11/cybersoc.git"

# Set/reset the remote to our repo
if git remote | grep -q origin; then
  git remote set-url origin "$REPO_URL"
else
  git remote add origin "$REPO_URL"
fi
echo "✓ Remote: $(git remote get-url origin)"

echo ""
echo "🚀 Pushing to GitHub..."
git push -u origin main

echo ""
echo "✅ Done! Your code is live on GitHub."
echo "   Now switch back to Claude to continue with Render + Vercel deployment."
