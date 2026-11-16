import * as fs from "fs";
import * as path from "path";
import { createHash } from "crypto";
import { UnifiedEventWriter } from "../../writer";
import { knowledgeTraceToEvent } from "./trace";

const digest = (v: string | Buffer): string => createHash("sha256").update(v).digest("hex");
function refuse(): never { throw new Error("invalid_output_binding"); }
function noLinks(p: string): void {
  for (let part = p; ; part = path.dirname(part)) {
    if (fs.existsSync(part)) {
      const st = fs.lstatSync(part);
      if (st.isSymbolicLink() || (st.isFile() && st.nlink !== 1)) refuse();
    } else {
      // existsSync follows dangling links; lstat still identifies those.
      try { fs.lstatSync(part); refuse(); }
      catch (e) { if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e; }
    }
    if (path.dirname(part) === part) break;
  }
}
function outputBinding(dir: unknown, root: string, session: string): string {
  if (typeof dir !== "string" || !path.isAbsolute(dir) || !path.isAbsolute(root)) return refuse();
  const realRoot = fs.realpathSync(root);
  noLinks(root);
  if (!fs.statSync(realRoot).isDirectory() || path.resolve(realRoot) !== path.resolve(root)) return refuse();
  const expected = path.join(realRoot, digest(session));
  if (path.resolve(dir) !== expected || dir.split(/[\\/]/).some(p => p === "." || p === "..")) return refuse();
  noLinks(dir);
  if (fs.existsSync(dir) && !fs.statSync(dir).isDirectory()) return refuse();
  noLinks(path.join(dir, session + ".ndjson"));
  return expected;
}
async function stdinObject(): Promise<unknown> {
  let length = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    const b = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    length += b.length;
    if (length > 65536) throw new Error("stdin_limit");
    chunks.push(b);
  }
  const text = new TextDecoder("utf-8", {fatal: true, ignoreBOM: true}).decode(Buffer.concat(chunks));
  return JSON.parse(text);
}
/** One event only. The argv root is a trusted launcher binding, not stdin authority. */
async function main(): Promise<void> {
  try {
    const args = process.argv.slice(2);
    if (args.length !== 2 || args[0] !== "--allowed-root") refuse();
    const raw = await stdinObject();
    const event = knowledgeTraceToEvent(raw);
    const dir = outputBinding((raw as any).binding.output_dir, args[1], event.sessionId);
    // GUARD: constructing the existing writer performs mkdir. All input and
    // independent output-root validation must finish before this point.
    const writer = new UnifiedEventWriter({logDir: dir, autoValidate: true});
    const file = writer.emit(event);
    const expected = Buffer.from(JSON.stringify(event) + "\n", "utf8");
    const fd = fs.openSync(file, "r");
    let actual: Buffer;
    try {
      const size = fs.fstatSync(fd).size;
      actual = Buffer.alloc(expected.length);
      if (size < expected.length || fs.readSync(fd, actual, 0, actual.length, size - actual.length) !== actual.length ||
          !actual.equals(expected)) throw new Error("written_bytes_mismatch");
    } finally { fs.closeSync(fd); }
    // Receipt certifies the observed appended bytes, not fsync/exactly-once.
    process.stdout.write(JSON.stringify({schema_version: 1, status: "written", event_sha256: digest(actual)}) + "\n");
  } catch {
    process.stderr.write("knowledge_emit_failed\n");
    process.exitCode = 1;
  }
}
if (require.main === module) void main();
