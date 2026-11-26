#!/usr/bin/env bash
# Asserts that the macOS files of a release are safe to publish. brew installs these files, so the checks read them and not
# the build folder. release-macos.sh runs it before it publishes.
#
#   scripts/verify-macos-release.sh <artifacts-dir> <version>
#
# It fails unless:
#   - writeme.app, in the DMG and in the ZIP, has exactly the designated requirement of scripts/designated-requirement, so
#     that macOS keeps the permissions of the users through the upgrade;
#   - the signatures are intact, Apple notarized the app, the DMG and the CLI, and the tickets are stapled to the app and
#     the DMG (a bare executable cannot carry one);
#   - the CLI, standalone and inside the app, runs JavaScript under the hardened runtime;
#   - the files name no user, home folder or computer of this Mac.
set -euo pipefail

repo="$(cd "$(dirname "$0")/.." && pwd)"
die() { echo "error: $*" >&2; exit 1; }

artifacts="${1:-}"
version="${2:-}"
[ -d "$artifacts" ] && [ -n "$version" ] || { echo "usage: scripts/verify-macos-release.sh <artifacts-dir> <version>" >&2; exit 2; }
pinned="$(cat "$repo/scripts/designated-requirement")"
team="$(tr -d '[:space:]' < "$repo/scripts/signing-team-id")"
dmg="$artifacts/writeme-$version-arm64.dmg"
zip="$artifacts/writeme-$version-darwin-arm64.zip"
cli="$artifacts/writeme-darwin-arm64"
for file in "$dmg" "$zip" "$cli"; do [ -f "$file" ] || die "missing $file"; done

work="$(mktemp -d)"
mount="$work/dmg"
cleanup() { hdiutil detach "$mount" -quiet -force 2>/dev/null || true; rm -rf "$work"; }
trap cleanup EXIT

# With the assessments switched off, spctl accepts everything and says so.
gatekeeper() {
    local assessment
    assessment="$(spctl --assess --verbose "$@" 2>&1)" || die "Gatekeeper rejects ${!#}: $assessment"
    grep -qxF "source=Notarized Developer ID" <<<"$assessment" || die "Gatekeeper does not see a notarized file: $assessment"
    ! grep -q "^override=" <<<"$assessment" || die "Gatekeeper is switched off on this Mac: $assessment"
}

private=("$HOME/" "$(id -un)" "$(scutil --get LocalHostName 2>/dev/null || true)" "$(scutil --get ComputerName 2>/dev/null || true)")
check_private() {
    local value found
    for value in "${private[@]}"; do
        [ -n "$value" ] || continue
        found="$(LC_ALL=C grep -rlaF -- "$value" "$1" || true)"
        [ -z "$found" ] || die "\"$value\" is named in:
$found"
    done
}

check_cli() {
    codesign --verify --strict -R "=anchor apple generic and certificate leaf[subject.OU] = $team" "$1" \
        || die "$1 is not signed by team $team"
    [ "$("$1" expr '40 + 2' | tail -1 | tr -dc '0-9')" = "42" ] || die "$1 does not run under the hardened runtime"
}

check_app() {
    local app="$1" requirement bundled
    [ -d "$app" ] || die "no writeme.app in $2"
    requirement="$(codesign -dr - "$app" 2>/dev/null | sed -n 's/^designated => //p')"
    [ "$requirement" = "$pinned" ] || die "$2 has another designated requirement: users would have to grant the permissions again
  pinned: $pinned
  app:    ${requirement:-none}"
    codesign --verify --deep --strict -R "=$pinned" "$app" || die "the signature in $2 is broken"
    xcrun stapler validate "$app" >/dev/null || die "no notarization ticket is stapled to the app in $2"
    gatekeeper --type execute "$app"
    [ "$(plutil -extract CFBundleShortVersionString raw -o - "$app/Contents/Info.plist")" = "$version" ] \
        || die "the app in $2 is not version $version"
    bundled="$app/Contents/Resources/app.asar.unpacked/packages/cli/dist/writeme"
    check_cli "$bundled"
    check_private "$app"
}

codesign --verify --strict "$dmg" || die "the DMG is not signed"
xcrun stapler validate "$dmg" >/dev/null || die "no notarization ticket is stapled to the DMG"
gatekeeper --type open --context context:primary-signature "$dmg"
hdiutil attach -quiet -readonly -nobrowse -noautoopen -mountpoint "$mount" "$dmg"
check_app "$mount/writeme.app" "the DMG"
# The window layout files of the DMG can store paths too.
check_private "$mount"
hdiutil detach "$mount" -quiet

ditto -x -k "$zip" "$work/zip"
check_app "$work/zip/writeme.app" "the ZIP"

check_cli "$cli"
codesign --verify --strict --check-notarization -R "=notarized" "$cli" || die "Apple did not notarize the CLI"
check_private "$cli"

echo "verified: writeme $version for macOS is notarized, keeps the permissions and names nothing of this Mac"
