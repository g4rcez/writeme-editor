---
title: "Mirror the Codex model discovery contract"
type: approach
scope: project
created: 2026-07-24
source: "OpenAI model discovery HTTP 400"
---

# Mirror the Codex model discovery contract

## Trigger

When Writeme's ChatGPT OAuth integration receives an HTTP 400 while fetching the Codex model catalog.

## Approach

1. Compare the request with the current `openai/codex` source instead of guessing from status codes.
2. Send `client_version` as a pinned `major.minor.patch` Codex compatibility version; never send an application name in this parameter.
3. Keep the compatibility user-agent version synchronized with that same constant.
4. Send the OAuth bearer token and `ChatGPT-Account-Id` as headers, never query parameters.
5. Parse only official selectable entries: `visibility === "list"`, `supported_in_api === true`, a normalized valid `slug`, and numeric priority ordering.
6. For non-success responses, expose only the HTTP status. Do not read or surface provider response bodies because they can contain secrets or unsafe content.
7. Test the exact URL and headers, strict model eligibility, normalized slugs, priority ordering, API-key behavior, and that error response bodies are never accessed.

## Why it worked

The endpoint validates `client_version` as semantic version data. `client_version=writeme` violated that contract and produced the 400. Matching the upstream request and catalog schema fixes discovery without adding fallback models or unsafe error-body handling.

## Reuse checklist

- [ ] Verify the current upstream release and source contract
- [ ] Pin and synchronize compatibility versions
- [ ] Keep credentials out of URLs
- [ ] Admit only officially selectable models
- [ ] Assert non-success bodies remain unread
- [ ] Run adapter, settings, typecheck, and production build checks

## Links

- Related: [Provider-scoped async settings state](202607241414-provider-scoped-async-settings-state.md)
