---
name: session-hijacking
description: Safe, evidence-led session-management triage for explicitly authorized training applications. Covers identification of session exposure and weak session controls without collecting, replaying, or using another user's credentials or session artifacts. Use when a tester provides an exact lab scope and asks to assess suspected session-hijacking risk.
allowed-tools:
  - ask_user
  - http
  - file_write
  - confirm_finding
---

# Session Hijacking Risk Playbook

Use only for the exact training application, routes, and tester-owned accounts the user is authorized to assess. A human tester owns scope, reproduction, and the final finding decision. This playbook evaluates whether session handling could expose or mishandle authentication state; it never obtains, copies, replays, guesses, or uses a session identifier belonging to another person.

## 1. Scope and safety

- Before any request, confirm the authorized host, relevant login/session routes, tester-owned account, browser, and rate limits. If any part is unclear, ask once with `ask_user` and wait.
- Use a dedicated lab account and a clean browser profile or private window. Do not test shared, production, privileged, financial, administrative, or third-party accounts.
- Treat cookies, bearer tokens, refresh tokens, one-time links, device identifiers, and authorization headers as secrets. Do not copy them into notes, tickets, prompts, files, URLs, screenshots, or tools. Redact values while retaining names, attributes, lengths, and timestamps where useful.
- Do not attempt cookie theft, credential capture, token extraction, token replay, session prediction, session swapping, browser manipulation, malware simulation, network interception, phishing, or any cross-user validation.
- Do not use a test result to access another account or data. Stop immediately if a browser exposes sensitive information, if an artifact escapes the tester-controlled environment, or if a result could affect an unapproved session.

## 2. What to assess

Session hijacking is unauthorized use of an authenticated session artifact. The assessment goal is not to demonstrate takeover; it is to find preventable conditions that could expose session state or allow it to persist inappropriately.

Review the lifecycle:

- **Creation:** after successful authentication, identify which session mechanism is issued and whether sensitive identifiers are delivered only through appropriate protected channels.
- **Transport:** inspect cookie metadata and application configuration. Authentication cookies should normally use `Secure`; JavaScript access should normally be restricted with `HttpOnly`; and `SameSite` should be selected deliberately for the application flow. Avoid placing session identifiers in URLs, fragments, page markup, client-visible logs, referrers, or analytics values.
- **Storage and exposure:** check whether first-party pages, responses, error messages, redirects, or client code visibly expose secret material. Review only redacted metadata and source/configuration already within scope.
- **Rotation:** observe the tester's own normal flow to determine whether authentication regenerates the session identifier and whether high-risk events—such as password changes or privilege changes—have an intentional rotation policy.
- **Termination:** verify normal logout invalidates the tester's active session and that the application documents idle and absolute timeout behavior. Do not probe another browser or attempt to reuse an old artifact.
- **Binding and monitoring:** assess whether the design has proportionate device/risk signals, anomaly detection, and user-facing session-management controls without making brittle assumptions about IP address alone.

## 3. Safe manual workflow

1. Capture a sanitized pre-login and post-login baseline for the tester-owned lab account. Record only artifact names, cookie flags, domain/path scope, expiration category, and response headers; redact all values.
2. Walk through the normal login flow in the designated browser. Observe whether a new session is issued at authentication. Compare redacted metadata, not values.
3. Inspect relevant responses for accidental disclosure: URLs, redirect locations, HTML, client-side configuration, cache directives, error views, and logs made available by the lab. Record only a redacted excerpt and location of any suspected exposure.
4. Perform the lab's normal logout from the same browser. Confirm the interface returns to an unauthenticated state and record the observed invalidation/expiration metadata. Do not attempt to return to authenticated pages by reusing an artifact.
5. If explicitly included in scope, repeat the normal login and a documented high-risk account event using the tester account, then record whether the session lifecycle behavior changes as designed. Do not alter security settings merely for testing.
6. Stop once the smallest safe evidence is repeatable. A missing flag or suspicious design clue should be reported as a configuration concern or needs-review unless the lab supplies a harmless, owner-approved validation fixture.

## 4. Evidence and remediation

- Save only sanitized request/response metadata, configuration observations, timestamps, browser version, scope, and expected/observed lifecycle behavior. Never retain active session values.
- State evidence narrowly. For example: “The authentication cookie lacked the expected `Secure` attribute in the HTTPS training environment.” Do not claim account compromise unless a human has separately authorized and independently verified that conclusion.
- Recommend HTTPS everywhere; `Secure`, `HttpOnly`, and appropriate `SameSite` cookie settings; server-side session storage and invalidation; opaque, high-entropy identifiers generated by a cryptographically secure source; rotation at authentication and high-risk transitions; short idle/absolute lifetimes appropriate to risk; `Cache-Control: no-store` for sensitive responses; and user-visible session revocation.
- Do not rely on client-side checks, predictable identifiers, URLs, or browser storage as the sole protection for authenticated state. Keep secrets out of telemetry and redact them before support or debugging workflows.
- Draft a finding only from observed evidence. Keep AI output at `verification_status: needs_human_review`; a human must independently review the redacted evidence and decide the finding status.
- Call `confirm_finding` only after the tester explicitly confirms the manual review. The tool's human approval prompt must be accepted before saving.

## 5. Out-of-scope material

This skill does not provide workflows for stealing cookies/tokens, collecting passwords, intercepting traffic, session replay, fixation, brute-force or prediction, bypassing MFA, phishing, malware, account takeover, or access to another user's data. If a curriculum needs any controlled demonstration beyond metadata-level validation, the lab owner must provide an isolated fixture and a separate, explicit authorization.
