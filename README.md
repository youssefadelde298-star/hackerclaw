<div align="center">

<img src="assets/hackerclaw-logo.webp" alt="hackerclaw" width="260" />

# hackerclaw

**An agentic AI assistant for authorized penetration testing, bug bounty, and security research — right in your terminal.**

</div>

---

## Requirements

- **Node.js 20+** — https://nodejs.org
- **Bun** — https://bun.sh (needed to compile standalone binaries; source checks use npm)
- **A model backend**, either:
  - **Ollama** (local, free) — https://ollama.com, or
  - a cloud API key (OpenRouter / OpenAI-compatible / Groq / Gemini / DeepSeek …)

## Install

```bash
git clone https://github.com/youssefadelde298-star/hackerclaw.git
cd hackerclaw
npm install
```

## Build

Compile the standalone binary (bundles the runtime — nothing else needed to run it):

```bash
# Windows
bun build src/cli/index.ts --compile --outfile hackerclaw.exe

# macOS / Linux
bun build src/cli/index.ts --compile --outfile hackerclaw
```

Optionally move the resulting binary somewhere on your `PATH` so you can call `hackerclaw` from anywhere.

For the Node.js package build, install the locked dependencies and run its built-output smoke checks:

```bash
npm ci
npm run build
npm run smoke:build
```

`npm run ci` runs typecheck, lint, tests, build, and both built-entry-point runtime checks.

## Local data

Personal configuration and data live under `~/.hackerclaw/`; project-local skills and memory
live under `./.hackerclaw/`. On first use, existing `.pentesterflow` files are copied only when
the corresponding new file is missing. The old directories are not removed, and
`HACKERCLAW_CONFIG` takes precedence; `PENTESTERFLOW_CONFIG` remains supported as a legacy alias.

## Run

```bash
# Windows
.\hackerclaw.exe

# macOS / Linux
./hackerclaw
```

### Use a local model (Ollama)

```bash
ollama pull qwen3:4b
hackerclaw --model qwen3:4b
```

### Use a cloud model

```bash
hackerclaw --backend openrouter --model anthropic/claude-3.7-sonnet --api-key sk-or-...
```

### Common commands

```bash
hackerclaw                    # launch the interactive TUI
hackerclaw --model <name>     # pick the model
hackerclaw --burp 9999        # start the local Burp bridge
hackerclaw --help             # list all flags
```

## Findings and reports

`confirm_finding` saves a Markdown report and a JSON sidecar in `./findings/`. Findings start
as `needs_human_review`; a reviewer should only change the status to `human_verified` after
reproducing the issue and checking the evidence.

To merge team submissions, point `/report` at one or more folders containing finding JSON
sidecars. The command writes an initial Markdown report and a CSV risk register under
`./reports/`:

```text
/report                         # reads ./findings/
/report member-one/findings,member-two/findings
```

The `confirm_finding` tool accepts an optional assessor-selected `cvss_vector` and calculates
its CVSS 3.1 Base score locally. Exported JSON sidecars store the vector and calculated score
under `cvss`, as defined in `schemas/finding-v1.schema.json`. It does not guess missing vectors
or business impact. Temporal and Environmental metrics are not included. The report keeps
unverified items separate from confirmed findings, and only `human_verified` records appear in
its executive summary.

## Project deliverables

The proposal's five-week deliverables, current status, and blank team templates are indexed in
the [Arabic project handoff](docs/README-ar.md). The guides distinguish tested code from work that
still requires the team's authorized lab, hardware, and evidence; blank templates are not results.

---



## Burp Suite integration

hackerclaw connects to Burp two independent ways — run both at once by giving each instance its own bridge port.

**Bridge (Burp -> hackerclaw)** — send selected Burp requests into the agent:

```bash
hackerclaw --burp 9999      # bridge listener; prints a URL + token
hackerclaw --burp 9998      # a second, independent instance (different port = no collision)
```

Load the companion [Burp extension](https://github.com/PentesterFlow/Burp-Integration) and point it at the printed URL + token.

**Proxy chaining (hackerclaw -> Burp)** — route hackerclaw's own HTTP traffic through Burp so it shows up in Burp's HTTP history. Set standard proxy env vars to Burp's proxy listener (use whatever free port Burp is bound to):

```bash
# Windows (PowerShell)
$env:HTTPS_PROXY="http://127.0.0.1:8081"; $env:HTTP_PROXY="http://127.0.0.1:8081"; $env:NO_PROXY="localhost,127.0.0.1"; hackerclaw

# macOS / Linux
HTTPS_PROXY=http://127.0.0.1:8081 HTTP_PROXY=http://127.0.0.1:8081 NO_PROXY=localhost,127.0.0.1 hackerclaw
```

Each proxy needs its own free port; `NO_PROXY` keeps a local model (e.g. Ollama) off the proxy.
