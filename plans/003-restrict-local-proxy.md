# Plan 003: Restrict the local proxy server

> **Executor instructions**: Follow this plan step by step. Run every verification command. If a STOP condition occurs, stop and report. Update `plans/README.md` when done.
>
> **Drift check (run first)**: `git diff --stat 67641c2..HEAD -- src/server/proxy.ts src/main.ts src/lib src/server`

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `67641c2`, 2026-06-14

## Why this matters

The Electron app starts a localhost proxy automatically. It currently accepts any `X-Target-URL` and enables default CORS, so any page that can reach localhost may be able to use the app as an open fetch primitive. The proxy should only serve trusted app callers and intended target URLs.

## Current state

- `src/server/proxy.ts:9` calls `.use(cors())` with default settings.
- `src/server/proxy.ts:11` reads `X-Target-URL` from the request.
- `src/server/proxy.ts:22-29` fetches that target directly and streams the response.
- `src/main.ts:629` starts the proxy server automatically for the primary instance.

## Commands you will need

| Purpose         | Command                      | Expected on success |
| --------------- | ---------------------------- | ------------------- |
| Typecheck       | `npm run typecheck`          | exit 0              |
| Tests           | `npm run test -- src/server` | targeted tests pass |
| Full unit suite | `npm run test`               | all unit tests pass |

## Scope

**In scope**:

- `src/server/proxy.ts`
- Proxy startup configuration in `src/main.ts` if a token/config must be passed
- New tests for proxy authorization and target validation

**Out of scope**:

- Replacing the read-it-later feature
- Adding a remote proxy service
- Broad networking stack changes

## Git workflow

- Branch: `advisor/003-restrict-local-proxy`
- Commit message: `fix(security): restrict local proxy requests`

## Steps

### Step 1: Identify legitimate proxy callers and target shape

Search for `/proxy` and `X-Target-URL` call sites. Document whether the proxy is only for the app/PWA/read-it-later flow and what URL schemes/hosts must be allowed.

**Verify**: record the found call sites in the implementation notes.

### Step 2: Add caller authentication

Require a per-session token or other app-only authorization mechanism. Pass it to trusted callers and reject missing/invalid tokens with 401/403. Avoid long-lived hardcoded tokens.

**Verify**: targeted tests reject missing/invalid token and accept a valid token.

### Step 3: Validate target URLs

Accept only `http:` and `https:` unless a known legitimate use requires more. Reject localhost, loopback, link-local, private network ranges, and malformed URLs unless explicitly needed and documented. Keep redirects manual or validate redirects before following.

**Verify**: tests cover malformed URL, private/local targets, unsupported protocols, and allowed public targets.

### Step 4: Restrict CORS and response headers

Configure CORS to trusted origins only. Strip or sanitize upstream response headers that should not be mirrored blindly if needed.

**Verify**: `npm run typecheck` and targeted tests pass.

## Test plan

- Unit/integration tests for proxy handler authorization and URL validation.
- Include missing token, wrong token, localhost target, private IP target, malformed URL, and allowed target cases.

## Done criteria

- [ ] The proxy no longer accepts unauthenticated arbitrary browser requests.
- [ ] Private/local targets are rejected unless explicitly approved and documented.
- [ ] Trusted app callers still work.
- [ ] `npm run typecheck` and relevant tests pass.

## STOP conditions

- A legitimate product feature requires proxying arbitrary private/local URLs.
- No trusted caller mechanism can be added without a wider architecture decision.

## Maintenance notes

Read-it-later, web scraping, and PWA networking may rely on this server. Reviewers should scrutinize URL parsing and whether redirects can bypass target validation.
