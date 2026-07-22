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

// Emits event line atomically to ~/.claude/state/agent-events/session-abc-123.ndjson
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
- `opencode`: OpenCode plugin SDK events
