---
name: sqli
description: Safe, evidence-led manual SQL injection triage for explicitly authorized training applications. Covers in-band, blind, Boolean-based, time-based, and UNION-based signals without retrieving real data. Use when a tester provides an exact lab scope and asks to assess a suspected SQL injection.
allowed-tools:
  - ask_user
  - http
  - read_payloads
  - file_write
  - confirm_finding
---

# SQL Injection (SQLi) Playbook

Use only for the exact application and paths the user is authorized to test. A human tester owns scope, reproduction, and the final finding decision. Prefer one low-impact request at a time; do not use `--yolo`.

## 1. Scope and safety

- Before sending a request, confirm the authorized host, path, method, parameter, test account, and any request limits. If any part is unclear, ask once with `ask_user` and wait.
- Prefer a user-provided, sanitized baseline request. Redact cookies, bearer tokens, passwords, personal data, and production records before analysis or saving.
- Do not broaden scope, enumerate tables or columns, retrieve credentials or user records, alter or delete data, bypass authentication, use automated scanners, or generate load.
- Stop if the request redirects outside scope, returns sensitive data, triggers rate limiting, or causes instability or unexpected latency.

## 2. Recognize the test categories

- **In-band:** the application exposes a database-related error or query result in the same HTTP response. Error-based behavior is a signal, not permission to inspect stack traces or extract data.
- **Blind:** the response does not reveal database output directly; the tester infers behavior from a controlled response difference.
- **Boolean-based:** a blind test compares one logically true condition with one false condition while keeping the rest of the request identical. Compare a stable application signal, not status code alone.
- **Time-based:** a blind test looks for a controlled response delay. It is intrusive and can affect availability; use only in a staging/training lab with explicit approval and a short delay.
- **UNION-based:** an in-band technique that combines query results. In a lab, use only its documented dummy data or a harmless constant marker; never enumerate schemas or retrieve real rows.

## 3. Manual test workflow

Before any request, read `read_payloads(skill="sqli", file="lab-cases.txt")`. It contains scope and fixture rules, not generic injection strings. Use only test inputs documented by the assigned training application.

1. Capture one normal baseline request and response. Record the exact parameter, status, a short redacted response excerpt, and approximate response time.
2. Select one suspected input parameter. Change only that parameter per request. Start with a single quote/delimiter check on a string input and observe whether behavior changes; do not repeatedly provoke errors.
3. If the lab explicitly permits Boolean testing, compare one true/false pair with the same session and request shape. Repeat only if needed to rule out caching or ordinary response variation.
4. Use a time-based check only when explicitly allowed in the lab. Compare one control with one test using a short delay of at most two seconds. Do not loop, parallelize, or increase the delay. Stop immediately if the service slows or becomes unstable.
5. For UNION-based validation, use the lab's known test fixture and a harmless constant marker only. Do not discover column layouts by spraying requests, inspect system catalogs, or read application data.
6. Stop once the smallest safe retest produces repeatable evidence. If the evidence is ambiguous, report it as unconfirmed rather than escalating.

## 4. Evidence and remediation

- Save the sanitized baseline and test request/response separately. Record which single input changed and the observed difference; remove secrets and real user data.
- A likely root cause is SQL assembled from untrusted input. Recommend parameterized queries/prepared statements, safe query-builder APIs, and least-privilege database accounts. Escaping alone is not the primary fix.
- Draft a finding only from evidence actually observed. Keep AI output at `verification_status: needs_human_review`; a human must independently repeat the test and review evidence before changing status.
- Call `confirm_finding` only after the tester explicitly confirms the manual retest and evidence. The tool's human approval prompt must be accepted before saving.
