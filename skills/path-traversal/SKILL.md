---
name: path-traversal
description: Evidence-led source and test-case review for authorized applications that select files from user input. Focuses on path confinement and object authorization without reading sensitive files or enumerating paths. Use when a file download/import feature accepts a path-like value or file identifier.
allowed-tools:
  - ask_user
  - file_read
  - GrepTool
  - file_write
  - confirm_finding
---

# Path Traversal Review

Use this playbook for source review and analysis of sanitized evidence from an authorized training or staging application. The human tester owns scope and any runtime reproduction; this skill does not send HTTP requests.

## 1. Confirm scope and safe evidence

- Confirm the exact application, route, method, test account, and allowed file fixture. If scope is unclear, ask once with `ask_user` and wait.
- Prefer a source-code review or a test run in an isolated local lab. Use only harmless, pre-created fixture files; never inspect operating-system files, configuration, credentials, or real user data.
- If the user shares a request/response, ask them to remove cookies, tokens, personal data, and file contents unrelated to the test.

## 2. Review the file-selection path

- Trace how a request value reaches a filesystem operation. Prefer opaque file IDs mapped server-side to an allowlisted record over accepting a client-supplied path.
- Check that authorization is performed for the selected file, not just for the route.
- For a path-based design, canonicalize the final resolved path and prove it remains within the intended storage root. Account for platform separators, decoding, symlinks, and time-of-check/time-of-use races.
- Do not rely on string-prefix checks alone. Prefer a narrow allowlist and filesystem APIs that preserve the root boundary.

## 3. Human-run lab validation

- The lab owner should provide an in-root public sentinel and a separate harmless outside-root sentinel. Verify the expected allow/deny behavior with the application's own documented test case.
- Use one controlled check; do not enumerate filenames, try bypass variants, or request files that are not part of the fixture.
- Stop immediately if any unapproved content is returned. Do not copy or analyze it; report the event and redact the evidence.

## 4. Finding and remediation

- Evidence should include the reviewed source location or one sanitized lab request/response, the fixture used, and the expected versus observed access decision.
- Recommend opaque IDs, per-object authorization, canonical path containment after resolution, symlink-aware checks, and private storage outside the web root.
- Keep AI output at `verification_status: needs_human_review`. Call `confirm_finding` only after a human confirms the reproduction and accepts the approval prompt.
