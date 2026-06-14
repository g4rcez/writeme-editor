# Plan 006: Move AI provider secrets out of plaintext SQLite

> **Executor instructions**: Follow this plan step by step. Run every verification command. If a STOP condition occurs, stop and report. Update `plans/README.md` when done.
>
> **Drift check (run first)**: `git diff --stat 67641c2..HEAD -- src/main.ts src/main-process/database.ts src/preload.ts src/app src/store`

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `67641c2`, 2026-06-14

## Why this matters

AI provider tokens and API keys are currently stored as plaintext application data in SQLite. Local database disclosure, backups, or sync can expose reusable provider credentials. Desktop apps should use the OS credential store for secrets and keep only non-secret metadata in the app database.

## Current state

- `src/main.ts:172-184` handles `ai:save-credentials` and writes `accessToken`, `refreshToken`, and `apiKey` into SQLite.
- `src/main-process/database.ts:158-166` defines `aiCredentials` with plaintext `accessToken`, `refreshToken`, and `apiKey` columns.
- Do not reproduce any actual credential values in logs, tests, plans, or docs.

## Commands you will need

| Purpose         | Command                            | Expected on success |
| --------------- | ---------------------------------- | ------------------- |
| Typecheck       | `npm run typecheck`                | exit 0              |
| Tests           | `npm run test -- src/main-process` | targeted tests pass |
| Full unit suite | `npm run test`                     | all unit tests pass |

## Scope

**In scope**:

- AI credential save/load/delete IPC handlers in `src/main.ts` or extracted modules
- `src/main-process/database.ts` schema/migration logic
- New credential-store abstraction and tests

**Out of scope**:

- Changing AI provider UX beyond necessary migration/error messaging
- Rotating real user credentials automatically
- Printing or copying secret values

## Git workflow

- Branch: `advisor/006-secure-ai-credentials`
- Commit message: `fix(security): store AI credentials in OS keychain`

## Steps

### Step 1: Choose and isolate a credential storage backend

Use an existing dependency only if one already exists; otherwise ask before adding a dependency. Implement a narrow abstraction such as `saveSecret(adapterId, kind, value)`, `getSecret(...)`, and `deleteSecret(...)`. On unsupported platforms/tests, provide a safe mock/in-memory implementation only for tests.

**Verify**: abstraction tests pass without touching real user credentials.

### Step 2: Split secret and non-secret metadata

Keep adapter ID, expiry, created/updated timestamps, and non-secret metadata in SQLite. Store access tokens, refresh tokens, and API keys in the credential store. Ensure retrieval reconstructs the shape expected by existing callers without exposing secrets to unrelated code.

**Verify**: `npm run typecheck` exits 0.

### Step 3: Add one-time migration from SQLite secrets

On startup or first credential access, read existing plaintext values, write them to the secure store, then clear plaintext values from SQLite. Preserve rollback/error behavior: if secure storage write fails, do not delete the SQLite value yet. Include a user-facing recommendation to rotate credentials already persisted in plaintext if the app has a notification/settings surface for that.

**Verify**: migration tests cover success and secure-store failure.

### Step 4: Remove secret logging and harden tests

Ensure no handler logs token/key values. Test data must use fake placeholder strings and must not assert by printing secret values.

**Verify**: `rg "accessToken|refreshToken|apiKey" src/main.ts src/main-process src/app` shows no unsafe logging or plaintext persistence beyond migration code.

## Test plan

- Tests for save/load/delete through the abstraction.
- Migration tests for existing plaintext rows.
- Failure tests: secure store write fails, SQLite values are preserved and an error is surfaced safely.

## Done criteria

- [ ] New saves do not persist provider secrets in plaintext SQLite columns.
- [ ] Existing plaintext secrets migrate safely to secure storage.
- [ ] No secret values are logged or reproduced in tests/docs.
- [ ] `npm run typecheck` and targeted tests pass.

## STOP conditions

- A new third-party package is required and the operator has not approved dependency changes.
- Secure storage is unavailable on a supported platform and no safe fallback policy is agreed.

## Maintenance notes

Future provider integrations must use the credential abstraction. Reviewers should inspect migration failure behavior and ensure secrets never enter renderer state unless required for a specific provider flow.
