# Plan 015: Make legacy credential migration fail safe before Dexie cleanup

> **Status:** COMPLETE — the approved safe policy, focused checks, and required builds pass. Repository-wide lint still reports six errors in untouched files; targeted lint on changed files passes.
>
> **Executor instructions:** The safe default is approved. Follow each step in order, run the authorized verification commands, and stop on any STOP condition. The implementation starts from commit `54057af6409e28a1106bc147387ca89dedaafe3e`; do not start from `main` unless that commit has been integrated first.
>
> **Planned at:** `54057af`
>
> **Drift check:**
> `git diff --stat 54057af..HEAD -- packages/editor/src/lib/dexie-to-sqlite-migration.ts packages/editor/src/lib/dexie-to-sqlite-migration.test.ts packages/editor/src/main-process/credential-storage.ts packages/editor/src/main-process/credential-storage.test.ts`
>
> Before implementation, compare the live code with **Baseline findings** and stop if the migration state machine or credential conflict rules no longer match.

## Why this matters

Commit `54057af` added protections against plaintext credential writes, unsuitable Linux storage backends, and premature source cleanup. Review found two remaining risks in the baseline code; this plan addresses them:

1. `packages/editor/src/lib/dexie-to-sqlite-migration.ts` used only the `dexie_sqlite_migration_v2` marker. A state marked `verified` could reach `removeVerifiedDexie()` before the current credential checks ran, allowing startup to delete the Dexie source without validating the stricter policy.
2. `packages/editor/src/main-process/credential-storage.ts` treated decryption failures not matching its version-prefix heuristic as unprotected plaintext. A failure can instead mean ciphertext protected by an unavailable or changed OS key. Re-encrypting that ciphertext as a logical credential can corrupt it and allow source deletion.

The safe default is to retain both stores whenever the code cannot prove which value is plaintext and protected. Automatic cleanup must require a current credential-policy marker and successful protected-storage verification.

## Approved decision

The user approved the safe default: treat a SQLite credential that cannot be decrypted and differs from the Dexie source as opaque. Return `skipped`, leave both stores unchanged, and require explicit credential re-entry later. Do not infer plaintext from a decryption failure, timestamps, or a version prefix. Exact equality with the Dexie source may establish a legacy plaintext value and allow protected rewrite. Do not delete the Dexie source until the current credential policy passes protected-storage verification.

## Baseline findings

### Legacy verified state was trusted before current credential checks

`packages/editor/src/lib/dexie-to-sqlite-migration.ts`:

```ts
const MIGRATION_KEY = "dexie_sqlite_migration_v2";

export async function migrateDexieToSqlite(): Promise<void> {
    const state = readState();
    try {
        if (await removeVerifiedDexie(state)) return;
        // Credential migration runs later.
```

`removeVerifiedDexie()` verifies generic collections but does not require a current credential-policy version before deleting Dexie.

### Decrypt failure was classified as unprotected plaintext

`packages/editor/src/main-process/credential-storage.ts` used a version-prefix heuristic to identify some undecryptable values, but treated other decryption failures as plaintext. Later conflict handling could select such a value as the winner and pass it to `persistCredentialRow()`. That is safe only when equality with the Dexie source proves the stored value is plaintext; it is unsafe for a differing undecryptable value.

## Scope

**In scope — only these files may change:**

- `packages/editor/src/lib/dexie-to-sqlite-migration.ts`
- `packages/editor/src/lib/dexie-to-sqlite-migration.test.ts`
- `packages/editor/src/main-process/credential-storage.ts`
- `packages/editor/src/main-process/credential-storage.test.ts`

**Out of scope:**

- Database schema or index changes.
- New dependencies.
- UI for credential re-entry or recovery.
- Automatic deletion of ambiguous SQLite credentials.
- Changes to normal startup failure tolerance.
- Changes to generic record parsing, UUID policy, trash behavior, or keyset pagination.
- Package or lockfile changes.

## Implementation steps

### Step 1: Version credential migration policy independently of generic migration

Add a current credential-policy version to `MigrationState` rather than trusting the existing v2 status alone.

Required behavior:

- A legacy state with `status: "verified"` but no current credential-policy marker must not enter `removeVerifiedDexie()`.
- Preserve completed generic store states; do not replay all generic collections only to re-evaluate credentials.
- Clear/downgrade only the cleanup eligibility and credential completion state, then run `migrateCredentials()` again.
- Mark the policy current only after credential migration completes without skipped records using suitable secure storage.
- `removeVerifiedDexie()` must require both current policy and completed credential state before deleting Dexie.
- If secure storage is unavailable/unsuitable, retain Dexie and keep cleanup ineligible while normal startup continues.

Tests in `packages/editor/src/lib/dexie-to-sqlite-migration.test.ts`:

1. Legacy `verified` v2 state plus a credential source does not delete Dexie before credential migration.
2. The same state with `basic_text`, `unknown`, or unavailable storage remains retained.
3. Successful current-policy credential migration permits cleanup only on the following startup, preserving the existing delayed-cleanup rule.
4. Completed generic stores are not replayed during credential-policy upgrade.

