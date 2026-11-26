#!/usr/bin/env bash
# Installs the launchd agent that releases the macOS files of each new version tag from this Mac (scripts/release-agent.sh).
#
#   scripts/install-release-agent.sh            install, or update after the scripts changed
#   scripts/install-release-agent.sh --remove   stop and remove it
#
# The agent runs as you, in your login session, so it uses your keychain, your `gh` login and your tools. It looks for a new
# tag every 10 minutes (WRITEME_RELEASE_INTERVAL, in seconds) while you are logged in and the Mac is awake.
set -euo pipefail

label="dev.writeme.release-agent"
plist="$HOME/Library/LaunchAgents/$label.plist"
state="$HOME/Library/Application Support/writeme-release"
logs="$HOME/Library/Logs/writeme-release"
domain="gui/$(id -u)"

launchctl bootout "$domain/$label" 2>/dev/null || true
if [ "${1:-}" = "--remove" ]; then
    rm -f "$plist"
    echo "removed $label (the clone and the logs stay in $state and $logs)"
    exit 0
fi

for tool in node npm bun gh git timeout; do
    command -v "$tool" >/dev/null || { echo "error: $tool is not installed" >&2; exit 1; }
done
gh auth status >/dev/null 2>&1 || { echo "error: gh is not logged in: run gh auth login" >&2; exit 1; }

mkdir -p "$state" "$logs" "$(dirname "$plist")"
# Its own clone over HTTPS with the `gh` login, so it does not depend on SSH keys or on your working copy.
if [ ! -d "$state/repo/.git" ]; then
    git clone --quiet -c credential.helper= -c 'credential.helper=!gh auth git-credential' \
        https://github.com/g4rcez/writeme-editor.git "$state/repo"
fi
# The agent runs the copy installed here, not the one of the checked-out tag.
install -m 0755 "$(dirname "$0")/release-agent.sh" "$state/release-agent.sh"

# launchd starts with an almost empty PATH: keep the folders of the tools that this shell finds.
path=""
for tool in node bun gh timeout; do
    dir="$(dirname "$(command -v "$tool")")"
    case ":$path:" in *":$dir:"*) ;; *) path="${path:+$path:}$dir" ;; esac
done
path="$path:/usr/bin:/bin:/usr/sbin:/sbin"

cat > "$plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key><string>$label</string>
    <key>ProgramArguments</key>
    <array><string>/bin/bash</string><string>$state/release-agent.sh</string></array>
    <key>EnvironmentVariables</key>
    <dict><key>PATH</key><string>$path</string></dict>
    <key>StartInterval</key><integer>${WRITEME_RELEASE_INTERVAL:-600}</integer>
    <key>RunAtLoad</key><true/>
    <key>ProcessType</key><string>Background</string>
    <key>StandardOutPath</key><string>$logs/agent.log</string>
    <key>StandardErrorPath</key><string>$logs/agent.log</string>
</dict>
</plist>
PLIST
plutil -lint "$plist" >/dev/null
launchctl bootstrap "$domain" "$plist"
echo "installed $label: it checks for a new tag every ${WRITEME_RELEASE_INTERVAL:-600}s; log: $logs/agent.log"
