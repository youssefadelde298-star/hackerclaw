---
name: xss
description: Safe, evidence-led manual cross-site scripting triage for explicitly authorized training applications. Covers reflected, stored, and DOM XSS identification and non-destructive confirmation in a tester-owned browser only. Use when a tester provides an exact lab scope and asks to assess a suspected XSS issue.
allowed-tools:
  - ask_user
  - http
  - read_payloads
  - file_write
  - confirm_finding
---

# Cross-Site Scripting (XSS) Playbook

Use only for the exact application, routes, and test accounts that the user is authorized to assess. A human tester owns scope, reproduction, and the final finding decision. This playbook proves only that untrusted input can reach an executable browser context in the tester's own approved lab session; it does not attempt to affect, impersonate, or collect from another person.

## 1. Scope and safety

- Before sending a request, confirm the authorized host, path, method, parameter or field, test account, intended browser, and any rate/request limits. If any part is unclear, ask once with `ask_user` and wait.
- Prefer a user-provided, sanitized baseline request. Redact cookies, bearer tokens, passwords, personal data, and production records before analysis or saving.
- Use one approved, non-authentication input and one tester-owned session. For stored-input checks, use only a lab-owned record that can be removed through the application's normal UI after the test.
- Change one value per request. Use the unique inert marker in `lab-cases.txt` first; do not spray inputs, fuzz endpoints, automate browsers, or send batch requests.
- A proof must be non-destructive: it may show a harmless lab-provided visual signal in the tester's own browser, but must not read cookies, storage, tokens, passwords, page content, browser history, or network responses; make cross-origin requests; submit forms; open external windows; or persist beyond the assigned lab record.
- Stop if a request reaches an unapproved domain, exposes sensitive data, invokes an account-affecting action, creates unexpected persistence, triggers rate limiting, or affects a user other than the tester.

## 2. Understand the vulnerability class

XSS occurs when untrusted data is interpreted as active browser content rather than displayed as data. The practical question is not simply whether a value is reflected: it is whether the application's output handling and the browser's parser make that value executable in its actual context.

- **Reflected XSS:** request-controlled input is returned in the same response. Common review locations include search terms, error pages, redirects, pagination, canonical URLs, breadcrumbs, selected filters, and reflected request metadata.
- **Stored XSS:** input is saved and later displayed. Review comments, profiles, display names, messages, rich-text fields, support tickets, imported content, and integration feeds. In the lab, view it only through the tester's own account and a lab-owned record.
- **DOM XSS:** client-side code moves controllable data from a source to a dangerous sink. Typical sources include URL query and fragment values, `location`, `URLSearchParams`, messaging data, and browser storage. Typical sinks include HTML insertion APIs, document-writing APIs, dynamic script/URL assignment, and code-evaluation APIs. A server response may look harmless because the dangerous transformation happens in the browser.

Context controls risk and remediation. Classify the reflection before seeking a proof: HTML text, HTML attribute (quoted or unquoted), URL-bearing attribute, JavaScript data/string/template context, CSS, comment, or a DOM sink. Encoding must match the final context, not merely the input field.

## 3. Safe manual test workflow

Before any request, read `read_payloads(skill="xss", file="lab-cases.txt")`. It contains only fixture markers and safety rules; it intentionally ships no executable or filter-bypass strings.

1. Capture one normal baseline request and response. Record the exact endpoint, input name, status, a short redacted response excerpt, and approximate response time.
2. Choose one in-scope entry point. Submit the unique inert marker from `lab-cases.txt`, changing no other field. Search the raw response, rendered page, and—when relevant—the browser DOM for that exact marker.
3. Classify each occurrence. Note whether it appears in server response text, a rendered element, an attribute, a script data value, or only after client-side processing. Record how the application encodes or transforms it.
4. For a suspected DOM path, review the relevant first-party client code and use browser developer tools to trace the approved marker from source to sink. Pause before the sink where possible and record the value immediately before it is consumed. Do not invoke a dangerous sink with active content.
5. Use an executable confirmation only if the training lab explicitly documents a harmless, local-only proof fixture. Run it once in the tester-owned browser, with no external destination and no data access. Capture a screenshot or short redacted recording of the lab's visual confirmation.
6. For stored input, confirm persistence and display using a second tester-owned lab session only when the scope explicitly allows it. Remove the lab record through normal UI afterwards and record the cleanup.
7. Stop once the smallest safe retest produces repeatable evidence. If the marker is encoded, sanitized, or cannot be shown to reach an executable context, report it as unconfirmed rather than escalating.

## 4. Evidence, impact, and remediation

- Save sanitized baseline and test request/response separately. Record the one input changed, marker value, reflection/sink context, encoding observed, browser version, and cleanup result. Never save session artifacts or sensitive page data.
- Describe impact proportionately. A confirmed local-only proof establishes client-side code execution in the tester's lab context; it does not by itself establish session compromise, account takeover, data disclosure, or impact on other users.
- Recommend context-aware output encoding at the rendering boundary; safe DOM APIs such as `textContent` rather than HTML parsing APIs; framework auto-escaping; strict URL-scheme allowlists; and a vetted sanitizer when user-authored HTML is genuinely required.
- Treat input validation as a supporting control, not the primary XSS defense. Prefer allowlists for constrained fields and avoid ad hoc string replacement or blacklist-based filtering.
- Recommend defense in depth: a restrictive Content Security Policy, `HttpOnly`, `Secure`, and appropriate `SameSite` cookie attributes, plus review of third-party scripts. These controls can reduce impact but do not replace fixing the injection point.
- Draft a finding only from observed evidence. Keep AI output at `verification_status: needs_human_review`; a human must independently repeat the safe test and review evidence before changing status.
- Call `confirm_finding` only after the tester explicitly confirms the manual retest and evidence. The tool's human approval prompt must be accepted before saving.

## 5. Source-note boundaries

The supplied notes correctly highlight that XSS can have severe consequences and discuss SOP, CORS, CSP, cookie flags, CSRF, contexts, sources/sinks, and common input locations. The following source-note material is intentionally out of scope for this skill: credential or session theft, collecting auto-filled passwords, token/API-key extraction, account takeover, forcing sensitive actions, external delivery or hosting, cross-origin response access, bypassing WAF/filter/escaping protections, and testing against third-party users. Do not convert these topics into payloads, workflows, or validation steps; escalate to the authorized lab owner if a curriculum requires a separately designed, isolated exercise.
