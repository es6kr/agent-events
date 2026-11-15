import { isValidUnifiedEvent } from "../src/schema";

describe("knowledge runtime admission", () => {
  test("accepts hermes without impersonating a pre-existing runtime", () => {
    expect(isValidUnifiedEvent({v: 1, ts: "2026-11-15T00:00:00.000Z",
      tool: "hermes", sessionId: "synthetic-session", event: "tool.after",
      share_eligibility: "private", data: {}})).toBe(true);
  });
});
