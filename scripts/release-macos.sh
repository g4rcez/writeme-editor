#!/usr/bin/env bash
# Releases the macOS app of a version tag from this Mac: builds writeme.app signed with the Developer ID certificate, has
# Apple notarize the app, the DMG and the CLI, verifies them, attaches them to the GitHub release of the tag and updates the
# Homebrew tap (g4rcez/homebrew-tap: the cask writeme and the formula writeme-cli). It uses your own keychain, `gh` login and git access: CI holds no Apple secret.
#
#   scripts/release-macos.sh vX.Y.Z [--no-publish]
#
# --no-publish builds, notarizes and verifies into release-artifacts/macos, from any commit, and publishes nothing.
#
# It needs, once on this Mac (see "macOS releases and signing" in PUBLISH.md):
#   - a "Developer ID Application" certificate in the keychain, of the team that scripts/signing-team-id names;
#   - notarytool credentials in the keychain profile `writeme-notary`, used by this app only (NOTARY_PROFILE picks another).
# It waits up to 2 hours for Apple to notarize the DMG and the CLI (NOTARY_TIMEOUT picks another limit).
set -euo pipefail

cd "$(dirname "$0")/.."

usage() { echo "usage: scripts/release-macos.sh vX.Y.Z [--no-publish]" >&2; exit 2; }
die() { echo "error: $*" >&2; exit 1; }

tag="${1:-}"
[[ "$tag" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]] || usage
version="${tag#v}"
publish=1
case "${2:-}" in
    "") ;;
    --no-publish) publish=0 ;;
    *) usage ;;
esac

repo="g4rcez/writeme-editor"
tap_url="https://github.com/g4rcez/homebrew-tap.git"
# Git uses the `gh` login for GitHub, with no SSH key: the launchd agent runs it too.
gh_git=(-c credential.helper= -c 'credential.helper=!gh auth git-credential')
dmg_name="writeme-$version-arm64.dmg"
zip_name="writeme-$version-darwin-arm64.zip"
cli_name="writeme-darwin-arm64"

[ "$(uname -sm)" = "Darwin arm64" ] || die "release from a Mac with Apple silicon"
team="$(tr -d '[:space:]' < scripts/signing-team-id 2>/dev/null || true)"
[[ "$team" =~ ^[A-Z0-9]{10}$ ]] || die "no team pinned: write your Team ID to scripts/signing-team-id and commit it"
identity="$(scripts/signing-identity.sh --release)"
[ -n "$identity" ] || die "no \"Developer ID Application\" certificate of team $team in your keychain (see PUBLISH.md)"
notary_profile="${NOTARY_PROFILE:-writeme-notary}"
xcrun notarytool history --keychain-profile "$notary_profile" >/dev/null 2>&1 \
    || die "notarytool cannot use the keychain profile $notary_profile: run xcrun notarytool store-credentials $notary_profile"
command -v bun >/dev/null || die "bun is not installed"

if [ "$publish" = 1 ]; then
    gh auth status >/dev/null 2>&1 || die "gh is not logged in: run gh auth login"
    [ -z "$(git status --porcelain)" ] || die "the working tree is not clean"
    git fetch --quiet origin --tags
    [ "$(git rev-parse HEAD)" = "$(git rev-parse -q --verify "refs/tags/$tag^{commit}" || true)" ] \
        || die "check out the tag first: git switch --detach $tag"
    remote="$(git ls-remote origin "refs/tags/$tag" "refs/tags/$tag^{}" | tail -1 | cut -f1)"
    [ "$remote" = "$(git rev-parse HEAD)" ] || die "$tag is not on origin, or origin has it on another commit"
    latest="$(git tag --list 'v*' | grep -E '^v[0-9]+\.[0-9]+\.[0-9]+$' | sort -V | tail -1)"
    [ "$latest" = "$tag" ] || die "$latest is newer than $tag: the tap would go back to an old version"
    # Published files are never replaced: the tap and the users already have their checksums.
    git "${gh_git[@]}" ls-remote "$tap_url" HEAD >/dev/null || die "cannot reach the Homebrew tap with the gh login"
    published="$(gh release view "$tag" --repo "$repo" --json assets --jq '.assets[].name' 2>/dev/null || true)"
    for name in "$dmg_name" "$zip_name" "$cli_name"; do
        ! grep -qxF "$name" <<<"$published" || die "the release $tag already has $name"
    done
fi

work="$(mktemp -d)"
cp package.json "$work/package.json"
cp package-lock.json "$work/package-lock.json"
cleanup() {
    cp "$work/package.json" package.json
    cp "$work/package-lock.json" package-lock.json
    rm -rf "$work"
}
trap cleanup EXIT

if [ "$(node -p "require('./package.json').version")" != "$version" ]; then
    npm version "$version" --no-git-tag-version --ignore-scripts --workspaces=false >/dev/null
fi

# The release has the default features of the direct profile, whatever this shell has set.
unset WRITEME_BUILD_PROFILE WRITEME_DISABLE_FEATURES
rm -rf out release-artifacts/macos
echo "building $tag; Forge also waits for Apple to notarize the app..."
APPLE_SIGNING_IDENTITY="$identity" WRITEME_NOTARY_PROFILE="$notary_profile" \
    NODE_OPTIONS="--max-old-space-size=4096" npm run make -- --arch=arm64

