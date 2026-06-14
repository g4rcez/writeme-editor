# Plan 011: Spike integrated search as the next product slice

> **Executor instructions**: This is a design/spike plan, not a build-everything plan. Produce a short design artifact and a minimal prototype only if it answers the questions below. Run every verification command that applies. If a STOP condition occurs, stop and report. Update `plans/README.md` when done.
>
> **Drift check (run first)**: `git diff --stat 67641c2..HEAD -- README.md PRODUCT.md src/app src/store src/app/extensions`

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `67641c2`, 2026-06-14

## Why this matters

Product docs say the primary workflow is “writing, then finding, then linking,” and the README roadmap lists Search Integration. Search is therefore the most grounded next product slice: it directly improves finding and linking in a knowledge tool users keep open all day.

## Current state

- `PRODUCT.md:11` describes users and says the primary workflow is “writing, then finding, then linking.”
- `README.md:124` lists “Search Integration: Full integration with TipTap Search extension.”
- `CLAUDE.md` notes editor pitfalls around Tiptap suggestions and custom editor navigation.
- A project skill exists for Tiptap selection/scroll behavior; if available, use it when designing result navigation.

## Commands you will need

| Purpose      | Command             | Expected on success                              |
| ------------ | ------------------- | ------------------------------------------------ | ------------- | ---------------- | ----------------------------------------- | ----------------------------- |
| Typecheck    | `npm run typecheck` | exit 0 if code prototype is touched              |
| Tests        | `npm run test`      | all unit tests pass if code prototype is touched |
| Search recon | `rg "search         | find                                             | TipTap Search | setTextSelection | scrollIntoView" src README.md PRODUCT.md` | records existing related code |

## Scope

**In scope**:

- A design note under `plans/search-spike-notes.md` or a section appended to this plan during execution
- Optional minimal prototype behind an internal flag or isolated component if needed to validate feasibility
- Recon of editor, repository, and keyboard UX integration points

**Out of scope**:

- Shipping a full search product slice
- Replacing storage backends
- Indexing every note with a new dependency without approval
- Changing global keyboard shortcuts without explicit design choice

## Git workflow

- Branch: `advisor/011-spike-integrated-search`
- Commit message if code/docs are changed: `docs(search): spike integrated search`

## Steps

### Step 1: Map existing search/find surfaces

Search the codebase for existing search, command palette, note lookup, editor navigation, and Tiptap selection APIs. Identify whether current search is note-list only, editor-only, or absent.

**Verify**: produce a concise list of files/symbols and their roles.

### Step 2: Define the first shippable search slice

Decide whether v1 should search current note content, all notes metadata/content, tags, or open tabs. Recommend the smallest slice that supports “finding” without overbuilding. Include keyboard entry point, result layout, ranking/order, empty state, and reduced-motion/accessibility constraints.

**Verify**: write the decision and rejected alternatives.

### Step 3: Define storage/query strategy

For Dexie, SQLite, and filesystem mode, specify how search reads data. If full-text indexing is proposed, identify whether it needs a dependency, schema migration, or background index. If not, define acceptable limits for a simple scan.

**Verify**: document per-storage-mode behavior and open questions.

### Step 4: Define editor result navigation

Specify how selecting a match navigates to the note and scrolls/selects the match in Tiptap. Include edge cases: note not open, stale match after edit, large markdown worker threshold, and keyboard accessibility.

**Verify**: design includes STOP/deferred items for uncertain Tiptap behavior.

### Step 5: Optional feasibility prototype

Only build a prototype if a key technical uncertainty remains. Keep it behind a dev-only path or isolated component and remove it if not intended to ship.

**Verify**: `npm run typecheck` and `npm run test` if code changed.

## Test plan

For the eventual implementation plan, require tests for query normalization, ranking/order, storage mode behavior, keyboard navigation, no-result state, and editor scroll/selection. This spike itself is validated by a clear design artifact and any prototype checks.

## Done criteria

- [ ] A self-contained search design/spike note exists with recommended v1 scope.
- [ ] Storage strategy covers Dexie, SQLite, and filesystem modes.
- [ ] Editor navigation strategy covers result selection and stale matches.
- [ ] Any code prototype is validated with `npm run typecheck` and `npm run test`.

## STOP conditions

- The desired v1 requires a new search/indexing dependency; ask before adding it.
- Search semantics conflict with an existing undocumented implementation discovered during recon.

## Maintenance notes

Search should respect the product’s calm, keyboard-friendly workflow. Avoid a flashy AI-search direction unless it directly supports finding/linking and can be explained as a collaborator, not a gimmick.
