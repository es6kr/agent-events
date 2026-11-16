import { isValidUnifiedEvent } from "../src/schema";
import * as api from "../src";

const PIN = "4306d71ddde8e70e1742ac388cc6a93b3da566f6886909927bfff417e7fa52f0";
const sample = (): any => ({binding: {runtime: "hermes", session_id: "Case_Session-1",
  output_dir: "synthetic-output", emitted_at: "2026-11-15T00:00:00.000Z"}, trace: {
  schema_version: 1, package_id: "knowledge", source_revision: {kind: "sha256", sha: PIN},
  loaded_revision: "unknown", operation: "read_scope", status: "success", code: null,
  references: [{kind: "session", id: "12345678-1234-1234-1234-123456789abc"}]}});
function project(value: unknown): any {
  const fn = (api as any).knowledgeTraceToEvent;
  expect(typeof fn).toBe("function");
  return fn(value);
}

describe("closed knowledge trace projection", () => {
  test("retains private evidence with exact session, timestamp and deep copy", () => {
    const raw = sample(), before = JSON.stringify(raw), event = project(raw);
    expect(event).toEqual({v: 1, ts: raw.binding.emitted_at, tool: "hermes",
      sessionId: raw.binding.session_id, event: "tool.after", share_eligibility: "private",
      data: {kind: "knowledge.read", trace: raw.trace}});
    expect(JSON.stringify(raw)).toBe(before);
    event.data.trace.references[0].id = "mutated-copy";
    expect(raw.trace.references[0].id).not.toBe("mutated-copy");
  });
  test.each([
    ["top-level raw", (x: any) => {x.text = "RAW_CANARY";}],
    ["trace unknown", (x: any) => {x.trace.body = "RAW_CANARY";}],
    ["package canary", (x: any) => {x.trace.package_id = "RAW_CANARY";}],
    ["operation", (x: any) => {x.trace.operation = "query";}],
    ["schema bool", (x: any) => {x.trace.schema_version = true;}],
    ["loaded revision", (x: any) => {x.trace.loaded_revision = PIN;}],
    ["wrong pin", (x: any) => {x.trace.source_revision.sha = "0".repeat(64);}],
    ["revision extra", (x: any) => {x.trace.source_revision.url = "https://invalid.example";}],
    ["success code", (x: any) => {x.trace.code = "timeout";}],
    ["refused no code", (x: any) => {x.trace.status = "refused";}],
    ["refused raw code", (x: any) => {x.trace.status = "refused"; x.trace.code = "RAW_CANARY";}],
    ["reference URL", (x: any) => {x.trace.references = [{kind: "request", id: "https://invalid.example"}];}],
    ["reference extra", (x: any) => {x.trace.references[0].body = "RAW_CANARY";}],
    ["reference cap", (x: any) => {x.trace.references = Array(17).fill(x.trace.references[0]);}],
    ["runtime", (x: any) => {x.binding.runtime = "claude-code";}],
    ["empty session", (x: any) => {x.binding.session_id = "";}],
    ["session path", (x: any) => {x.binding.session_id = "../other";}],
    ["session length", (x: any) => {x.binding.session_id = "a".repeat(129);}],
    ["invalid date", (x: any) => {x.binding.emitted_at = "2026-02-30T00:00:00.000Z";}],
    ["timestamp offset", (x: any) => {x.binding.emitted_at = "2026-11-15T00:00:00+00:00";}],
    ["binding extra", (x: any) => {x.binding.permissions = "anything";}],
    ["null trace", (x: any) => {x.trace = null;}]
  ])("rejects %s with a fixed safe error", (_name, change) => {
    const value = sample(); (change as (x: any) => void)(value);
    expect(() => project(value)).toThrow("invalid_knowledge_trace");
  });
  test.each(["timeout", "permission_denied", "invalid_response", "sdk_failure"])(
    "preserves safe refusal %s", code => {
      const raw = sample(); raw.trace.status = "refused"; raw.trace.code = code;
      expect(project(raw).data.trace).toEqual(raw.trace);
    });
  test("does not manufacture missing references", () => {
    const raw = sample(); raw.trace.references = [];
    expect(project(raw).data.trace.references).toEqual([]);
  });
});

describe("knowledge runtime admission", () => {
  test("accepts hermes without impersonating a pre-existing runtime", () => {
    expect(isValidUnifiedEvent({v: 1, ts: "2026-11-15T00:00:00.000Z",
      tool: "hermes", sessionId: "synthetic-session", event: "tool.after",
      share_eligibility: "private", data: {}})).toBe(true);
  });
});
