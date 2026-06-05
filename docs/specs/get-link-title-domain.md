# Feature: getLinkTitleDomain helper

## Problem

`DomainLinkDisplay` knows how to derive a short display title for domain links, but that title is embedded in JSX returned by `DOMAIN_CONFIGS`. Other places need the plain text title without duplicating URL matching logic.

## Solution

- Refactor `DOMAIN_CONFIGS` so each domain config exposes a plain `title(match)` function.
- Implement `getLinkTitleDomain(url)` to return the same title string used by domain-link display.
- Keep icon rendering in `DomainLinkDisplay`, but derive the visible text from `getLinkTitleDomain`/config title logic.
- Fall back to the generic hostname label for unknown HTTP(S) URLs or malformed input.

## Edge Cases

- GitHub repository URLs should include `owner/repo`; owner-only URLs should include only the owner.
- Twitter/X URLs should keep the `@` prefix.
- Unknown domains should return the hostname without `www.`.
- Invalid URLs should return the original string.
- Existing domain-link parsing, paste/input rules, and markdown serialization should remain unchanged.

## Task Breakdown

- [x] Inspect current domain-link display/config structure.
- [x] Refactor domain configs around a shared title function.
- [x] Implement and export `getLinkTitleDomain(url)`.
- [x] Add focused regression tests for known domains and fallback behavior.
- [x] Run targeted tests and diagnostics.
- [x] Perform self-review for simplicity and scope.

## Manual Verification

- [x] Confirmed `DomainLinkDisplay` renders the same text returned by `getLinkTitleDomain(url)` through regression coverage.

## Definition of Done

- [x] `getLinkTitleDomain(url)` returns the same visible text that `DomainLinkDisplay` renders.
- [x] Known domain behavior remains unchanged.
- [x] Generic/invalid URL fallbacks are covered.
- [x] Targeted tests pass: `npm test -- src/app/extensions/domain-link.test.tsx src/app/extensions/link-paste.test.tsx`.
- [x] LSP diagnostics pass for changed files.
- [x] `npm run typecheck` remains blocked by the existing TypeScript 6 `baseUrl` deprecation; filtering `tsc --ignoreDeprecations 6.0` for `domain-link` returned no errors.
- [x] Self-review complete: one title function drives both plain-text and display rendering, with no unrelated domain-link node behavior changes.
