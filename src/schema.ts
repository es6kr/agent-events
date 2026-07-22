import { z } from "zod";

/**
 * Supported Tool / Agent Runtime identifiers
 */
export const AgentToolEnum = z.enum([
  "claude-code",
  "antigravity",
  "openclaw",
  "claw-orchestrator",
  "opencode"
]);
export type AgentTool = z.infer<typeof AgentToolEnum>;

/**
 * Standard 7 Unified Lifecycle Event Types
 */
export const UnifiedEventTypeEnum = z.enum([
  "session.start",
  "session.end",
  "tool.before",
  "tool.after",
  "message",
  "subagent.spawn",
  "checkpoint.save"
]);
export type UnifiedEventType = z.infer<typeof UnifiedEventTypeEnum>;

/**
 * Artifact Share Eligibility Gating
 */
export const ShareEligibilityEnum = z.enum(["public", "private"]);
export type ShareEligibility = z.infer<typeof ShareEligibilityEnum>;

/**
 * Unified Agent Lifecycle Event Zod Schema (ACP Parity)
 */
export const UnifiedEventSchema = z.object({
  v: z.literal(1),
  ts: z.string().datetime(),
  tool: AgentToolEnum,
  sessionId: z.string().min(1),
  conversationId: z.string().optional(),
  event: UnifiedEventTypeEnum,
  share_eligibility: ShareEligibilityEnum.default("public"),
  data: z.record(z.unknown())
});

export type UnifiedEvent = z.infer<typeof UnifiedEventSchema>;

/**
 * Helper to validate a raw event object
 */
export function validateUnifiedEvent(raw: unknown): UnifiedEvent {
  return UnifiedEventSchema.parse(raw);
}

/**
 * Helper to safely check if a raw object is a valid UnifiedEvent
 */
export function isValidUnifiedEvent(raw: unknown): boolean {
  return UnifiedEventSchema.safeParse(raw).success;
}
