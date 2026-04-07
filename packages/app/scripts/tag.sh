#!/usr/bin/env bash
set -euo pipefail

DATE=$(date +%Y%m%d)
HASH=$(git rev-parse --short=8 HEAD)

# Count existing tags for today to determine the deploy index
COUNT=$(git tag --list "${DATE}.*" | wc -l | tr -d ' ')
INDEX=$((COUNT + 1))

TAG="${DATE}.${HASH}.${INDEX}"

echo "Creating tag: $TAG"
git tag "$TAG"
echo "Done. Push with: git push origin $TAG"
