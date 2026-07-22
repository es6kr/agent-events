import { redactText, redactEventData } from "../src/redact";
import { UnifiedEventWriter } from "../src/writer";
import { UnifiedEvent } from "../src/schema";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

describe("@es6kr/agent-events Redaction", () => {
  test("redactText never contains the original text", () => {
    const secret = "please rm -rf my production database, sincerely a very embarrassing prompt";
    const redacted = redactText(secret);

    expect(redacted.length).toBe(secret.length);
    expect(redacted.hash).toMatch(/^[0-9a-f]{16}$/);
    expect(JSON.stringify(redacted)).not.toContain("rm -rf");
    expect(JSON.stringify(redacted)).not.toContain("production");
  });

  test("redactText is deterministic (same input -> same hash)", () => {
    expect(redactText("hello world").hash).toBe(redactText("hello world").hash);
    expect(redactText("hello world").hash).not.toBe(redactText("hello world!").hash);
  });

  test("redactEventData only touches the text key", () => {
    const data = { text: "raw sensitive message", toolName: "Read", count: 3 };
    const result = redactEventData(data);

    expect(result.toolName).toBe("Read");
    expect(result.count).toBe(3);
    expect(result.text).toEqual({ hash: expect.any(String), length: "raw sensitive message".length });
  });

  test("redactEventData passes through data with no text key unchanged", () => {
    const data = { toolName: "Bash", exitCode: 0 };
    expect(redactEventData(data)).toEqual(data);
  });

  test("writer.emit redacts data.text before it touches disk", () => {
    const tmpDir = path.join(os.tmpdir(), `agent-events-redact-test-${Date.now()}`);
    const writer = new UnifiedEventWriter({ logDir: tmpDir });
    const sessionId = "redact-test-session";
    const secret = "user's actual prompt text with potentially sensitive content";

    const event: UnifiedEvent = {
      v: 1,
      ts: new Date().toISOString(),
      tool: "claude-code",
      sessionId,
      event: "message",
      share_eligibility: "public",
      data: { role: "user", text: secret }
    };

    const targetFile = writer.emit(event);
    const rawFileContent = fs.readFileSync(targetFile, "utf-8");

    expect(rawFileContent).not.toContain(secret);
    expect(rawFileContent).not.toContain("sensitive");

    const [readBack] = writer.readEvents(sessionId);
    expect(readBack.data.text).toEqual({ hash: expect.any(String), length: secret.length });

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