# The packaged app must start, write a note and read it again with the hardened runtime.
timeout_cmd="$(command -v timeout || command -v gtimeout || true)"
WRITEME_E2E_PREBUILT=1 WRITEME_PACKAGED_EXECUTABLE="out/writeme-darwin-arm64/writeme.app/Contents/MacOS/writeme" \
    ${timeout_cmd:+$timeout_cmd 600} npm run test:e2e -- --platform osx --suite native \
    tests/native/freehand-note.spec.ts --grep "packaged application"

stage="release-artifacts/macos"
mkdir -p "$stage"
dmgs=(out/make/*.dmg)
zips=(out/make/zip/darwin/arm64/*.zip)
[ "${#dmgs[@]}" = 1 ] && [ -f "${dmgs[0]}" ] || die "expected one DMG in out/make"
[ "${#zips[@]}" = 1 ] && [ -f "${zips[0]}" ] || die "expected one ZIP in out/make/zip/darwin/arm64"
cp "${dmgs[0]}" "$stage/$dmg_name"
cp "${zips[0]}" "$stage/$zip_name"

bun build --compile packages/cli/src/index.ts --outfile "$stage/$cli_name"
codesign --force --sign "$identity" --timestamp --options runtime --identifier dev.writeme.cli \
    --entitlements build/entitlements.cli.plist "$stage/$cli_name"
codesign --force --sign "$identity" --timestamp --identifier dev.writeme.dmg "$stage/$dmg_name"

notarize() {
    local file="$1" timeout="${NOTARY_TIMEOUT:-2h}" status submission
    echo "notarizing $(basename "$file") (usually a few minutes; waiting up to $timeout)..."
    xcrun notarytool submit "$file" --keychain-profile "$notary_profile" --wait --timeout "$timeout" \
        --output-format json > "$work/notary.json" || true
    status="$(plutil -extract status raw -o - "$work/notary.json" 2>/dev/null || true)"
    [ "$status" = "Accepted" ] && return
    cat "$work/notary.json" >&2
    submission="$(plutil -extract id raw -o - "$work/notary.json" 2>/dev/null || true)"
    # No verdict is not a rejection: the wait ran out, or the connection failed.
    case "$status" in
        "" | "In Progress")
            die "no answer from Apple, nothing was published. Ask later with:
  xcrun notarytool info ${submission:-<id>} --keychain-profile $notary_profile
then run the release again" ;;
    esac
    [ -z "$submission" ] || xcrun notarytool log "$submission" --keychain-profile "$notary_profile" >&2 || true
    die "Apple did not accept $(basename "$file") (status: $status)"
}
notarize "$stage/$dmg_name"
xcrun stapler staple "$stage/$dmg_name"
# notarytool does not take a bare executable.
ditto -c -k "$stage/$cli_name" "$work/cli.zip"
notarize "$work/cli.zip"

scripts/verify-macos-release.sh "$stage" "$version"

if [ "$publish" = 0 ]; then
    echo "not published: the verified files are in $stage"
    exit 0
fi

# CI creates the release with the files of the other platforms. This creates it when CI has not (yet).
gh release view "$tag" --repo "$repo" >/dev/null 2>&1 \
    || gh release create "$tag" --repo "$repo" --title "$tag" --generate-notes --verify-tag
gh release upload "$tag" --repo "$repo" "$stage/$dmg_name" "$stage/$zip_name" "$stage/$cli_name"

# brew downloads from the release: the tap moves only when it serves the files that passed the checks.
for name in "$dmg_name" "$cli_name"; do
    gh release download "$tag" --repo "$repo" -p "$name" -D "$work/published"
    cmp -s "$work/published/$name" "$stage/$name" || die "the published $name is not the verified one: the tap was not changed"
done

git "${gh_git[@]}" clone --quiet "$tap_url" "$work/tap"
dmg_sha="$(shasum -a 256 "$work/published/$dmg_name" | cut -d' ' -f1)"
cli_sha="$(shasum -a 256 "$work/published/$cli_name" | cut -d' ' -f1)"
mkdir -p "$work/tap/Casks" "$work/tap/Formula"
sed -e "s/@VERSION@/$version/g" -e "s/@DMG_SHA256@/$dmg_sha/" scripts/homebrew/writeme.cask.rb.in > "$work/tap/Casks/writeme.rb"
sed -e "s/@VERSION@/$version/g" -e "s/@CLI_SHA256@/$cli_sha/" -e "s/@TEAM@/$team/" scripts/homebrew/writeme-cli.rb.in \
    > "$work/tap/Formula/writeme-cli.rb"
git -C "$work/tap" add Casks/writeme.rb Formula/writeme-cli.rb
git -C "$work/tap" commit --quiet -m "writeme $version"
git -C "$work/tap" "${gh_git[@]}" push --quiet origin HEAD:main
echo "released $tag for macOS; run: brew update && brew upgrade --cask g4rcez/tap/writeme"
