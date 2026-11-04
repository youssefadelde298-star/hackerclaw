---
name: file-upload
description: Safe review of upload validation, storage, retrieval, and access controls in explicitly authorized training applications. Uses source review and a harmless text canary; does not provide active files or bypass techniques. Use when an application accepts user-supplied files.
allowed-tools:
  - ask_user
  - file_read
  - GrepTool
  - read_payloads
  - file_write
  - confirm_finding
---

# File Upload Review

Use this playbook only for an authorized training or staging application. The agent reviews source and sanitized evidence; a human performs any upload through the lab's normal UI or approved proxy.

## 1. Scope and safe fixture

- Confirm the exact application, upload route, test account, allowed file types, size limit, and whether the file may be retrieved afterward. Ask once with `ask_user` if any item is unclear.
- Read `read_payloads(skill="file-upload", file="benign-text-canary.txt")` for the inert fixture. Do not create or upload executable, active, malformed, oversized, nested-archive, or polyglot files.
- Use one small text-only canary in an isolated lab. Do not overwrite another user's file or use a production account.

## 2. Review validation and storage

- Check that type and size are validated on the server; client-provided filename, extension, and MIME type are untrusted.
- Check for generated storage names, storage outside the public web root, least-privilege filesystem permissions, malware scanning appropriate to the product, and safe cleanup of rejected temporary files.
- Confirm that upload and later retrieval both enforce authentication and per-object authorization. Consider safe download headers and content serving from a separate origin where appropriate.

## 3. Human-run lab validation

- The human operator uploads only the supplied text canary using the lab's normal UI or approved proxy. The agent must not send an upload request.
- Verify the ordinary file's acceptance, storage behavior, and retrieval by the same test account. Do not probe other users' files or try to bypass restrictions with active content.
- Stop if the application exposes private data, stores the file in an unexpected public location, or becomes unstable. Preserve only redacted evidence.

## 4. Finding and remediation

- Record the sanitized request/response, test account, canary hash or exact harmless content, observed storage/retrieval behavior, and the expected policy.
- Recommend server-side allowlists, content inspection or safe re-encoding where appropriate, generated names, private storage, per-object authorization, safe response headers, and size limits.
- Keep AI output at `verification_status: needs_human_review`. Call `confirm_finding` only after the human confirms the retest and accepts the approval prompt.
