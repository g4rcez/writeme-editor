# Plan 008: Sync contributor docs with current scripts and tests

> **Executor instructions**: Follow this plan step by step. Run every verification command. If a STOP condition occurs, stop and report. Update `plans/README.md` when done.
>
> **Drift check (run first)**: `git diff --stat 67641c2..HEAD -- AGENTS.md CLAUDE.md README.md package.json`

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/007-restore-lint-workflow.md
- **Category**: docs
- **Planned at**: commit `67641c2`, 2026-06-14

## Why this matters

Contributor docs are stale in ways that directly affect onboarding and agent execution. They mention non-existent scripts and say no test framework is configured, while `package.json` includes Vitest and Playwright. Docs should match the actual verification workflow.

## Current state

- `AGENTS.md:12` documents `npm run package`, but `package.json:54` defines `build:package`.
- `AGENTS.md:15` says “No test framework configured”.
- `package.json:60-62` defines `test`, `test:e2e`, and `test:e2e:ui`.
- `README.md:81` already documents `npm run build:package` for packaging.
- Plan 007 decides whether `npm run lint` remains documented.

## Commands you will need

| Purpose           | Command               | Expected on success |
| ----------------- | --------------------- | ------------------- | ------------------------------------------------- | --------------------------------------------------------------------------- |
| Script inspection | `npm run`             | scripts match docs  |
| Docs grep         | `rg "npm run (package | lint)               | No test framework" AGENTS.md CLAUDE.md README.md` | no stale references remain except intentional lint references from plan 007 |

## Scope

**In scope**:

- `AGENTS.md`
- `CLAUDE.md`
- `README.md` if it contains related stale command guidance

**Out of scope**:

- Changing package scripts; use plan 007 for lint workflow changes
- Rewriting product/marketing copy
- Adding new developer tooling

## Git workflow

- Branch: `advisor/008-sync-contributor-docs`
- Commit message: `docs: sync contributor commands`

## Steps

### Step 1: Apply the lint decision from plan 007

Read the completed plan 007 diff/status. If `npm run lint` exists, keep it documented. If it does not, remove it from docs and list the actual validation commands.

**Verify**: `npm run` and docs references agree.

### Step 2: Fix stale package/test guidance

Replace `npm run package` with `npm run build:package`. Replace “No test framework configured” with the current Vitest/Playwright guidance: `npm run test` for unit tests and `npm run test:e2e` for Playwright when appropriate.

**Verify**: docs grep command shows no stale references.

### Step 3: Keep docs concise and consistent

Do not duplicate long script tables in every doc unless already present. Prefer a small, accurate command list.

**Verify**: manually inspect changed docs for consistency.

## Test plan

Docs-only. Run grep and `npm run` inspection; no unit tests are required unless package scripts are changed unexpectedly.

## Done criteria

- [ ] `AGENTS.md`, `CLAUDE.md`, and README command references match `package.json`.
- [ ] Test framework guidance mentions Vitest and Playwright accurately.
- [ ] Lint guidance matches plan 007.
- [ ] `plans/README.md` row updated.

## STOP conditions

- Plan 007 is not completed or its lint decision is unclear.
- Docs disagree about a command whose intended replacement is not obvious from `package.json`.

## Maintenance notes

Accurate docs are especially important in this repo because agent instructions are used as execution context. Keep command docs close to `package.json` when future scripts change.
