---
name: week3-evidence-review
description: Evidence-first review of sanitized HTTP traffic from an explicitly authorized training application, with a consistent finding draft. Use when a tester provides the exact lab scope and asks to analyze a request, plan a manual retest, or prepare a Week 3 finding.
allowed-tools:
  - http
  - ask_user
  - file_read
  - file_write
  - confirm_finding
---

# Week 3 Evidence Review

Use AI for triage and drafting only. A human tester owns scope, reproduction, and the final decision that a finding is valid.

## Scope and data handling

- Work only on the exact application and paths the user explicitly says they are authorized to test. If the scope or authorization is unclear, ask once with `ask_user` and do not send requests until clarified.
- Prefer user-provided, sanitized request/response captures. Do not repeat cookies, bearer tokens, passwords, personal data, or other secrets in analysis, findings, or files.
- Never broaden scope, enumerate unrelated hosts, run destructive tests, brute-force credentials, cause denial of service, access real users' data, or test cloud metadata / third-party systems.
- Do not treat scanner output, model reasoning, or a single suspicious response as proof.

## Review workflow

1. Extract the exact method, URL, relevant parameter, observed response, and stated scope. Redact secrets before quoting evidence.
2. State one testable hypothesis and what observation would confirm or disprove it. Separate observed facts from inference.
3. Suggest the smallest non-destructive manual retest that stays inside the named lab. Do not send an HTTP request unless the user has explicitly asked for testing within that scope; if you do use `http`, make one scoped request at a time and stop if the target redirects outside scope.
4. Draft a finding only from evidence actually supplied or observed. Include method, a short redacted response excerpt, concrete impact, and repeatable retest steps. Keep AI-produced JSON at `verification_status: needs_human_review`; only a human may change it to `human_verified` after independently reproducing and reviewing the finding.
5. Call `confirm_finding` only after the human explicitly confirms the retest and evidence. The tool requires a human approval prompt before saving. Do not use `--yolo` for this review.

## Reporting

Return a JSON object matching `schemas/finding-v1.schema.json`. Keep `severity` provisional; final CVSS scoring belongs to the team's risk-assessment phase. If evidence is insufficient, say so and leave the status at `needs_human_review` rather than inventing a result.
