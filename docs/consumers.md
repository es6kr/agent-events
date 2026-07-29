# Consumer Integration Guide for @es6kr/agent-events

This guide explains how external consumer applications (monitoring dashboards, notification services, multi-process supervisors like `claude-multi-process` and `claw-orchestrator`) consume the unified NDJSON event streams.

---

## Stream File Location & Pattern

All event adapters write to session NDJSON log files under:

```text
~/.local/state/agent-events/<sessionId>.ndjson
```

- Each line is a self-contained JSON object validating against `UnifiedEventSchema` (v=1).
- Files are append-only. Multiple consumers can tail or poll session files concurrently.

---

## Integration Patterns

### 1. Polling / File Tailing (Node.js)

```typescript
import { UnifiedEventWriter } from "@es6kr/agent-events";

const writer = new UnifiedEventWriter();
const events = writer.readEvents("target-session-id");

for (const event of events) {
  console.log(`[${event.ts}] ${event.tool} -> ${event.event}`, event.data);
}
```

### 2. Live Dashboard Tailing (`jq` / Shell)

```bash
# Watch live telemetry stream for a session
tail -f ~/.local/state/agent-events/session-123.ndjson | jq '.'

# Filter only tool.before and tool.after events across all sessions
tail -f ~/.local/state/agent-events/*.ndjson | jq 'select(.event == "tool.before" or .event == "tool.after")'
```

### 3. Notification Triggering (Mac / Desktop Notifications)

```typescript
import { UnifiedEventWriter } from "@es6kr/agent-events";

const writer = new UnifiedEventWriter();
const events = writer.readEvents(sessionId);
const lastEvent = events[events.length - 1];

if (lastEvent && lastEvent.event === "session.end") {
  // Trigger desktop notification upon session completion
  console.log(`Session ${sessionId} ended with reason: ${lastEvent.data.reason}`);
}
```

---

## Consumer Best Practices

1. **Idempotency & Timestamp Sorting**: Always sort event streams by `ts` timestamp when consuming asynchronously (`readEvents()` handles this automatically).
2. **Schema Verification**: Validate raw line payloads using `validateUnifiedEvent(parsed)` to discard corrupted lines safely.
3. **Privacy Compliance**: Honor `share_eligibility: "private"` flags when forwarding events to external RAG indices or remote logging endpoints.
