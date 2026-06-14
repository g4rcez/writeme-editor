# Plan 002: Harden AI command execution across the renderer/main boundary

> **Executor instructions**: Follow this plan step by step. Run every verification command. If a STOP condition occurs, stop and report. Update `plans/README.md` when done.
>
> **Drift check (run first)**: `git diff --stat 67641c2..HEAD -- src/preload.ts src/main.ts src/main-process/ai-runner.ts src/lib src/main-process`

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `67641c2`, 2026-06-14

## Why this matters

AI commands cross from renderer-controlled UI/configuration into the privileged Electron main process. Today prompt and system-prompt text are interpolated into a shell command and executed with `shell: true`. This makes user content and configuration part of shell syntax instead of data.

## Current state

- `src/preload.ts:240` exposes `ai.query({ commandTemplate, prompt, selection, context })`.
- `src/main.ts:53-58` receives `{ commandTemplate, prompt, selection, context, systemPrompt }` and calls `AIRunner.run(...)`.
- `src/main-process/ai-runner.ts:19-24` replaces `{{prompt}}` and `{{system_prompt}}` directly in a command string.
- `src/main-process/ai-runner.ts:40` executes `spawn(cleanCommand, { shell: true })`.
- Existing behavior intentionally supports templates, pipes, and redirections; do not silently break users without a migration path.

## Commands you will need

| Purpose         | Command                            | Expected on success |
| --------------- | ---------------------------------- | ------------------- |
| Typecheck       | `npm run typecheck`                | exit 0              |
| Tests           | `npm run test -- src/main-process` | targeted tests pass |
| Full unit suite | `npm run test`                     | all unit tests pass |

## Scope

**In scope**:

- `src/main-process/ai-runner.ts`
- Main/preload AI query types and call sites
- New tests for command parsing and variable handling

**Out of scope**:

- Replacing all AI provider adapters
- Changing chat UI/UX
- Logging prompt, selection, context, or credentials

## Git workflow

- Branch: `advisor/002-harden-ai-command-execution`
- Commit message: `fix(security): harden AI command execution`

## Steps

### Step 1: Characterize current template behavior

Add tests around `AIRunner` or an extracted parser that document supported placeholders: `{{prompt}}`, `{{system_prompt}}`, `{{selection}}`, and `{{context}}`. Do not include dangerous runnable examples; assert data boundaries at a high level.

**Verify**: targeted tests run and describe current behavior.

### Step 2: Replace shell-string execution with an argv-based model

Introduce a structured command representation: executable path plus argv array. Pass prompt/system prompt/selection/context as stdin or other data channels, not shell syntax. If supporting legacy shell templates is unavoidable, gate it behind an explicit opt-in setting and clearly mark it unsafe in the UI/configuration.

**Verify**: `npm run typecheck` exits 0.

### Step 3: Preserve legitimate streaming behavior

Keep stdout streaming to `ai:chunk`, close handling to `ai:done`, stop behavior, and stderr/error reporting. Remove or narrow `console.log("AI Runner executing:", cleanCommand)` so sensitive prompt-derived data is not logged.

**Verify**: `npm run test -- src/main-process` passes.

### Step 4: Add regression tests for data boundaries

Test that prompt/system-prompt content is not appended to the executable command string and is delivered as data. Test stop/close behavior still sends expected events.

**Verify**: `npm run test` passes or unrelated failures are documented.

## Test plan

- New or updated tests under `src/main-process/` modeled after existing runner tests such as `src/main-process/git-runner.test.ts`.
- Cover parser/argv construction, stdin/data handling, stdout chunk forwarding, process errors, and stop behavior.

## Done criteria

- [ ] Prompt/system-prompt/selection/context are not interpolated into shell syntax by default.
- [ ] Legacy shell behavior, if retained, requires explicit opt-in and is documented as unsafe.
- [ ] No sensitive prompt/context content is logged.
- [ ] `npm run typecheck` and targeted tests pass.
- [ ] `plans/README.md` row updated.

## STOP conditions

- Existing saved AI configurations cannot be represented without shell syntax and there is no acceptable migration/opt-in path.
- The fix requires changing public provider credential storage; use plan 006 instead.

## Maintenance notes

Reviewers should focus on the boundary between command configuration and user data. Future AI providers should prefer SDK/API adapters over shell templates where practical.
