import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { UnifiedEventWriter } from "../src/writer";
import { isValidUnifiedEvent } from "../src/schema";

describe("@es6kr/agent-events Shell Adapters Test Suite", () => {
  const sessionId = "test-shell-adapters-session";
  const logDir = path.join(os.homedir(), ".claude", "state", "agent-events");
  const targetFile = path.join(logDir, `${sessionId}.ndjson`);

  const claudeAdaptersDir = path.join(__dirname, "../adapters/claude-code");
  const antigravityAdaptersDir = path.join(__dirname, "../adapters/antigravity");

  afterEach(() => {
    if (fs.existsSync(targetFile)) {
      fs.unlinkSync(targetFile);
    }
  });

  test("executes Claude Code shell adapter scripts cleanly", () => {
    // Real Claude Code hooks pass session_id/tool_name via a JSON payload on
    // stdin (or CLAUDE_TOOL_INPUT env var) — not CLAUDE_SESSION_ID/CLAUDE_TOOL_NAME
    // env vars, which Claude Code never sets.
    const env = { ...process.env };
    delete env.CLAUDE_TOOL_INPUT;

    const sessionStartInput = JSON.stringify({ session_id: sessionId, cwd: "/tmp" });
    const toolInput = JSON.stringify({ session_id: sessionId, tool_name: "Write" });
    const stopInput = JSON.stringify({ session_id: sessionId, transcript_path: "/tmp/t.jsonl" });

    execSync(`bash ${path.join(claudeAdaptersDir, "session-start.sh")}`, { env, input: sessionStartInput });
    execSync(`bash ${path.join(claudeAdaptersDir, "pre-tool.sh")}`, { env, input: toolInput });
    execSync(`bash ${path.join(claudeAdaptersDir, "post-tool.sh")}`, { env, input: toolInput });
    execSync(`bash ${path.join(claudeAdaptersDir, "stop.sh")}`, { env, input: stopInput });

    expect(fs.existsSync(targetFile)).toBe(true);

    const writer = new UnifiedEventWriter({ logDir });
    const events = writer.readEvents(sessionId);

    expect(events.length).toBe(4);
    expect(events.every(isValidUnifiedEvent)).toBe(true);
    expect(events[0].event).toBe("session.start");
    expect(events[1].event).toBe("tool.before");
    expect(events[2].event).toBe("tool.after");
    expect(events[3].event).toBe("session.end");
  });

  test("executes Antigravity shell adapter scripts cleanly", () => {
    const env = {
      ...process.env,
      ANTIGRAVITY_CONVERSATION_ID: sessionId,
      ANTIGRAVITY_TOOL_NAME: "run_command"
    };

    execSync(`bash ${path.join(antigravityAdaptersDir, "pre-tool.sh")}`, { env });
    execSync(`bash ${path.join(antigravityAdaptersDir, "post-tool.sh")}`, { env });

    expect(fs.existsSync(targetFile)).toBe(true);

    const writer = new UnifiedEventWriter({ logDir });
    const events = writer.readEvents(sessionId);

    expect(events.length).toBe(2);
    expect(events.every(isValidUnifiedEvent)).toBe(true);
    expect(events[0].tool).toBe("antigravity");
    expect(events[0].event).toBe("tool.before");
    expect(events[1].event).toBe("tool.after");
  });
});
