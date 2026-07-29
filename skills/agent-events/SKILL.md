---
name: agent-events
description: Explain, verify, or troubleshoot the @es6kr/agent-events plugin — the unified agent lifecycle event schema and NDJSON writer bridging Claude Code, Antigravity, OpenClaw, and claw-orchestrator hooks. Use when asked about UnifiedEvent, agent-events hooks, session/tool NDJSON logs under ~/.local/state/agent-events/, or why a lifecycle event did or didn't get recorded.
---

# agent-events

Vendor-agnostic agent lifecycle event schema (`UnifiedEvent`) and NDJSON stream writer. This plugin wires the package's Claude Code adapters into real hooks so `session.start` / `tool.before` / `tool.after` / `session.end` events land in `~/.local/state/agent-events/<sessionId>.ndjson` for every session, tool call, and stop.

## What the hooks do

| Claude Code event | Adapter script | UnifiedEvent emitted |
|--------------------|-----------------|----------------------|
| `SessionStart` | `adapters/claude-code/session-start.sh` | `session.start` |
| `PreToolUse` (matcher `*`) | `adapters/claude-code/pre-tool.sh` | `tool.before` |
| `PostToolUse` (matcher `*`) | `adapters/claude-code/post-tool.sh` | `tool.after` |
| `Stop` | `adapters/claude-code/stop.sh` | `session.end` |

All four scripts are observational only: they read the hook's stdin JSON, append one NDJSON line, and always exit 0 — they never block a tool call or a stop. `data.text` fields are redacted (`src/redact.ts`) independent of `share_eligibility` before anything reaches disk.

Antigravity and `claw-orchestrator` adapters (`adapters/antigravity/`, `adapters/claw-orchestrator/`) exist in this repo but are **not yet wired into Antigravity's own `hooks.json` plugin system** — that uses a different schema (`PreInvocation`/`injectSteps`, camelCase fields) and is tracked separately.

## Verifying the hooks fire

```bash
# 1. Confirm the plugin is enabled and loaded (after enabling + session restart)
#    — check for this plugin's slug in the session's available-skills list

# 2. Trigger a real session + tool call, then inspect the NDJSON stream
SESSION_ID=<current-session-id>
cat "$HOME/.local/state/agent-events/${SESSION_ID}.ndjson" | tail -5
```

Expect to see `session.start` near the top, `tool.before`/`tool.after` pairs for each tool call, and `session.end` after a `Stop`.

## Troubleshooting

- **No file appears**: the plugin isn't enabled yet, or a new session hasn't started since enabling — Claude Code plugins load at session start.
- **File exists but events missing for one event type**: check `hooks/hooks.json` registered correctly for that event (`SessionStart`/`PreToolUse`/`PostToolUse`/`Stop`) and that `${CLAUDE_PLUGIN_ROOT}` resolved to this repo's checkout path.
- **`jq: command not found`**: the adapter scripts depend on `jq`; install it or the script silently falls back to `"default-session"` / `"unknown"` values.

## Related

- Package source: `src/schema.ts` (event shape + validation), `src/writer.ts` (NDJSON writer), `src/redact.ts` (text redaction)
- `docs/consumers.md` for downstream consumer guidance
