#!/usr/bin/env bash
set -euo pipefail

if [[ "$#" -ne 1 ]]; then
  echo "Usage: npm run bump <patch|minor|major>"
  exit 1
fi

BUMP_TYPE="$1"

case "$BUMP_TYPE" in
  patch|minor|major) ;;
  *)
    echo "error: invalid bump type '${BUMP_TYPE}'"
    echo "Usage: npm run bump <patch|minor|major>"
    exit 1
    ;;
esac

if [[ -n "$(git status --porcelain)" ]]; then
  echo "error: working tree is dirty — commit or stash changes first"
  exit 1
fi

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [[ "$CURRENT_BRANCH" != "main" ]]; then
  echo "error: releases must be cut from main (current: ${CURRENT_BRANCH})"
  exit 1
fi

# Bump package.json without committing so CHANGELOG can be included in the same commit
npm version "$BUMP_TYPE" --no-git-tag-version

VERSION=$(node -p "require('./package.json').version")
TAG="v${VERSION}"

# Full history on first run, incremental (since last tag) on subsequent runs
if [[ -f CHANGELOG.md ]]; then
  ./node_modules/.bin/conventional-changelog -p angular -i CHANGELOG.md -s
else
  ./node_modules/.bin/conventional-changelog -p angular -i CHANGELOG.md -s -r 0
fi

git add package.json package-lock.json CHANGELOG.md
git commit -m "chore: release ${TAG}"
git tag "$TAG"

git push origin HEAD
git push origin "$TAG"

echo ""
echo "Published tag ${TAG}; GitHub Actions will build artifacts and create the release."
echo "CI: https://github.com/g4rcez/writeme-editor/actions"
echo "Release: https://github.com/g4rcez/writeme-editor/releases/tag/${TAG}"