Verification:

```sh
npm test -- packages/editor/src/lib/dexie-to-sqlite-migration.test.ts
```

Expected: all migration tests pass, including the four policy-version cases.

### Step 2: Preserve ambiguous undecryptable destination credentials

Implement the approved decision.

With the approved policy:

- Keep the current repair when an undecryptable stored value exactly matches the Dexie source; equality establishes the plaintext value and it may be encrypted safely.
- Keep current source-newer repair only when the destination is known plaintext by an explicit, reliable signal. A decrypt failure alone is not such a signal.
- When an undecryptable destination differs from the source, return `skipped`, leave SQLite unchanged, and retain Dexie regardless of timestamps.
- Do not log, embed in errors, or return credential values.
- Already decryptable/protected conflict behavior remains unchanged.

Tests in `packages/editor/src/main-process/credential-storage.test.ts`:

1. Matching plaintext destination is rewritten protected.
2. Differing undecryptable destination returns `skipped`; raw SQLite columns remain byte-for-byte unchanged.
3. Differing protected destination still follows timestamp conflict behavior.
4. Unsuitable backend remains `skipped` with no write.
5. No error or migration result contains credential values.

Verification:

```sh
npm test -- packages/editor/src/main-process/credential-storage.test.ts
```

Expected: all credential tests pass, including ambiguous-destination retention.

### Step 3: Run the complete focused database gate

```sh
npm test -- packages/editor/src/ipc/database.ipc.test.ts packages/editor/src/lib/dexie-to-sqlite-migration.test.ts packages/editor/src/main-process/credential-storage.test.ts packages/editor/src/main-process/database.test.ts packages/editor/src/store/global.store.test.ts packages/editor/src/store/repositories/electron/notes.repository.test.ts
npm run typecheck
npm run lint
npm run browser:build
npm run package:app
git diff --check 54057af..HEAD
git status --short
```

Expected:

- Focused tests all pass.
- Typecheck exits 0.
- Oxlint exits 0. If the known npm output-wrapper EOF anomaly recurs, run direct Oxlint on every changed file and record both results; do not change lint configuration.
- Browser and Electron package builds exit 0.
- Diff check exits 0.
- Only the four in-scope files are modified before commit; the worktree is clean after commit.

## Execution checkpoint — 2026-10-08

- Six focused database test files passed (58 tests); `npm run typecheck` passed.
- `npm run browser:build` and `npm run package:app` passed. The packaged app passed `codesign --verify --deep --strict`, and its configured Electron fuses were confirmed.
- Targeted Oxlint on changed source and test files, targeted formatting, and the working-tree diff check passed.
- Repository-wide `npm run lint` still fails on six unused-variable errors in untouched files: `packages/editor/src/lib/link-utils.ts`, `packages/editor/src/app/elements/callout.tsx`, `packages/editor/src/lib/url-utils.ts`, `packages/editor/src/lib/read-it-later-utils.ts`, and `.agents/skills/design-system/scripts/generate-tokens.cjs`. These files are outside this plan's scope and were not changed.
- No files were staged or committed; the shared worktree contains unrelated work that must be preserved.

## Test plan

Follow the behavior-focused style already present in:

- `packages/editor/src/lib/dexie-to-sqlite-migration.test.ts` for persisted migration state and delayed cleanup.
- `packages/editor/src/main-process/credential-storage.test.ts` for real temporary SQLite rows and mocked safeStorage behavior.

Do not weaken tests to mock the expected status directly. Assert source retention/deletion calls, persisted migration state, SQLite row contents, and secure-storage calls.

## Done criteria

- [x] A legacy verified state cannot delete Dexie before current credential-policy validation.
- [x] Generic completed stores are not needlessly replayed during policy upgrade.
- [x] Unsuitable secure storage leaves credential source data retryable.
- [x] Differing undecryptable SQLite credentials are not rewritten or treated as plaintext without proof.
- [x] Matching known plaintext credentials are repaired to protected storage.
- [x] Focused tests, typecheck, browser build, and Electron package build pass.
- [x] No dependency, schema, index, package, or lockfile change for Plan 015.
- [x] Plan 015 source/test changes are limited to its four approved paths; unrelated shared-worktree changes remain untouched.

## STOP conditions

Stop and report instead of improvising if:

- The approved decision is not recorded.
- Safe handling requires deleting or overwriting an ambiguous credential.
- The implementation would make normal startup fail because migration or secure storage is unavailable.
- Generic completed collections must be replayed to version credential policy.
- Any file outside scope is required.
- A focused test, typecheck, or build fails twice after an in-scope correction.

## Maintenance note

Future credential formats should include an explicit versioned envelope so code can distinguish plaintext, supported ciphertext, and undecryptable legacy ciphertext without probing. That is a separate migration/design task; do not add it opportunistically here.

## Git workflow

- Continue from `g4rcez/db-refactor-review` at `54057af`, or from a branch where that commit has been integrated.
- Amend the isolated follow-up commit or create one conventional commit: `fix(database): make credential cleanup fail safe`.
- Do not merge, push, or open a PR without operator approval.
