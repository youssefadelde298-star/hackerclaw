# Implementation Deviation: Python Proposal vs TypeScript Runtime

**Status: Pending supervisor decision. This record is a request for sign-off, not an approval.**

**Recorded:** 2026-11-18

## Deviation

The project proposal calls for a Python integration layer. The core HackerClaw CLI, agent,
MCP client/server, and runtime integrations are implemented in TypeScript/Node.js. The repository
also contains a separate Python Burp plugin, but it is not a Python adapter for the core runtime.

## Current position

The existing TypeScript implementation is being maintained while approval is pending. Its
existing tests and release tooling do not constitute supervisor approval of the deviation.

## Decision requested

Select one outcome:

- Approve the TypeScript/Node.js core as the project implementation, with any conditions recorded below.
- Require a Python adapter around the existing core and define its supported interface.
- Require migration of the core integration layer to Python and revise scope, estimates, and acceptance criteria.

## Supervisor decision

- Supervisor:
- Decision:
- Conditions or rationale:
- Date:
- Reference to written approval:
