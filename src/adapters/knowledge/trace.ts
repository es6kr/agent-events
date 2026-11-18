import { UnifiedEvent } from "../../schema";

// This is the source pin reported by the existing knowledge consumer, not a
// loaded-runtime measurement, credential, or authorization declaration.
const SDK_SOURCE = "4306d71ddde8e70e1742ac388cc6a93b3da566f6886909927bfff417e7fa52f0";
const REQUEST_HOME_SDK_SOURCE = "db79ad4d9f5a63f332df42e936a5def0bb1bbd92defbf3dd4872313838d15f8b";
const SAFE_CODES = new Set(["disabled", "invalid", "unsupported", "permission_denied",
  "profile_home_required", "profile_mismatch", "scope_unavailable", "scope_denied",
  "timeout", "unavailable", "invalid_response", "conflict", "write_disabled", "sdk_failure"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const HEX = /^[0-9a-f]{64}$/;
function invalid(): never { throw new Error("invalid_knowledge_trace"); }
function snapshot(v: unknown): Record<string, any> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return invalid();
  const proto = Object.getPrototypeOf(v);
  if (proto !== Object.prototype && proto !== null) return invalid();
  // GUARD: inspect caller-owned descriptors once; never re-read via value get.
  const descriptors = Object.getOwnPropertyDescriptors(v);
  const result: Record<string, any> = Object.create(null);
  for (const name of Reflect.ownKeys(descriptors)) {
    if (typeof name !== "string") return invalid();
    const descriptor = descriptors[name];
    if (!Object.hasOwn(descriptor, "value") || !descriptor.enumerable) return invalid();
    result[name] = descriptor.value;
  }
  return result;
}
function exact(v: unknown, keys: string[]): Record<string, any> {
  const result = snapshot(v), names = Object.keys(result);
  if (names.length !== keys.length || names.some(k => !keys.includes(k))) return invalid();
  return result;
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
      t.loaded_revision !== "unknown" || rev.kind !== "sha256" || (rev.sha !== SDK_SOURCE && rev.sha !== REQUEST_HOME_SDK_SOURCE)) return invalid();
  if (t.status === "success" ? t.code !== null :
      t.status !== "refused" || typeof t.code !== "string" || !SAFE_CODES.has(t.code)) return invalid();
  // GUARD: retain validated scalars before inspecting any caller-owned array.
  const sourceSha = rev.sha, status = t.status, code = t.code;
  const emittedAt = b.emitted_at, sessionId = b.session_id;
  const inputRefs: unknown = t.references;
  if (!Array.isArray(inputRefs) || Object.getPrototypeOf(inputRefs) !== Array.prototype) return invalid();
  const descriptors: Record<string, PropertyDescriptor> = Object.getOwnPropertyDescriptors(inputRefs);
  const length = descriptors.length?.value;
  if (!Number.isInteger(length) || length < 0 || length > 16 ||
      Reflect.ownKeys(descriptors).length !== length + 1) return invalid();
  const refs: Array<Record<string, string>> = [];
  for (let i = 0; i < length; i++) {
    const descriptor = descriptors[String(i)];
    if (!descriptor || !Object.hasOwn(descriptor, "value") || !descriptor.enumerable) return invalid();
    const ref: unknown = descriptor.value;
    refs.push(projectReference(ref));
  }
  function projectReference(ref: unknown): Record<string, string> {
    const shape = snapshot(ref), kind = shape.kind;
    if (["request", "run", "session"].includes(kind)) {
      const r = exact(shape, ["kind", "id"]);
      if (!match(r.id, UUID)) return invalid();
      return {kind, id: r.id};
    }
    if (["artifact", "evidence"].includes(kind)) {
      const r = exact(shape, ["kind", "sha256"]);
      if (!match(r.sha256, HEX)) return invalid();
      return {kind, sha256: r.sha256};
    }
    return invalid();
  }
  const trace = {schema_version: 1, package_id: "knowledge", source_revision: {kind: "sha256", sha: sourceSha},
    loaded_revision: "unknown", operation: "read_scope", status, code, references: refs};
  return {v: 1, ts: emittedAt, tool: "hermes", sessionId,
    event: "tool.after", share_eligibility: "private", data: sorted({kind: "knowledge.read", trace})};
}
