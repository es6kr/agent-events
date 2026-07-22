import { ClawOrchestratorACPTranslator } from "../src/adapters/claw-orchestrator/acp-parser";
import { UnifiedEventWriter } from "../src/writer";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

describe("ClawOrchestratorACPTranslator", () => {
  const tmpDir = path.join(os.tmpdir(), `claw-orchestrator-test-${Date.now()}`);
  const sessionId = "test-claw-session-789";
  let writer: UnifiedEventWriter;
  let translator: ClawOrchestratorACPTranslator;

  beforeEach(() => {
    writer = new UnifiedEventWriter({ logDir: tmpDir });
    translator = new ClawOrchestratorACPTranslator(sessionId, writer);
  });

  afterAll(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test("translates session/new stdio message into session.start event", () => {
    const raw = JSON.stringify({
      jsonrpc: "2.0",
      method: "session/new",
      params: { client: "acpx-cli" }
    });

    const event = translator.parseAndEmitLine(raw);

    expect(event).not.toBeNull();
    expect(event?.event).toBe("session.start");
    expect(event?.tool).toBe("claw-orchestrator");
    expect(event?.sessionId).toBe(sessionId);
  });

  test("translates permission/request stdio message into tool.before event", () => {
    const raw = JSON.stringify({
      jsonrpc: "2.0",
      method: "permission/request",
      params: { toolName: "run_command", args: { command: "npm test" } }
    });

    const event = translator.parseAndEmitLine(raw);

    expect(event).not.toBeNull();
    expect(event?.event).toBe("tool.before");
    expect(event?.data.toolName).toBe("run_command");
  });

  test("translates session/update tool_call_end into tool.after event", () => {
    const raw = JSON.stringify({
      jsonrpc: "2.0",
      method: "session/update",
      params: { state: "tool_call_end", name: "run_command", exitCode: 0 }
    });

    const event = translator.parseAndEmitLine(raw);

    expect(event).not.toBeNull();
    expect(event?.event).toBe("tool.after");
    expect(event?.data.exitCode).toBe(0);
  });
});
