import {
  UnifiedEventSchema,
  validateUnifiedEvent,
  isValidUnifiedEvent,
  UnifiedEvent
} from "../src/schema";
import { UnifiedEventWriter } from "../src/writer";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

describe("@es6kr/agent-events Schema & Writer", () => {
  const tmpDir = path.join(os.tmpdir(), `agent-events-test-${Date.now()}`);

  afterAll(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test("validates a complete valid UnifiedEvent", () => {
    const valid: UnifiedEvent = {
      v: 1,
      ts: new Date().toISOString(),
      tool: "claw-orchestrator",
      sessionId: "session-123",
      conversationId: "conv-456",
      event: "tool.before",
      share_eligibility: "public",
      data: { name: "Read", args: { path: "test.ts" } }
    };

    expect(isValidUnifiedEvent(valid)).toBe(true);
    expect(validateUnifiedEvent(valid)).toEqual(valid);
  });

  test("rejects invalid tool runtime", () => {
    const invalid = {
      v: 1,
      ts: new Date().toISOString(),
      tool: "unknown-agent",
      sessionId: "session-123",
      event: "session.start",
      data: {}
    };

    expect(isValidUnifiedEvent(invalid)).toBe(false);
  });

  test("writes and reads NDJSON event stream atomically", () => {
    const writer = new UnifiedEventWriter({ logDir: tmpDir });
    const sessionId = "test-session-abc";

    const event1: UnifiedEvent = {
      v: 1,
      ts: "2026-07-22T12:00:00.000Z",
      tool: "antigravity",
      sessionId,
      event: "session.start",
      share_eligibility: "public",
      data: { user: "david" }
    };

    const event2: UnifiedEvent = {
      v: 1,
      ts: "2026-07-22T12:01:00.000Z",
      tool: "claw-orchestrator",
      sessionId,
      event: "tool.after",
      share_eligibility: "public",
      data: { toolName: "run_command", exitCode: 0 }
    };

    const targetFile1 = writer.emit(event1);
    const targetFile2 = writer.emit(event2);

    expect(targetFile1).toEqual(targetFile2);
    expect(fs.existsSync(targetFile1)).toBe(true);

    const events = writer.readEvents(sessionId);
    expect(events.length).toBe(2);
    expect(events[0].event).toBe("session.start");
    expect(events[1].event).toBe("tool.after");
    expect(events[1].tool).toBe("claw-orchestrator");
  });
});
