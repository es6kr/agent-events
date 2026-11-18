import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { knowledgeTraceToEvent } from '../src/adapters/knowledge/trace';

const LEGACY = '4306d71ddde8e70e1742ac388cc6a93b3da566f6886909927bfff417e7fa52f0';
const B = 'db79ad4d9f5a63f332df42e936a5def0bb1bbd92defbf3dd4872313838d15f8b';
const MAPPER = '3571222cf3b76c027eeb506127a8b95f2f5ed706b8dd5bf0291c7b8844ba15b9';
type Ref = { kind: 'artifact'; sha256: string };
type Fixture = {
  binding: { runtime: 'hermes'; session_id: string; output_dir: string; emitted_at: string };
  trace: {
    schema_version: 1; package_id: 'knowledge'; source_revision: { kind: 'sha256'; sha: unknown };
    loaded_revision: 'unknown'; operation: 'read_scope'; status: 'success'; code: null; references: Ref[];
  };
};
function payload(pin: unknown = LEGACY): Fixture {
  return {
    binding: { runtime: 'hermes', session_id: 'RequestHomeFixture', output_dir: 'synthetic-unused', emitted_at: '2026-11-17T00:00:00.000Z' },
    trace: { schema_version: 1, package_id: 'knowledge', source_revision: { kind: 'sha256', sha: pin }, loaded_revision: 'unknown', operation: 'read_scope', status: 'success', code: null, references: [] },
  };
}
function trace(event: ReturnType<typeof knowledgeTraceToEvent>): Fixture['trace'] {
  return (event.data as unknown as { trace: Fixture['trace'] }).trace;
}
const ref = (): Ref => ({ kind: 'artifact', sha256: 'a'.repeat(64) });

test('legacy_source_is_preserved', () => {
  assert.deepEqual(trace(knowledgeTraceToEvent(payload(LEGACY))).source_revision, { kind: 'sha256', sha: LEGACY });
});
test('B_source_is_preserved', () => {
  assert.deepEqual(trace(knowledgeTraceToEvent(payload(B))).source_revision, { kind: 'sha256', sha: B });
});
test('unknown_sources_are_closed', () => {
  for (const pin of ['0'.repeat(64), 'f'.repeat(64), true, 123]) assert.throws(() => knowledgeTraceToEvent(payload(pin)), /invalid_knowledge_trace/);
});
test('B_event_is_private_and_canonical', () => {
  const e = knowledgeTraceToEvent(payload(B));
  assert.equal(e.share_eligibility, 'private'); assert.equal(e.event, 'tool.after'); assert.equal(e.tool, 'hermes');
  assert.equal(trace(e).loaded_revision, 'unknown'); assert.equal(trace(e).source_revision.sha, B);
  assert.deepEqual(Object.keys(trace(e)), Object.keys(trace(e)).sort());
});
test('descriptor_canary_is_not_invoked', () => {
  let calls = 0; const p = payload(B);
  Object.defineProperty(p.trace.source_revision, 'sha', { enumerable: true, get() { calls++; return B; } });
  assert.throws(() => knowledgeTraceToEvent(p), /invalid_knowledge_trace/); assert.equal(calls, 0);
});
test('RI2_own_map_rejected_without_invocation', () => {
  const p = payload(); let calls = 0;
  p.trace.references.map = function () { calls++; p.trace.source_revision.sha = '0'.repeat(64); return []; };
  assert.throws(() => knowledgeTraceToEvent(p), /invalid_knowledge_trace/); assert.equal(calls, 0);
});
test('RI2_index_getter_rejected_without_invocation', () => {
  const p = payload(); let calls = 0;
  Object.defineProperty(p.trace.references, '0', { enumerable: true, get() { calls++; p.trace.source_revision.sha = '0'.repeat(64); return ref(); } });
  assert.throws(() => knowledgeTraceToEvent(p), /invalid_knowledge_trace/); assert.equal(calls, 0);
});
test('RI2_sparse_array_rejected', () => {
  const p = payload(); p.trace.references.length = 1;
  assert.throws(() => knowledgeTraceToEvent(p), /invalid_knowledge_trace/);
});
test('RI2_extra_array_key_rejected', () => {
  const p = payload(); Object.defineProperty(p.trace.references, 'extra', { value: true, enumerable: true });
  assert.throws(() => knowledgeTraceToEvent(p), /invalid_knowledge_trace/);
});
test('RI2_symbol_array_key_rejected', () => {
  const p = payload(); Object.defineProperty(p.trace.references, Symbol('synthetic-extra'), { value: true, enumerable: true });
  assert.throws(() => knowledgeTraceToEvent(p), /invalid_knowledge_trace/);
});
test('RI2_nonenumerable_index_rejected', () => {
  const p = payload(); Object.defineProperty(p.trace.references, '0', { value: ref(), enumerable: false });
  assert.throws(() => knowledgeTraceToEvent(p), /invalid_knowledge_trace/);
});
test('RI2_subclass_array_rejected_without_map', () => {
  let calls = 0; class OwnArray extends Array<Ref> { map<U>(): U[] { calls++; return []; } }
  const p = payload(); p.trace.references = new OwnArray();
  assert.throws(() => knowledgeTraceToEvent(p), /invalid_knowledge_trace/); assert.equal(calls, 0);
});
test('RI2_dense_16_refs_and_pin_preserved', () => {
  for (const pin of [LEGACY, B]) {
    const p = payload(pin); p.trace.references = Array.from({ length: 16 }, ref);
    const before = JSON.stringify(p), e = knowledgeTraceToEvent(p);
    assert.equal(trace(e).source_revision.sha, pin); assert.equal(trace(e).references.length, 16);
    assert.equal(e.share_eligibility, 'private'); assert.equal(trace(e).loaded_revision, 'unknown'); assert.equal(JSON.stringify(p), before);
  }
});
test('RI2_17_refs_rejected', () => {
  const p = payload(B); p.trace.references = Array.from({ length: 17 }, ref);
  assert.throws(() => knowledgeTraceToEvent(p), /invalid_knowledge_trace/);
});
test('RI2_plain_JSON_both_pins_preserved', () => {
  for (const pin of [LEGACY, B]) assert.equal(trace(knowledgeTraceToEvent(JSON.parse(JSON.stringify(payload(pin))))).source_revision.sha, pin);
  // The tracked public JS is produced by the real build, never an SDK-source copy.
  const artifact = path.join(__dirname, 'fixtures', 'knowledge-trace-request-home.js');
  assert.equal(createHash('sha256').update(readFileSync(artifact)).digest('hex'), MAPPER);
  const generated: { knowledgeTraceToEvent: typeof knowledgeTraceToEvent } = require(artifact);
  for (const pin of [LEGACY, B]) assert.equal(trace(generated.knowledgeTraceToEvent(JSON.parse(JSON.stringify(payload(pin))))).source_revision.sha, pin);
});

