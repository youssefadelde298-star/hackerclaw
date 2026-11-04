---
name: session-fixation
description: Safe, evidence-led session fixation triage for explicitly authorized training applications. Covers session identifier rotation and lifecycle review using only tester-owned accounts and non-secret metadata. Use when a tester provides an exact lab scope and asks to assess suspected session fixation risk.
allowed-tools:
  - ask_user
  - http
  - file_write
  - confirm_finding
---

# Session Fixation Playbook

Use only for the exact training application, routes, and tester-owned accounts the user is authorized to assess. A human tester owns scope, reproduction, and the final finding decision. This playbook checks whether authentication correctly replaces pre-authentication session state. It does not set, carry, replay, or compare actual session identifiers, and it does not involve another user.

## 1. Scope and safety

- Before any request, confirm the authorized host, login flow, tester-owned lab account, browser profile, and request limits. If any part is unclear, ask once with `ask_user` and wait.
- Work in a dedicated lab browser profile or private window. Do not assess production, shared, privileged, financial, administrative, or third-party accounts.
- Session cookies, tokens, links, and authorization headers are secrets. Record only redacted metadata such as the cookie name, flags, scope, issuance event, and whether the server indicated replacement. Never capture or store the secret value.
- Do not set or inject cookies; preselect an identifier; use a URL parameter; modify headers; hand an identifier to another browser/user; replay a value; or perform cross-user/attacker-controlled validation. These actions are outside this safe playbook.
- Stop if a test would affect another account, change a sensitive setting, expose secret values, or move outside the documented lab route.

## 2. Understand the risk

Session fixation occurs when an application authenticates a user while retaining a session identifier that existed before authentication or was otherwise externally chosen. If an attacker could know that retained identifier, they might be able to associate it with the newly authenticated state. The core defense is server-side session regeneration at successful authentication, alongside strong session creation, secure transport, and invalidation practices.

Important distinctions:

- A pre-authentication session may be legitimate for features such as a shopping cart, language choice, CSRF state, or rate limiting. Its mere existence is not a vulnerability.
- The security question is whether privileged/authenticated state is bound to a newly issued server-controlled session after login, rather than inheriting a pre-login authentication context.
- Rotation should be coordinated with logout, password changes, recovery completion, privilege changes, and other risk-relevant transitions. The precise policy depends on product design, but it should be intentional and documented.
- Cookie attributes (`Secure`, `HttpOnly`, appropriate `SameSite`, narrow Domain/Path scope) and no-cache controls reduce related exposure but do not replace identifier regeneration.

## 3. Safe manual workflow

1. In a clean tester-controlled browser session, visit the assigned pre-login page. Record redacted session metadata only: cookie name, applicable flags, domain/path, lifetime category, and issuance time.
2. Complete the normal documented login flow using the tester-owned training account. Record whether the server response indicates that the pre-login session was expired, cleared, replaced, or regenerated. Compare metadata only; do not record or compare identifier values.
3. Confirm the normal authenticated state through the approved account landing page. Do not use sensitive features or make changes solely for testing.
4. Perform normal logout. Record the response's redacted session metadata and confirm the browser returns to a logged-out state through normal navigation.
5. If explicitly in scope, repeat the normal flow after a lab-provided low-risk account transition that has no material impact. Verify the documented lifecycle policy through metadata. Do not trigger password reset, email changes, role changes, MFA changes, or recovery actions.
6. Stop when the lab evidence is sufficient. If metadata indicates no regeneration after authentication, preserve the redacted evidence and report a suspected lifecycle defect; do not attempt to prove exploitability by reusing the identifier.

## 4. Evidence and remediation

- Save sanitized observations for the pre-login, login, authenticated, and logout stages: request/response timestamps, cookie name and attributes, server-issued expiry/replacement indicators, and observed UI state. Exclude all secret values.
- Describe the finding narrowly: for example, “The training application's login response did not show replacement of the pre-authentication session cookie; human review of server-side session handling is required.” Avoid claiming account takeover from metadata alone.
- Recommend invalidating or regenerating the server-side session identifier immediately after successful authentication and at meaningful privilege or credential transitions; discard the anonymous session or migrate only non-sensitive data to the new session under server control.
- Use cryptographically strong opaque identifiers, avoid accepting identifiers through URLs or untrusted client-controlled channels, enforce HTTPS, configure `Secure`/`HttpOnly`/appropriate `SameSite`, limit cookie scope, expire sessions appropriately, and invalidate sessions server-side at logout.
- Add regression tests that assert a new authenticated session is issued after login without logging its value. Review session-store behavior in multi-node deployments so invalidation and rotation are consistent.
- Draft a finding only from observed evidence. Keep AI output at `verification_status: needs_human_review`; a human must independently review the evidence and server-side design before changing status.
- Call `confirm_finding` only after the tester explicitly confirms the manual review. The tool's human approval prompt must be accepted before saving.

## 5. Out-of-scope material

This skill intentionally excludes instructions for assigning a session to a victim, setting cookies from another site, URL-based fixation, header/cookie manipulation, token replay, bypassing controls, credential/session theft, MFA bypass, phishing, or account takeover. Any exercise that goes beyond the safe lifecycle review requires a separately designed isolated lab and explicit human authorization.
