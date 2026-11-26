#!/usr/bin/env bash
# Run by launchd (see scripts/install-release-agent.sh): releases the macOS files of the newest version tag without anyone at
# the keyboard. It works in its own clone, so the checkout you develop in is never touched, and it runs only code that is on a
# version tag of origin, never code of a pull request.
#
# For the newest vX.Y.Z tag it:
#   - does nothing when the GitHub release of the tag already has the macOS files, or when the tag has no release-macos.sh;
#   - otherwise checks out the tag, installs the dependencies and runs scripts/release-macos.sh;
#   - tries a tag at most 3 times (WRITEME_RELEASE_ATTEMPTS), and shows a notification on success and on failure.
set -uo pipefail

state="${WRITEME_RELEASE_HOME:-$HOME/Library/Application Support/writeme-release}"
logs="$HOME/Library/Logs/writeme-release"
repo="$state/repo"
max_attempts="${WRITEME_RELEASE_ATTEMPTS:-3}"
notary_profile="${NOTARY_PROFILE:-writeme-notary}"
mkdir -p "$state/tags" "$logs"

log() { printf '%s %s\n' "$(date '+%Y-%m-%dT%H:%M:%S')" "$*"; }
notify() { osascript -e "display notification \"$2\" with title \"Writeme release\" subtitle \"$1\"" >/dev/null 2>&1 || true; }

# One run at a time: a release takes longer than the interval of launchd.
lock="$state/lock"
if ! mkdir "$lock" 2>/dev/null; then
    pid="$(cat "$lock/pid" 2>/dev/null || true)"
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then exit 0; fi
    rm -rf "$lock"
    mkdir "$lock" || exit 0
fi
echo $$ > "$lock/pid"
trap 'rm -rf "$lock"' EXIT

git -C "$repo" fetch --quiet --prune --tags --force origin || { log "cannot fetch origin"; exit 0; }
tag="$(git -C "$repo" tag --list 'v*' | grep -E '^v[0-9]+\.[0-9]+\.[0-9]+$' | sort -V | tail -1)"
[ -n "$tag" ] || exit 0
mark="$state/tags/$tag"
[ -e "$mark.done" ] || [ -e "$mark.skipped" ] && exit 0

if ! git -C "$repo" cat-file -e "$tag:scripts/release-macos.sh" 2>/dev/null; then
    log "$tag has no scripts/release-macos.sh: skipped"
    touch "$mark.skipped"
    exit 0
fi
version="${tag#v}"
if gh release view "$tag" --repo g4rcez/writeme-editor --json assets --jq '.assets[].name' 2>/dev/null \
    | grep -qxF "writeme-$version-arm64.dmg"; then
    log "$tag already has the macOS files"
    touch "$mark.done"
    exit 0
fi

attempts="$(cat "$mark.attempts" 2>/dev/null || echo 0)"
[ "$attempts" -lt "$max_attempts" ] || exit 0

# Nothing of the release can start without the credentials: say so once a day instead of using up the attempts.
if ! xcrun notarytool history --keychain-profile "$notary_profile" >/dev/null 2>&1; then
    reminder="$state/missing-profile"
    if [ -z "$(find "$reminder" -mtime -1 2>/dev/null)" ]; then
        log "the keychain profile $notary_profile is missing"
        notify "$tag is waiting" "Run once: xcrun notarytool store-credentials $notary_profile"
        touch "$reminder"
    fi
    exit 0
fi

echo $((attempts + 1)) > "$mark.attempts"
output="$logs/$tag.log"
log "releasing $tag (attempt $((attempts + 1)) of $max_attempts), log: $output"
(
    set -e
    cd "$repo"
    git reset --quiet --hard
    git clean --quiet -fdx -e node_modules
    git switch --quiet --detach "$tag"
    npm ci --no-audit --no-fund
    scripts/release-macos.sh "$tag"
) > "$output" 2>&1
status=$?

if [ "$status" = 0 ]; then
    touch "$mark.done"
    log "released $tag"
    notify "$tag released" "The notarized macOS app is on GitHub and in the Homebrew tap."
else
    log "release of $tag failed with $status"
    left=$((max_attempts - attempts - 1))
    notify "$tag failed" "See $output. Attempts left: $left."
fi
