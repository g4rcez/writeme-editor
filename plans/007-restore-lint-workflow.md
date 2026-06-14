# Plan 007: Restore or remove the documented lint workflow

> **Executor instructions**: Follow this plan step by step. Run every verification command. If a STOP condition occurs, stop and report. Update `plans/README.md` when done.
>
> **Drift check (run first)**: `git diff --stat 67641c2..HEAD -- package.json AGENTS.md CLAUDE.md eslint.config.* .eslintrc*`

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `67641c2`, 2026-06-14

## Why this matters

Repo guidance tells contributors and agents to run `npm run lint`, but `package.json` does not define it. That creates failed validation loops and makes static checks ambiguous. The repo should either provide the documented command or remove/replace the documentation.

## Current state

- `AGENTS.md:11` documents `npm run lint`.
- `CLAUDE.md:15` documents `npm run lint`.
- `package.json:57-60` defines `typecheck`, `format`, `format:check`, and `test`, but no `lint` script.
- There is no obvious ESLint config in the root files discovered during recon.

## Commands you will need

| Purpose         | Command                | Expected on success                                |
| --------------- | ---------------------- | -------------------------------------------------- |
| Inspect scripts | `npm run`              | shows available scripts                            |
| Typecheck       | `npm run typecheck`    | exit 0                                             |
| Format check    | `npm run format:check` | exit 0 or pre-existing formatting drift documented |
| Tests           | `npm run test`         | all unit tests pass                                |

## Scope

**In scope**:

- `package.json`
- ESLint config files only if choosing to add a real lint workflow
- `AGENTS.md` and `CLAUDE.md` references to lint only as needed

**Out of scope**:

- Large style refactors to satisfy a new lint config
- Adding dependencies without operator approval
- Reformatting the codebase

## Git workflow

- Branch: `advisor/007-restore-lint-workflow`
- Commit message: `chore(dx): sync lint workflow`

## Steps

### Step 1: Decide whether linting should exist now

If ESLint dependencies/config already exist in lockfile or project config, add a script that runs check mode only. If adding ESLint packages is required, ask the operator first. If linting is intentionally absent, remove lint references from docs and make `typecheck`, `format:check`, and tests the documented validation gates.

**Verify**: the chosen command path is recorded in the PR/summary.

### Step 2: Implement the smallest consistent workflow

Either add a working `lint` script and config, or remove stale `npm run lint` references. Do not introduce broad code changes to satisfy lint rules in this plan.

**Verify**: `npm run` shows the expected scripts.

### Step 3: Validate current gates

Run the validation commands that remain documented.

**Verify**: `npm run typecheck`, `npm run format:check`, and `npm run test` pass or pre-existing failures are documented.

## Test plan

No product tests are required unless a tooling helper is added. The validation is the script command itself plus existing typecheck/test/format checks.

## Done criteria

- [ ] Documentation and `package.json` agree on whether `npm run lint` exists.
- [ ] No new dependency is added without approval.
- [ ] `npm run typecheck` and `npm run test` pass or unrelated failures are documented.
- [ ] `plans/README.md` row updated.

## STOP conditions

- Adding lint requires new dependencies and the operator has not approved them.
- Enabling lint reveals widespread violations that require broad source edits.

## Maintenance notes

This plan unblocks plan 008. Keep the workflow boring and reproducible; do not use this plan to debate the final lint rule set.
