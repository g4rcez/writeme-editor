# Publishing Writeme

This document covers the one-time setup required before the first release and the steps to cut a release.

---

## Prerequisites

- Apple Developer Program membership ($99/year)
- A Developer ID Application certificate and .p12 export (for DMG signing + notarization)
- Access to the `g4rcez/writeme-editor` repository settings (to add secrets)
- A GitHub account that can create repositories

---

## One-Time Setup

### 1. Create the Homebrew tap repository

Create a new **public** GitHub repository named exactly `homebrew-writeme` under your account:
https://github.com/new → name: `homebrew-writeme` → Public → Create

### 2. Add placeholder tap files

In the new `homebrew-writeme` repo, create the following two files. The CI will overwrite the SHA256 and version values on first release.

**`Casks/writeme.rb`**
```ruby
cask "writeme" do
  version "1.0.0"

  on_arm do
    url "https://github.com/g4rcez/writeme-editor/releases/download/v#{version}/writeme-#{version}-arm64.dmg"
    sha256 "0000000000000000000000000000000000000000000000000000000000000000"
  end

  on_intel do
    url "https://github.com/g4rcez/writeme-editor/releases/download/v#{version}/writeme-#{version}-x64.dmg"
    sha256 "0000000000000000000000000000000000000000000000000000000000000000"
  end

  name "Writeme"
  desc "Markdown note-taking application"
  homepage "https://writeme.dev"

  app "writeme.app"

  zap trash: [
    "~/Library/Application Support/writeme",
    "~/Library/Preferences/dev.writeme.app.plist",
    "~/Library/Logs/writeme",
    "~/Library/Caches/dev.writeme.app",
  ]
end
```

**`Formula/writeme.rb`**
```ruby
class Writeme < Formula
  desc "Writeme CLI — open notes and query Writeme from the command line"
  homepage "https://writeme.dev"
  version "1.0.0"
  license "MIT"

  on_arm do
    url "https://github.com/g4rcez/writeme-editor/releases/download/v#{version}/writeme-darwin-arm64"
    sha256 "0000000000000000000000000000000000000000000000000000000000000000"
  end

  on_intel do
    url "https://github.com/g4rcez/writeme-editor/releases/download/v#{version}/writeme-darwin-x64"
    sha256 "0000000000000000000000000000000000000000000000000000000000000000"
  end

  def install
    bin.install Dir["writeme-darwin-*"].first => "writeme"
  end

  test do
    output = shell_output("#{bin}/writeme query 2>&1", 1)
    assert_match "Usage:", output
  end
end
```

Commit both files directly on `main` in `homebrew-writeme`.

### 3. Generate a GitHub Personal Access Token (PAT)

Go to https://github.com/settings/tokens → Generate new token (classic)
- Note: `writeme tap bump`
- Expiration: 1 year (set a calendar reminder to rotate) — or No expiration for unattended automation
- Scopes: check **`repo`** (full repository access)

Copy the token value.

### 4. Add `TAP_GITHUB_TOKEN` secret to `writeme-editor`

Go to https://github.com/g4rcez/writeme-editor/settings/secrets/actions → New repository secret
- Name: `TAP_GITHUB_TOKEN`
- Value: the PAT from step 3

### 5. Add Apple signing secrets to `writeme-editor`

Add each of these at https://github.com/g4rcez/writeme-editor/settings/secrets/actions:

- `APPLE_ID` — Your Apple ID email (e.g. `you@icloud.com`)
- `APPLE_APP_SPECIFIC_PASSWORD` — App-specific password from https://appleid.apple.com → Sign-In and Security → App-Specific Passwords
- `APPLE_TEAM_ID` — Your 10-character Apple Developer Team ID (visible at https://developer.apple.com/account)
- `CSC_LINK` — Base64-encoded .p12 certificate: `base64 -i Developer_ID_Application.p12 | pbcopy`
- `CSC_KEY_PASSWORD` — The password you set when exporting the .p12

**Note:** `scripts/tag.sh` uses a date-based tag format (`YYYYMMDD.hash.N`). The release workflow triggers on `v*` tags. Use **semver tags** for releases: `git tag v1.0.0 && git push origin v1.0.0`. Update `package.json` version to match before tagging.

---

## Releasing a New Version

1. Update `version` in `package.json` to the new semver (e.g. `1.1.0`)
2. Commit: `git commit -am "chore: bump version to 1.1.0"`
3. Tag: `git tag v1.1.0`
4. Push: `git push origin main && git push origin v1.1.0`
5. Watch the Actions run at https://github.com/g4rcez/writeme-editor/actions
6. After all jobs pass, verify the release at https://github.com/g4rcez/writeme-editor/releases
7. Verify the tap was updated: check both files in `g4rcez/homebrew-writeme`

---

## Verifying the Install (after first release)

```bash
brew tap g4rcez/writeme

# Install desktop app
brew install --cask writeme

# Install CLI
brew install g4rcez/writeme/writeme
writeme query
# → prints: Usage: writeme query <notes|tags|settings|projects> [options]

# Audit (checks for common cask/formula issues)
brew audit --cask g4rcez/writeme/writeme
brew audit --formula g4rcez/writeme/writeme
```

---

## Rotating the TAP_GITHUB_TOKEN

When the PAT expires:
1. Generate a new PAT at https://github.com/settings/tokens
2. Update the `TAP_GITHUB_TOKEN` secret in `writeme-editor` repository settings
