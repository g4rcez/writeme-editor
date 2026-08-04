# Plan 015: Make legacy credential migration fail safe before Dexie cleanup

> **Status:** BLOCKED — requires the maintainer decision under **Decision required**.
>
> **Executor instructions:** Do not execute this plan until the decision is recorded. Once unblocked, follow each step in order, run every verification command, and stop on any STOP condition. The implementation starts from commit `54057af6409e28a1106bc147387ca89dedaafe3e` on branch `g4rcez/db-refactor-review`; do not start from `main` unless that commit has been integrated first.
>
> **Planned at:** `54057af`
>
> **Drift check:**
> `git diff --stat 54057af..HEAD -- src/lib/dexie-to-sqlite-migration.ts src/lib/dexie-to-sqlite-migration.test.ts src/main-process/credential-storage.ts src/main-process/credential-storage.test.ts`
>
> If any in-scope file changed, compare the live code with **Current state** and stop if the migration state machine or credential conflict rules no longer match.

## Why this matters

Commit `54057af` prevents new plaintext credential writes, rejects Electron Linux `basic_text`/`unknown` storage backends, repairs known plaintext rows, removes direct bulk-trash deletion IPC, and keyset-paginates generic Dexie migration. It is not safe to merge yet:

1. `src/lib/dexie-to-sqlite-migration.ts` still uses migration marker `dexie_sqlite_migration_v2`. A state previously marked `verified` reaches `removeVerifiedDexie()` before the new credential checks run. If the app was updated between “verified” and cleanup, the next startup can delete the Dexie credential source without applying the stricter backend and plaintext rules.
2. `src/main-process/credential-storage.ts` treats every `safeStorage.decryptString()` failure as proof of plaintext. A failure can instead mean ciphertext protected by an unavailable/changed OS key. Re-encrypting that ciphertext as though it were the logical credential corrupts the credential and can allow source deletion.

The safe default is to retain both stores whenever the code cannot prove which value is plaintext and protected. Automatic cleanup must require a current credential-policy marker and successful protected-storage verification.

## Decision required

Choose the behavior for an existing SQLite credential that cannot be decrypted and differs from the Dexie source.

**Recommended:** treat it as opaque, return `skipped`, leave both SQLite and Dexie unchanged, and require explicit credential re-entry later. Never guess that the undecryptable value is plaintext and never delete the Dexie source.

Alternatives require a separate product/security design because they either discard a potentially newer credential or keep a potentially plaintext value active.

## Current state

### Legacy verified state is trusted before current credential checks

`src/lib/dexie-to-sqlite-migration.ts`:

```ts
const MIGRATION_KEY = "dexie_sqlite_migration_v2";

export async function migrateDexieToSqlite(): Promise<void> {
    const state = readState();
    try {
        if (await removeVerifiedDexie(state)) return;
        // Credential migration runs later.
```

`removeVerifiedDexie()` verifies generic collections but does not require a current credential-policy version before deleting Dexie.

### Decrypt failure is classified as unprotected plaintext

`src/main-process/credential-storage.ts`:

```ts
try {
    return {
        value: secureStorage.decryptString(Buffer.from(secret, "base64")),
        protected: true,
    };
} catch {
    return { value: secret, protected: false };
}
```

Later conflict handling may select that returned value as the winner and pass it to `persistCredentialRow()`. That is safe only when equality with the Dexie source proves the stored value is plaintext; it is unsafe for a differing undecryptable value.

## Scope

**In scope — only these files may change:**

- `src/lib/dexie-to-sqlite-migration.ts`
- `src/lib/dexie-to-sqlite-migration.test.ts`
- `src/main-process/credential-storage.ts`
- `src/main-process/credential-storage.test.ts`

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

Tests in `src/lib/dexie-to-sqlite-migration.test.ts`:

1. Legacy `verified` v2 state plus a credential source does not delete Dexie before credential migration.
2. The same state with `basic_text`, `unknown`, or unavailable storage remains retained.
3. Successful current-policy credential migration permits cleanup only on the following startup, preserving the existing delayed-cleanup rule.
4. Completed generic stores are not replayed during credential-policy upgrade.

Verification:

```sh
npm test -- src/lib/dexie-to-sqlite-migration.test.ts
```

Expected: all migration tests pass, including the four policy-version cases.

### Step 2: Preserve ambiguous undecryptable destination credentials

Implement the approved decision.

With the recommended policy:

- Keep the current repair when an undecryptable stored value exactly matches the Dexie source; equality establishes the plaintext value and it may be encrypted safely.
- Keep current source-newer repair only when the destination is known plaintext by an explicit, reliable signal. A decrypt failure alone is not such a signal.
- When an undecryptable destination differs from the source, return `skipped`, leave SQLite unchanged, and retain Dexie regardless of timestamps.
- Do not log, embed in errors, or return credential values.
- Already decryptable/protected conflict behavior remains unchanged.

Tests in `src/main-process/credential-storage.test.ts`:

1. Matching plaintext destination is rewritten protected.
2. Differing undecryptable destination returns `skipped`; raw SQLite columns remain byte-for-byte unchanged.
3. Differing protected destination still follows timestamp conflict behavior.
4. Unsuitable backend remains `skipped` with no write.
5. No error or migration result contains credential values.

Verification:

```sh
npm test -- src/main-process/credential-storage.test.ts
```

Expected: all credential tests pass, including ambiguous-destination retention.

### Step 3: Run the complete focused database gate

```sh
npm test -- src/ipc/database.ipc.test.ts src/lib/dexie-to-sqlite-migration.test.ts src/main-process/credential-storage.test.ts src/main-process/database.test.ts src/store/global.store.test.ts src/store/repositories/electron/notes.repository.test.ts
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

## Test plan

Follow the behavior-focused style already present in:

- `src/lib/dexie-to-sqlite-migration.test.ts` for persisted migration state and delayed cleanup.
- `src/main-process/credential-storage.test.ts` for real temporary SQLite rows and mocked safeStorage behavior.

Do not weaken tests to mock the expected status directly. Assert source retention/deletion calls, persisted migration state, SQLite row contents, and secure-storage calls.

## Done criteria

- [ ] A legacy verified state cannot delete Dexie before current credential-policy validation.
- [ ] Generic completed stores are not needlessly replayed during policy upgrade.
- [ ] Unsuitable secure storage leaves credential source data retryable.
- [ ] Differing undecryptable SQLite credentials are not rewritten or treated as plaintext without proof.
- [ ] Matching known plaintext credentials are repaired to protected storage.
- [ ] Focused tests, typecheck, browser build, and Electron package build pass.
- [ ] No dependency, schema, index, package, or lockfile change.
- [ ] Only in-scope files change.

## STOP conditions

Stop and report instead of improvising if:

- The maintainer has not answered **Decision required**.
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
