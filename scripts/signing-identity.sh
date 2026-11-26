#!/usr/bin/env bash
# Prints the SHA-1 hash of the certificate that signs Writeme on this Mac, or nothing when there is none. forge.config.ts
# and release-macos.sh both ask here, so that every build picks the same certificate.
#
#   scripts/signing-identity.sh [--release]
#
# 1. The "Developer ID Application" certificate of the team in scripts/signing-team-id, the one of the releases. A local build
#    signed with it has the same designated requirement as a release, so macOS keeps the permissions from one to the other.
# 2. Without it, and without --release, the first "Apple Development" certificate (a Mac of someone else).
set -euo pipefail
cd "$(dirname "$0")"

team="$(tr -d '[:space:]' < signing-team-id 2>/dev/null || true)"
identities="$(security find-identity -v -p codesigning 2>/dev/null || true)"

identity=""
if [ -n "$team" ]; then
    identity="$(awk -v team="($team)\"" '/"Developer ID Application: / && index($0, team) { print $2; exit }' <<<"$identities")"
fi
if [ -z "$identity" ] && [ "${1:-}" != "--release" ]; then
    identity="$(awk '/"Apple Development: / { print $2; exit }' <<<"$identities")"
fi
[ -z "$identity" ] || echo "$identity"
