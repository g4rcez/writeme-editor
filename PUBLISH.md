# Publishing Writeme

This document covers the one-time setup required before the first release and the steps to cut a release.

---

## Prerequisites

- Access to the `g4rcez/writeme-editor` repository settings (to add secrets)
- A GitHub account that can create repositories
- Optional for signed macOS releases: Apple Developer Program membership ($99/year)
- Optional for signed macOS releases: a Developer ID Application certificate and `.p12` export

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

### 5. Optional: add Apple signing secrets to `writeme-editor`

The release workflow supports both unsigned and signed macOS artifacts.

If you do not have an Apple Developer certificate, leave these secrets unset. CI will publish `writeme-<version>-arm64-unsigned.dmg` and append manual install instructions to the GitHub release notes.

If you want signed and notarized macOS releases, add each of these at https://github.com/g4rcez/writeme-editor/settings/secrets/actions:

- `APPLE_ID` — Your Apple ID email (e.g. `you@icloud.com`)
- `APPLE_APP_SPECIFIC_PASSWORD` — App-specific password from https://appleid.apple.com → Sign-In and Security → App-Specific Passwords
- `APPLE_TEAM_ID` — Your 10-character Apple Developer Team ID (visible at https://developer.apple.com/account)
- `CSC_LINK` — Base64-encoded Developer ID Application `.p12` certificate: `base64 -i Developer_ID_Application.p12 | pbcopy`
- `CSC_KEY_PASSWORD` — The password you set when exporting the `.p12`

The macOS release job fails only when some Apple signing secrets are set and others are missing. This prevents accidentally publishing a broken partially configured release.

Optional: set `APPLE_SIGNING_IDENTITY` to the exact Developer ID Application identity if the imported keychain contains more than one valid signing identity.

Desktop releases are automated: merging a pull request into `main` creates a semver tag from the root app version and starts `.github/workflows/release.yml`. Do not create desktop version tags manually; `scripts/tag.sh` is for date-based development tags.

---

## Releasing a New Version

Publish all public npm packages from a clean checkout of `main`:

```sh
pnpm release patch
pnpm release minor
pnpm release major
```

The command validates every package before changing versions, bumps each package's own version, then publishes in dependency order: math, CLI, MCP. It uses npm for versioning and publication. `--dry-run` runs the validations and prints the planned operations without changing versions or publishing:

```sh
pnpm release patch --dry-run
```

The script leaves the updated package manifests and lockfiles in the working tree; commit those version changes through the normal pull-request workflow. If a publication fails, some earlier packages may already be live. The error lists the unpublished packages to retry; do not rerun the bump command for that release.

The `writeme.dev` npm organization must be available in the active npm login. After publishing packages, desktop installers, GitHub release assets, and the Homebrew tap are still produced by the merge-triggered release workflow.

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

If you install the unsigned DMG directly from GitHub instead of Homebrew, drag `writeme.app` to `/Applications`, then run:

```bash
xattr -dr com.apple.quarantine /Applications/writeme.app
open /Applications/writeme.app
```

The tap bump script adds `no_quarantine true` to the cask when the release artifact is unsigned.

---

## Rotating the TAP_GITHUB_TOKEN

When the PAT expires:

1. Generate a new PAT at https://github.com/settings/tokens
2. Update the `TAP_GITHUB_TOKEN` secret in `writeme-editor` repository settings
