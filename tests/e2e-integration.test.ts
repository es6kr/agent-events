import { UnifiedEventWriter } from "../src/writer";
import { ClawOrchestratorACPTranslator } from "../src/adapters/claw-orchestrator/acp-parser";
import { isValidUnifiedEvent } from "../src/schema";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

describe("@es6kr/agent-events Multi-Runtime E2E Integration", () => {
  const tmpDir = path.join(os.tmpdir(), `agent-events-e2e-${Date.now()}`);
  const sessionId = "e2e-multi-runtime-session-101";
  let writer: UnifiedEventWriter;

  beforeEach(() => {
    writer = new UnifiedEventWriter({ logDir: tmpDir });
  });

  afterAll(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test("handles heterogeneous multi-runtime events in a unified stream", () => {
    // 1. Emulate Claude Code session.start
    writer.emit({
      v: 1,
      ts: "2026-07-22T13:00:00.000Z",
      tool: "claude-code",
      sessionId,
      event: "session.start",
      share_eligibility: "public",
      data: { cwd: "/Users/david/works/app" }
    });

    // 2. Emulate Antigravity subagent spawn
    writer.emit({
      v: 1,
      ts: "2026-07-22T13:00:05.000Z",
      tool: "antigravity",
      sessionId,
      event: "subagent.spawn",
      share_eligibility: "public",
      data: { subagent: "browser_subagent", task: "visual check" }
    });

    // 3. Emulate claw-orchestrator stdio ACP message stream
    const acpTranslator = new ClawOrchestratorACPTranslator(sessionId, writer);
    acpTranslator.parseAndEmitLine(
      JSON.stringify({
        jsonrpc: "2.0",
        method: "permission/request",
        params: { toolName: "run_command", args: { command: "pnpm test" } }
      })
    );

    // 4. Emulate Claude Code session.end
    writer.emit({
      v: 1,
      ts: "2026-07-22T23:59:00.000Z",
      tool: "claude-code",
      sessionId,
      event: "session.end",
      share_eligibility: "public",
      data: { reason: "stop" }
    });

    // Read back unified stream
    const events = writer.readEvents(sessionId);

    expect(events.length).toBe(4);
    expect(events.every(isValidUnifiedEvent)).toBe(true);

    // Verify runtime diversity in single log stream
    const tools = events.map((e) => e.tool);
    expect(tools).toContain("claude-code");
    expect(tools).toContain("antigravity");
    expect(tools).toContain("claw-orchestrator");

    // Verify chronological order
    expect(events[0].event).toBe("session.start");
    expect(events[1].event).toBe("subagent.spawn");
    expect(events[2].event).toBe("tool.before");
    expect(events[3].event).toBe("session.end");
  });
});
