import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { createHash } from "crypto";
import { spawnSync } from "child_process";

const PIN = "4306d71ddde8e70e1742ac388cc6a93b3da566f6886909927bfff417e7fa52f0";
const hash = (v: string | Buffer): string => createHash("sha256").update(v).digest("hex");
const cli = path.join(__dirname, "../dist/adapters/knowledge/cli.js");
let base: string;
beforeEach(() => { base = fs.mkdtempSync(path.join(os.tmpdir(), "knowledge-event-")); });
afterEach(() => { fs.rmSync(base, {recursive: true, force: true}); });
const input = (id = "Case_Session-1"): any => ({binding: {runtime: "hermes", session_id: id,
  output_dir: path.join(base, hash(id)), emitted_at: "2026-11-15T00:00:00.000Z"}, trace: {
  schema_version: 1, package_id: "knowledge", source_revision: {kind: "sha256", sha: PIN},
  loaded_revision: "unknown", operation: "read_scope", status: "success", code: null, references: []}});
function run(raw: string | Buffer, allowed = base) {
  return spawnSync(process.execPath, [cli, "--allowed-root", allowed],
    {input: raw, encoding: "utf8", timeout: 5000, maxBuffer: 4096, env: process.env});
}
function sorted(v: any): any {
  return Array.isArray(v) ? v.map(sorted) : v && typeof v === "object" ?
    Object.fromEntries(Object.keys(v).sort().map(k => [k, sorted(v[k])])) : v;
}

test("actual CLI and writer append exactly one canonical private event and acknowledge its bytes", () => {
  const v = input(), result = run(JSON.stringify(v));
  expect(result.status).toBe(0); expect(result.stderr).toBe("");
  const line = fs.readFileSync(path.join(v.binding.output_dir, v.binding.session_id + ".ndjson"));
  const expected = JSON.stringify({v: 1, ts: v.binding.emitted_at, tool: "hermes",
    sessionId: v.binding.session_id, event: "tool.after", share_eligibility: "private",
    data: sorted({kind: "knowledge.read", trace: v.trace})}) + "\n";
  expect(line.equals(Buffer.from(expected, "utf8"))).toBe(true);
  expect(result.stdout).toBe(JSON.stringify({schema_version: 1, status: "written", event_sha256: hash(line)}) + "\n");
});

test.each(["", "null", "{}{}", "[]", "RAW_CANARY", " ".repeat(65537)])(
  "rejects invalid or oversized stdin without creating any writer output", raw => {
    const result = run(raw); expect(result.status).toBe(1); expect(result.stdout).toBe("");
    expect(result.stderr).toBe("knowledge_emit_failed\n"); expect(fs.readdirSync(base)).toEqual([]);
  });

test.each(["outside", "relative", "empty"])("rejects %s output binding before mkdir", kind => {
  const v = input(); v.binding.output_dir = kind === "outside" ? path.join(base, "other") : kind === "relative" ? "relative" : "";
  const result = run(JSON.stringify(v)); expect(result.status).toBe(1);
  expect(result.stdout).toBe(""); expect(fs.readdirSync(base)).toEqual([]);
});

test("rejects raw text in an allowed trace field, before any output", () => {
  const v = input(); v.trace.package_id = "RAW_CANARY"; const result = run(JSON.stringify(v));
  expect(result.status).toBe(1); expect(result.stderr).not.toContain("RAW_CANARY");
  expect(fs.readdirSync(base)).toEqual([]);
});

test("rejects malformed UTF-8 instead of replacing bytes", () => {
  const result = run(Buffer.from([0xff, 0xfe]));
  expect(result.status).toBe(1); expect(result.stderr).toBe("knowledge_emit_failed\n");
  expect(fs.readdirSync(base)).toEqual([]);
});

test("separates case-only session identities without normalizing the event", () => {
  for (const id of ["SessionA", "sessiona"]) {
    const v = input(id); expect(run(JSON.stringify(v)).status).toBe(0);
    expect(JSON.parse(fs.readFileSync(path.join(v.binding.output_dir, id + ".ndjson"), "utf8")).sessionId).toBe(id);
  }
  expect(fs.readdirSync(base).sort()).toEqual([hash("SessionA"), hash("sessiona")].sort());
});

test("rejects dot traversal aliases instead of creating incidental directories", () => {
  const v = input();
  v.binding.output_dir = base + path.sep + "incidental" + path.sep + ".." + path.sep + hash(v.binding.session_id);
  const result = run(JSON.stringify(v)); expect(result.status).toBe(1);
  expect(result.stdout).toBe(""); expect(fs.readdirSync(base)).toEqual([]);
});

test("refuses an existing output-directory junction", () => {
  const v = input(), other = path.join(base, "other"); fs.mkdirSync(other);
  fs.symlinkSync(other, v.binding.output_dir, "junction");
  const result = run(JSON.stringify(v)); expect(result.status).toBe(1);
  expect(result.stdout).toBe(""); expect(fs.readdirSync(other)).toEqual([]);
});

test("refuses an existing hard-linked output file before append", () => {
  const v = input(), original = path.join(base, "original.ndjson");
  fs.mkdirSync(v.binding.output_dir); fs.writeFileSync(original, "PRESERVE\n");
  fs.linkSync(original, path.join(v.binding.output_dir, v.binding.session_id + ".ndjson"));
  const result = run(JSON.stringify(v)); expect(result.status).toBe(1);
  expect(result.stdout).toBe(""); expect(fs.readFileSync(original, "utf8")).toBe("PRESERVE\n");
});

test("pure index import has no CLI/stdin/output-directory side effects", () => {
  const result = spawnSync(process.execPath, ["-e", "require(process.argv[1]);console.log('IMPORT_ONLY')", path.join(__dirname, "../dist/index.js")],
    {encoding: "utf8", env: {...process.env, HOME: base, USERPROFILE: base}, timeout: 5000});
  expect(result.status).toBe(0); expect(result.stdout).toBe("IMPORT_ONLY\n");
  expect(result.stderr).toBe(""); expect(fs.readdirSync(base)).toEqual([]);
});
