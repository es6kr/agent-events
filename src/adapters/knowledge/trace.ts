import { UnifiedEvent } from "../../schema";

// This is the source pin reported by the existing knowledge consumer, not a
// loaded-runtime measurement, credential, or authorization declaration.
const SDK_SOURCE = "4306d71ddde8e70e1742ac388cc6a93b3da566f6886909927bfff417e7fa52f0";
const SAFE_CODES = new Set(["disabled", "invalid", "unsupported", "permission_denied",
  "profile_home_required", "profile_mismatch", "scope_unavailable", "scope_denied",
  "timeout", "unavailable", "invalid_response", "conflict", "write_disabled", "sdk_failure"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const HEX = /^[0-9a-f]{64}$/;
function invalid(): never { throw new Error("invalid_knowledge_trace"); }
function exact(v: unknown, keys: string[]): Record<string, any> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return invalid();
  const proto = Object.getPrototypeOf(v);
  if (proto !== Object.prototype && proto !== null) return invalid();
  const names = Reflect.ownKeys(v);
  if (names.length !== keys.length || names.some(k => typeof k !== "string" || !keys.includes(k))) return invalid();
  const descriptors = Object.getOwnPropertyDescriptors(v);
  if (Object.values(descriptors).some(d => !Object.hasOwn(d, "value") || !d.enumerable)) return invalid();
  return v as Record<string, any>;
}
function match(v: unknown, regex: RegExp): v is string {
  return typeof v === "string" && regex.exec(v)?.[0] === v;
}
function sorted(v: any): any {
  return Array.isArray(v) ? v.map(sorted) : v && typeof v === "object" ?
    Object.fromEntries(Object.keys(v).sort().map(k => [k, sorted(v[k])])) : v;
}

/** Pure, closed projection. Shape validation is not host authentication. */
export function knowledgeTraceToEvent(value: unknown): UnifiedEvent {
  const payload = exact(value, ["binding", "trace"]);
  const b = exact(payload.binding, ["runtime", "session_id", "output_dir", "emitted_at"]);
  const t = exact(payload.trace, ["schema_version", "package_id", "source_revision",
    "loaded_revision", "operation", "status", "code", "references"]);
  if (b.runtime !== "hermes" || !match(b.session_id, /^[A-Za-z0-9_-]{1,128}$/) ||
      typeof b.output_dir !== "string" || !b.output_dir || b.output_dir.includes("\0") ||
      !match(b.emitted_at, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/)) return invalid();
  const time = new Date(b.emitted_at);
  if (!Number.isFinite(time.getTime()) || time.toISOString() !== b.emitted_at) return invalid();
  const rev = exact(t.source_revision, ["kind", "sha"]);
  if (t.schema_version !== 1 || t.package_id !== "knowledge" || t.operation !== "read_scope" ||
      t.loaded_revision !== "unknown" || rev.kind !== "sha256" || rev.sha !== SDK_SOURCE) return invalid();
  if (t.status === "success" ? t.code !== null :
      t.status !== "refused" || typeof t.code !== "string" || !SAFE_CODES.has(t.code)) return invalid();
  if (!Array.isArray(t.references) || t.references.length > 16) return invalid();
  const refs = t.references.map((ref: unknown) => {
    if (!ref || typeof ref !== "object") return invalid();
    const kind = Object.getOwnPropertyDescriptor(ref, "kind")?.value;
    if (["request", "run", "session"].includes(kind)) {
      const r = exact(ref, ["kind", "id"]);
      if (!match(r.id, UUID)) return invalid();
      return {kind, id: r.id};
    }
    if (["artifact", "evidence"].includes(kind)) {
      const r = exact(ref, ["kind", "sha256"]);
      if (!match(r.sha256, HEX)) return invalid();
      return {kind, sha256: r.sha256};
    }
    return invalid();
  });
  const trace = {schema_version: 1, package_id: "knowledge", source_revision: {kind: "sha256", sha: SDK_SOURCE},
    loaded_revision: "unknown", operation: "read_scope", status: t.status, code: t.code, references: refs};
  return {v: 1, ts: b.emitted_at, tool: "hermes", sessionId: b.session_id,
    event: "tool.after", share_eligibility: "private", data: sorted({kind: "knowledge.read", trace})};
}