test('RI3_proxy_legacy_source_uses_descriptor_snapshot', () => {
  const p = payload(LEGACY); let gets = 0;
  p.trace.source_revision = new Proxy(p.trace.source_revision, {
    get(target, key, receiver) { return key === 'sha' ? (++gets === 1 ? LEGACY : 'not-an-admitted-source') : Reflect.get(target, key, receiver); },
  });
  assert.equal(trace(knowledgeTraceToEvent(p)).source_revision.sha, LEGACY);
  assert.equal(gets, 0);
});
test('RI3_proxy_request_home_source_uses_descriptor_snapshot', () => {
  const p = payload(B); let gets = 0;
  p.trace.source_revision = new Proxy(p.trace.source_revision, {
    get(target, key, receiver) { return key === 'sha' ? (++gets <= 2 ? B : 'not-an-admitted-source') : Reflect.get(target, key, receiver); },
  });
  assert.equal(trace(knowledgeTraceToEvent(p)).source_revision.sha, B);
  assert.equal(gets, 0);
});
test('RI3_proxy_reference_UUID_uses_one_descriptor_snapshot', () => {
  const p = payload(); const id = '12345678-1234-1234-1234-123456789abc'; let gets = 0, kinds = 0;
  const r = new Proxy({ kind: 'request', id }, {
    get(target, key, receiver) { return key === 'id' ? (++gets === 1 ? id : 'not-a-uuid') : Reflect.get(target, key, receiver); },
    getOwnPropertyDescriptor(target, key) { if (key === 'kind') kinds++; return Reflect.getOwnPropertyDescriptor(target, key); },
  });
  p.trace.references = [r] as unknown as Ref[];
  assert.deepEqual(trace(knowledgeTraceToEvent(p)).references, [{ kind: 'request', id }]);
  assert.equal(gets, 0); assert.equal(kinds, 1);
});
test('RI3_proxy_reference_sha256_uses_descriptor_snapshot', () => {
  const p = payload(); const sha256 = 'a'.repeat(64); let gets = 0;
  p.trace.references = [new Proxy(ref(), {
    get(target, key, receiver) { return key === 'sha256' ? (++gets === 1 ? sha256 : 'not-a-sha256') : Reflect.get(target, key, receiver); },
  })];
  assert.deepEqual(trace(knowledgeTraceToEvent(p)).references, [{ kind: 'artifact', sha256 }]);
  assert.equal(gets, 0);
});
test('RI3_proxy_payload_never_invokes_value_get_trap', () => {
  let gets = 0;
  const p = new Proxy(payload(B), { get() { gets++; throw new Error('synthetic_caller_get_trap'); } });
  assert.equal(trace(knowledgeTraceToEvent(p)).source_revision.sha, B);
  assert.equal(gets, 0);
});
test('RI3_proxy_binding_session_uses_descriptor_snapshot', () => {
  const p = payload(B); const session = p.binding.session_id; let gets = 0;
  p.binding = new Proxy(p.binding, {
    get(target, key, receiver) { return key === 'session_id' ? (++gets === 1 ? session : '../not-an-admitted-session') : Reflect.get(target, key, receiver); },
  });
  assert.equal(knowledgeTraceToEvent(p).sessionId, session);
  assert.equal(gets, 0);
});
