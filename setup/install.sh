#!/bin/sh
# One-time setup: puts the Claude Code skill and the GitHub Pages workflow in place.
# Run from the website folder:  sh setup/install.sh
set -e
cd "$(dirname "$0")/.."
mkdir -p .claude/skills .github/workflows
rm -rf .claude/skills/add-paper
cp -R setup/add-paper-skill .claude/skills/add-paper
cp setup/deploy.yml .github/workflows/deploy.yml
echo "Installed .claude/skills/add-paper and .github/workflows/deploy.yml"
