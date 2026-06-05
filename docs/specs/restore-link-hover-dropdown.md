# Feature: Restore full link hover dropdown

## Problem

Custom-labelled editor links now render as normal text links, but the hover dropdown that shows the full target URL only exists for standalone domain-link preview nodes. Users can no longer hover a labelled link and see the full destination.

## Solution

- Add a React mark view for `LinkMark` so labelled text links use the shared `LinkPreview` hover popover.
- Show the full `href` inside the popover with wrapping for long URLs.
- Add `data-link-url` and `title` attributes as a static/rendered fallback for full-link visibility.
- Keep standalone domain-link previews unchanged, except make the full URL inside the preview a real wrapping link.

## Edge Cases

- Selected text plus pasted URL should still serialize as a labelled markdown link.
- Labelled markdown links should remain text marks, not domain-link nodes.
- Long URLs should wrap instead of being clipped in the popover.
- Mention links should stay excluded from `LinkMark` parsing.

## Task Breakdown

- [x] Locate link preview and labelled link rendering paths.
- [x] Add hover preview rendering for `LinkMark`.
- [x] Improve full URL display in link previews.
- [x] Add regression coverage for labelled link hover trigger attributes.
- [x] Run targeted tests and diagnostics.
- [x] Perform self-review for scope and theming.

## Manual Verification

- [x] Labelled links render an editor hover trigger with `data-link-url` and a full-link `title` fallback.

## Definition of Done

- [x] Hovering a labelled text link has a full-URL popover trigger in the editor.
- [x] Static HTML for labelled links includes `data-link-url` and a full-link `title` fallback.
- [x] Existing selected-text URL paste behavior remains unchanged.
- [x] Targeted tests pass: `npm test -- src/app/extensions/link-paste.test.tsx src/app/extensions/mention-link.test.tsx`.
- [x] LSP diagnostics pass for changed source/test files.
- [x] `npm run typecheck` remains blocked by the existing TypeScript 6 `baseUrl` deprecation; filtering `tsc --ignoreDeprecations 6.0` for changed link files returned no errors.
- [x] Self-review complete: the fix is scoped to link rendering/preview, uses design-system token classes, and preserves mention/domain-link behavior.
