import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { UnifiedEventWriter } from "../src/writer";

describe("orchestrate-adapter.sh Stdio Pipe Integration Test", () => {
  const sessionId = "test-pipe-session-999";
  const logDir = path.join(os.homedir(), ".claude", "state", "agent-events");
  const targetFile = path.join(logDir, `${sessionId}.ndjson`);
  const scriptPath = path.join(__dirname, "../adapters/claw-orchestrator/orchestrate-adapter.sh");

  afterEach(() => {
    if (fs.existsSync(targetFile)) {
      fs.unlinkSync(targetFile);
    }
  });

  test("converts stdio JSON-RPC stdin input to NDJSON file stream", (done) => {
    const child = spawn(scriptPath, [sessionId], {
      env: { ...process.env, NODE_BIN: "node" }
    });

    const acpMessages = [
      JSON.stringify({ jsonrpc: "2.0", method: "session/new", params: { client: "acpx" } }) + "\n",
      JSON.stringify({
        jsonrpc: "2.0",
        method: "permission/request",
        params: { toolName: "run_command", args: { command: "npm test" } }
      }) + "\n",
      JSON.stringify({ jsonrpc: "2.0", method: "session/cancel", params: { reason: "done" } }) + "\n"
    ];

    acpMessages.forEach((msg) => child.stdin.write(msg));
    child.stdin.end();

    child.on("close", (code) => {
      expect(code).toBe(0);
      expect(fs.existsSync(targetFile)).toBe(true);

      const writer = new UnifiedEventWriter({ logDir });
      const events = writer.readEvents(sessionId);

      expect(events.length).toBe(3);
      expect(events[0].event).toBe("session.start");
      expect(events[1].event).toBe("tool.before");
      expect(events[1].data.toolName).toBe("run_command");
      expect(events[2].event).toBe("session.end");

      done();
    });
  });
});
