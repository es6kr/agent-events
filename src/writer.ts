import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { UnifiedEvent, validateUnifiedEvent } from "./schema";

export interface EventWriterOptions {
  logDir?: string;
  autoValidate?: boolean;
}

/**
 * Default directory for event log streams
 */
export function getDefaultLogDir(): string {
  return path.join(os.homedir(), ".claude", "state", "agent-events");
}

/**
 * NDJSON File Stream Writer for Unified Agent Lifecycle Events
 */
export class UnifiedEventWriter {
  private readonly logDir: string;
  private readonly autoValidate: boolean;

  constructor(options: EventWriterOptions = {}) {
    this.logDir = options.logDir || getDefaultLogDir();
    this.autoValidate = options.autoValidate ?? true;

    // Ensure log directory exists
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  /**
   * Get target NDJSON filepath for a session
   */
  public getLogFilePath(sessionId: string): string {
    const sanitizedId = sessionId.replace(/[^a-zA-Z0-9_-]/g, "_");
    return path.join(this.logDir, `${sanitizedId}.ndjson`);
  }

  /**
   * Emit a single UnifiedEvent to the session NDJSON file
   */
  public emit(event: UnifiedEvent): string {
    const validatedEvent = this.autoValidate ? validateUnifiedEvent(event) : event;
    const line = JSON.stringify(validatedEvent) + "\n";
    const targetFile = this.getLogFilePath(validatedEvent.sessionId);

    fs.appendFileSync(targetFile, line, { encoding: "utf-8" });
    return targetFile;
  }

  /**
   * Read all events for a given session ID, ordered by timestamp
   */
  public readEvents(sessionId: string): UnifiedEvent[] {
    const targetFile = this.getLogFilePath(sessionId);
    if (!fs.existsSync(targetFile)) {
      return [];
    }

    const content = fs.readFileSync(targetFile, "utf-8");
    const lines = content.split("\n").filter((l) => l.trim().length > 0);

    const events: UnifiedEvent[] = [];
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);
        events.push(validateUnifiedEvent(parsed));
      } catch (err) {
        // Skip corrupted lines in log stream
      }
    }

    // Ensure chronological order
    return events.sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());
  }
}
