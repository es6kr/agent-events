import * as crypto from "crypto";

/**
 * Redacted representation of a raw text value — hash + length only,
 * never the original content.
 */
export interface RedactedText {
  hash: string;
  length: number;
}

/**
 * Redact a raw text string into a hash/length pair. NDJSON event files live
 * under ~/.local/state/agent-events/ (world-readable) — raw prompt/message
 * text must never be written there verbatim.
 */
export function redactText(text: string): RedactedText {
  const hash = crypto.createHash("sha256").update(text, "utf-8").digest("hex").slice(0, 16);
  return { hash, length: text.length };
}

/**
 * Recursively redact any string found under a "text" key in an event's
 * `data` object. Non-"text" keys and non-string "text" values pass through
 * unchanged (redaction only ever narrows the "text" key's shape).
 */
export function redactEventData(data: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = { ...data };
  if (typeof result.text === "string") {
    result.text = redactText(result.text);
  }
  return result;
}
