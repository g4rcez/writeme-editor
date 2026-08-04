---
title: "Provider-scoped async settings state"
type: approach
scope: reusable
created: 2026-07-24
source: "OpenAI model picker refactor"
---

# Provider-scoped async settings state

## Trigger

When one settings screen reuses credential, loading, error, and option state across switchable providers while network or OAuth work can resolve later.

## Approach

1. Give each independent async flow a monotonic request ID: credential checks, option loading, and authentication.
2. Capture the provider that initiated the request. After every `await`, update shared UI state only when the request ID is still current.
3. Invalidate relevant request IDs on provider changes and unmount; reset transient loading and focus intent at the same boundary.
4. Treat remote options as validated data. Keep a select disabled while disconnected, loading, empty, or failed, and prevent saving a hidden/default value that is not in the returned option list.
5. Preserve keyboard focus across retry: keep the retry control mounted during loading and focus the enabled select after a successful retry.
6. Do not fabricate fallback options for failed discovery requests. Surface HTTP failures distinctly from successful empty responses.
7. Test deferred responses out of order, provider switching during OAuth start/completion, failed and empty discovery, retry focus, save guards, and unaffected provider flows.

## Why it worked

A provider ID in a closure does not stop an older promise from mutating shared React state. Request generations make ownership explicit and turn provider switching/unmount into cancellation boundaries without requiring transport-level cancellation. Validating the saved value against fetched options keeps the persisted configuration consistent with what the UI actually shows.

## Reuse checklist

- [ ] Identify every async flow that writes shared provider state
- [ ] Add request-generation guards after every `await`
- [ ] Invalidate requests on provider change and unmount
- [ ] Distinguish error, empty, loading, and disconnected states
- [ ] Prevent saving values absent from remote options
- [ ] Test out-of-order completions and keyboard focus

## Links

- Related: [Safe local database migrations](202607110503-safe-local-database-migrations.md)
