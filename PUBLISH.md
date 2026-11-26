# Publishing Writeme

This document covers the one-time setup required before the first release and the steps to cut a release.

---

## Prerequisites

- A GitHub account that can create repositories, with `gh` logged in (it also pushes to the tap)
- For macOS releases: a Mac with Apple silicon, Bun, and a paid Apple Developer Program membership

---

## Homebrew

Writeme is in the tap [g4rcez/homebrew-tap](https://github.com/g4rcez/homebrew-tap), with `wm`:

| Command | Installs |
|---|---|
| `brew install --cask g4rcez/tap/writeme` | The app, and its `writeme` and `math-cli` commands in Homebrew's `bin` |
| `brew install g4rcez/tap/writeme-cli` | Only the `writeme` command |

Install one of the two: both put `writeme` in Homebrew's `bin`. Each release writes `Casks/writeme.rb` and
`Formula/writeme-cli.rb` of the tap from `scripts/homebrew/`: change them there, not in the tap.

## macOS releases and signing

The macOS files are signed with a Developer ID and notarized on the Mac that holds the certificate, not in CI. CI holds no
Apple secret. It builds the other platforms; the macOS files and the Homebrew tap come from `scripts/release-macos.sh`.

### Set up a release Mac

Do these once.

1. Make a **Developer ID Application** certificate (only the Account Holder can): Xcode > Settings > Accounts, select the team,
   Manage Certificates, `+`, Developer ID Application. `security find-identity -v -p codesigning` must then list it. An
   "Apple Development" certificate does not work for a release.
2. The Team ID, the 10 characters in parentheses at the end of the certificate name, is pinned in `scripts/signing-team-id`.
3. Make an app-specific password at [account.apple.com](https://account.apple.com) (Sign-In and Security), then save the
   notarization credentials in your keychain. The command asks for the password:

   ```sh
   xcrun notarytool store-credentials writeme-notary --apple-id "<your Apple ID>" --team-id "<Team ID>"
   ```

   Each app has its own profile, so do not reuse the one of another app. Give each profile its own app-specific password
   too: revoking it then stops the releases of that app only. `NOTARY_PROFILE` picks another profile.

4. Install the release agent:

   ```sh
   scripts/install-release-agent.sh
   ```

To release from another Mac, export the certificate with its private key from Keychain Access (a `.p12`), import it there, and
run step 3 again. Keep that `.p12` and its password somewhere safe, and never commit them.

### Release

Releases need no action. Merging a pull request creates the version tag (`auto-release.yml`). Every 10 minutes, the launchd
agent `dev.writeme.release-agent` on the release Mac looks at the newest tag. When the GitHub release of that tag has no macOS
files, it checks out the tag in its own clone (`~/Library/Application Support/writeme-release/repo`), runs `npm ci` and
`scripts/release-macos.sh` with the tag. A notification says when the release is out or when it failed. The log of each release is
`~/Library/Logs/writeme-release/<tag>.log`.

- It runs only while you are logged in and the Mac is awake; a tag made meanwhile is released at the next check.
- It runs only code of a version tag on origin, never of a pull request, and it tries a tag at most 3 times. To try again,
  delete `~/Library/Application Support/writeme-release/tags/<tag>.attempts`.
- Tags that do not contain `scripts/release-macos.sh` are skipped.
- Without the `writeme-notary` profile, it waits and shows a reminder once a day.
- Run `scripts/install-release-agent.sh` again after the agent scripts change, and `--remove` to stop it.

To release by hand instead:

```sh
git fetch --tags && git switch --detach vX.Y.Z
npm ci
scripts/release-macos.sh vX.Y.Z
```

The script:

1. checks the certificate, the notarization credentials, `gh`, that the tree is clean, that the newest tag is checked out and
   that its release has no macOS files yet;
2. builds `writeme.app` with the version of the tag, signed with the hardened runtime and a secure timestamp, and has Apple
   notarize it;
3. starts the packaged app and checks that it saves a note;
4. signs and notarizes the DMG and the standalone CLI, waiting up to 2 hours for Apple (`NOTARY_TIMEOUT=4h` waits longer);
5. runs `scripts/verify-macos-release.sh`, before anything is published;
6. attaches the DMG, the ZIP and the CLI to the GitHub release, creating it if CI has not;
7. downloads them again, and only when they are the verified files updates the cask and the formula of
   `g4rcez/homebrew-tap`.

`--no-publish` stops after step 5, works from any commit and leaves the files in `release-artifacts/macos`.

### What a release asserts

`scripts/verify-macos-release.sh <dir> <version>` fails, and so does the release, unless:

- `writeme.app`, in the DMG and in the ZIP, has exactly the designated requirement of `scripts/designated-requirement`;
- the signatures are intact, Gatekeeper sees a notarized Developer ID app and DMG, and the tickets are stapled to them;
- the CLI is signed by the pinned team, notarized, and runs under the hardened runtime;
- the files contain no home folder, user name or computer name of the release Mac.

A Developer ID signature is public: every copy of the app carries the name on the certificate (for an individual membership,
your legal name), the country and the Team ID.

### Permissions across releases

macOS keeps the privacy permissions and the keychain access of an app by its designated requirement, which for a Developer ID
signature names the bundle id and the Team ID. It stays the same through releases and certificate renewals. A new team or
bundle id makes every user grant the permissions again: change the pins only when you mean that.

### Signing of local builds

`npm run make` and `npm run package:app` sign with the certificate that `scripts/signing-identity.sh` picks:

1. the Developer ID Application certificate of the pinned team;
2. without it, the first "Apple Development" certificate (not for a release);
3. without any, an ad-hoc signature.

`APPLE_SIGNING_IDENTITY` overrides the choice (`-` asks for an ad-hoc signature). A local build has no secure timestamp, is
not notarized and works without the network. The first time `codesign` uses the key, macOS asks for access: choose
**Always Allow**.

### Hardened runtime

| File | Entitlements |
|---|---|
| `writeme.app` | `build/entitlements.mac.plist`: JIT, microphone (meeting notes), Apple events (commands run in the app) |
| Electron helpers | The defaults of `@electron/osx-sign` |
| Writeme CLI | `build/entitlements.cli.plist`: what Bun needs to run JavaScript |

A new use of a protected resource (camera, location) needs its entitlement there and its usage text in `forge.config.ts`.

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

The `writeme.dev` npm organization must be available in the active npm login. After publishing packages, the Windows and Linux installers are still produced by the merge-triggered release workflow, and the macOS files and the Homebrew tap by `scripts/release-macos.sh`.

---

## Verifying the Install (after a release)

```bash
brew install --cask g4rcez/tap/writeme
spctl --assess --type execute --verbose /Applications/writeme.app   # source=Notarized Developer ID
writeme --help

brew audit --cask g4rcez/tap/writeme
brew audit --formula g4rcez/tap/writeme-cli
```
