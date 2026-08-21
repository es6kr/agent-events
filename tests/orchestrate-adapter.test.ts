import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { UnifiedEventWriter } from "../src/writer";
import { toPosixPath } from "./helpers/posix-path";

describe("orchestrate-adapter.sh Stdio Pipe Integration Test", () => {
  const sessionId = "test-pipe-session-999";
  const logDir = fs.mkdtempSync(path.join(os.tmpdir(), "agent-events-orchestrator-test-"));
  const targetFile = path.join(logDir, `${sessionId}.ndjson`);
  const scriptPath = path.join(__dirname, "../adapters/claw-orchestrator/orchestrate-adapter.sh");

  afterAll(() => {
    if (fs.existsSync(logDir)) {
      fs.rmSync(logDir, { recursive: true, force: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(targetFile)) {
      fs.unlinkSync(targetFile);
    }
  });

  test("converts stdio JSON-RPC stdin input to NDJSON file stream", (done) => {
    const nodeDirPosix = path.dirname(process.execPath).replace(/\\/g, "/");
    const child = spawn("bash", [toPosixPath(scriptPath), sessionId], {
      env: {
        ...process.env,
        // LOG_DIR is read by the Node CLI (process.env.LOG_DIR), not by bash,
        // so it needs a native path Node's fs can resolve — not the
        // bash-mount POSIX form toPosixPath() produces for the script path.
        LOG_DIR: logDir,
        NODE_BIN: process.execPath.replace(/\\/g, "/"),
        HOME: os.homedir().replace(/\\/g, "/"),
        PATH: `${nodeDirPosix}:${process.env.PATH}`
      }
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
