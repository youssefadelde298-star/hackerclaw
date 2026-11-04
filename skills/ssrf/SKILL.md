---
name: ssrf
description: Controlled SSRF triage for explicitly authorized training or staging applications. Covers source/config review and a single owner-controlled canary check; excludes internal destinations, metadata, bypasses, scanning, and data retrieval. Use when an in-scope feature fetches a URL.
allowed-tools:
  - ask_user
  - http
  - read_payloads
  - file_write
  - confirm_finding
---

# SSRF: controlled validation

Use this playbook only for an explicitly authorized training or staging application. The agent may help review supplied source/configuration and, only after explicit scope confirmation, send one low-impact request to the in-scope application. A human tester owns scope, evidence review, and the final finding decision.

## 1. Scope gate

- Before any request, confirm the exact authorized host, path, method, parameter, test account, request limit, and permitted canary destination with `ask_user`. If any part is unclear, ask once and wait.
- Read `read_payloads(skill="ssrf", file="lab-canary-requirements.txt")`. It is a checklist only; it contains no destination or bypass strings.
- If the user has not supplied a canary they control, stop at source/configuration review. Do not invent a callback destination.
- Use the `http` tool only for the scoped application request and only after the user explicitly asks for that check. Do not make requests to a canary, internal service, or other origin.

## 2. Review the fetch boundary

- Trace whether user-controlled input reaches a server-side HTTP client. Prefer reviewing the code and configuration before any runtime test.
- Check for a strict scheme and hostname allowlist, canonical host parsing, DNS/IP checks at connection time, redirect revalidation, egress restrictions, short timeouts, response-size limits, and removal of sensitive headers.
- Confirm that fetched response bodies are not returned to users unless the feature requires it and access control is enforced.
- Do not test access to internal, loopback, private, link-local, multicast, or cloud metadata destinations. Do not test alternate schemes, redirect chains, DNS rebinding, port discovery, or credential retrieval.

## 3. One controlled check

- Use one operator-provided, team-controlled canary only when it is explicitly included in the approved test plan. Change no other request field.
- Capture a sanitized baseline and the single approved test response. A response difference alone is not proof; the human operator must verify the canary event in the canary service's own logs.
- Stop if the request redirects outside scope, the application becomes unstable, or any sensitive or unexpected data appears. Do not copy or inspect that data.
- If the lab does not provide a safe fixture or evidence source, mark the behavior unconfirmed and stop.

## 4. Evidence and remediation

- Record the exact in-scope feature, sanitized baseline/test requests, the human-verified canary log reference, and the limits observed. Do not include credentials or internal response data.
- Recommend strict destination allowlists, connection-time IP validation, redirect revalidation or disabling redirects, network egress controls, bounded time/response size, and safe handling of fetched content.
- Draft findings only from evidence actually observed. Keep AI output at `verification_status: needs_human_review`; call `confirm_finding` only after the tester confirms the retest and approves the human confirmation prompt.
