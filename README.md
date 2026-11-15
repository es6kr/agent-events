# @es6kr/agent-events

Unified vendor-agnostic Agent Lifecycle Event Schema and NDJSON stream writer for Claude Code, Antigravity (Gemini Agent), OpenClaw (`acpx`), and `claw-orchestrator`.

## Installation

```bash
npm install @es6kr/agent-events
```

## Quick Start

### 1. Emit Lifecycle Events

```typescript
import { UnifiedEventWriter, UnifiedEvent } from "@es6kr/agent-events";

const writer = new UnifiedEventWriter();

const event: UnifiedEvent = {
  v: 1,
  ts: new Date().toISOString(),
  tool: "claw-orchestrator",
  sessionId: "session-abc-123",
  event: "tool.before",
  share_eligibility: "public",
  data: {
    toolName: "run_command",
    command: "git status"
  }
};

// Emits event line atomically to ~/.local/state/agent-events/session-abc-123.ndjson
writer.emit(event);
```

### 2. Read Session Telemetry Stream

```typescript
import { UnifiedEventWriter } from "@es6kr/agent-events";

const writer = new UnifiedEventWriter();
const events = writer.readEvents("session-abc-123");

console.log(`Read ${events.length} events in chronological order`);
```

## Build & Test Commands

```bash
npm run build    # Compile TypeScript to ./dist
npm test         # Run Jest unit test suite
```

## Supported Agent Runtimes (`tool`)

- `claude-code`: Native hook events (`SessionStart`, `PreToolUse`, `PostToolUse`, `Stop`)
- `antigravity`: Gemini pair-programming subagents and background tasks
- `openclaw`: OpenClaw headless CLI sessions (`acpx`)
- `claw-orchestrator`: Enderfga/openclaw-claude-code orchestrator stdio ACP streams
- `hermes`: Offline knowledge evidence emitted through an explicit trusted-host binding

## Offline Hermes knowledge evidence (opt-in)

`knowledgeTraceToEvent(payload)` is a pure projection, not a host authentication
or permission API. Its closed `binding` and `trace` input accepts only the pinned
knowledge source revision, `loaded_revision: "unknown"`, safe result codes and
at most 16 opaque typed references. It produces a private `tool.after` event
without raw text, prompts, graph records, paths, or URLs in event data.

A trusted local launcher may invoke the separate one-shot entrypoint:

```text
node dist/adapters/knowledge/cli.js --allowed-root <absolute-existing-root>
```

Supply exactly one UTF-8 JSON object on stdin (at most 65,536 bytes):
`binding` has `runtime`, `session_id`, `output_dir`, `emitted_at`; `trace` has
`schema_version`, `package_id`, `source_revision`, `loaded_revision`, `operation`,
`status`, `code`, `references`. The host owns the binding and independent argv
root. A shape-valid input does not prove host identity or grant authority.
`session_id` preserves its original ASCII letters, digits, `_` and `-` (1–128
characters); `emitted_at` is the host emission instant in millisecond UTC ISO
format, not the time of graph observation.

`output_dir` must be the root's child named by the lowercase SHA-256 of the exact
UTF-8 session ID. Thus case-only session differences remain separate on Windows.
Paths escaping that root, dot traversal aliases, links/junctions and hard-linked
output files are refused before the existing writer is constructed. The root
and build/dependency supply remain trusted host responsibilities; this is not
an adversarial filesystem-race or sandbox guarantee.

The CLI uses the existing validator and writer exactly once and acknowledges
only the observed appended canonical UTF-8 line with a SHA-256 receipt. This is
not an fsync or exactly-once claim. Nonzero exit, timeout, malformed/missing
receipt or uncertain append must be treated as incomplete evidence, never
retried automatically. Importing the package does not read stdin or create a
writer. This entrypoint does not install a Hermes hook, activate a plugin,
contact a database, or certify a loaded SDK revision.

## Architecture & Governance

- **Core Event Standard**: `@es6kr/agent-events` serves as the canonical vendor-agnostic event schema and telemetry layer. All documentation, commits, and API contracts within this repository are written in **English**.
- **Extensibility**: Custom enterprise adapters, private authentication wrappers, or internal pipeline bindings can extend or consume this package as a standard npm dependency in external repositories.

