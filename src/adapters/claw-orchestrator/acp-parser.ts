import { UnifiedEvent, UnifiedEventType } from "../../schema";
import { UnifiedEventWriter } from "../../writer";

export interface ACPMessage {
  jsonrpc?: string;
  method?: string;
  params?: Record<string, any>;
  id?: string | number;
}

/**
 * Translator mapping claw-orchestrator / acpx stdio JSON-RPC messages into UnifiedEvent NDJSON lines
 */
export class ClawOrchestratorACPTranslator {
  private writer: UnifiedEventWriter;
  private currentSessionId: string;

  constructor(sessionId: string, writer?: UnifiedEventWriter) {
    this.currentSessionId = sessionId;
    this.writer = writer || new UnifiedEventWriter();
  }

  /**
   * Process a single line of stdio JSON-RPC output from acpx / claw-orchestrator
   */
  public parseAndEmitLine(rawLine: string): UnifiedEvent | null {
    const line = rawLine.trim();
    if (!line || !line.startsWith("{")) {
      return null;
    }

    try {
      const msg: ACPMessage = JSON.parse(line);
      return this.translateMessage(msg);
    } catch (e) {
      return null;
    }
  }

  /**
   * Map ACP stdio message to UnifiedEvent
   */
  public translateMessage(msg: ACPMessage): UnifiedEvent | null {
    if (!msg.method) {
      return null;
    }

    const ts = new Date().toISOString();
    let eventType: UnifiedEventType | null = null;
    let data: Record<string, unknown> = {};

    switch (msg.method) {
      case "session/new":
      case "session/load":
        eventType = "session.start";
        data = { method: msg.method, ...msg.params };
        break;

      case "session/cancel":
        eventType = "session.end";
        data = { reason: "cancel", ...msg.params };
        break;

      case "session/prompt":
        eventType = "message";
        data = { role: "user", prompt: msg.params?.prompt || msg.params?.text };
        break;

      case "permission/request":
        eventType = "tool.before";
        data = {
          toolName: msg.params?.toolName || msg.params?.name || "permission_request",
          args: msg.params?.args || {}
        };
        break;

      case "session/update":
        if (msg.params?.state === "tool_call_start") {
          eventType = "tool.before";
          data = { toolName: msg.params?.name, args: msg.params?.args };
        } else if (msg.params?.state === "tool_call_end") {
          eventType = "tool.after";
          data = { toolName: msg.params?.name, exitCode: msg.params?.exitCode ?? 0 };
        } else {
          eventType = "message";
          data = { role: "assistant", delta: msg.params?.delta || msg.params?.text };
        }
        break;

      default:
        return null;
    }

    const event: UnifiedEvent = {
      v: 1,
      ts,
      tool: "claw-orchestrator",
      sessionId: this.currentSessionId,
      event: eventType,
      share_eligibility: "public",
      data
    };

    this.writer.emit(event);
    return event;
  }
}
