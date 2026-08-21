import * as readline from "readline";
import { ClawOrchestratorACPTranslator } from "./acp-parser";
import { UnifiedEventWriter } from "../../writer";

const sessionId = process.argv[2] || "claw-orchestrator-session";
// Honor a caller-supplied LOG_DIR (matches the shell adapters' ${LOG_DIR:-...}
// fallback), so tests/tooling can isolate output from the real state dir.
const writer = new UnifiedEventWriter(process.env.LOG_DIR ? { logDir: process.env.LOG_DIR } : {});
const translator = new ClawOrchestratorACPTranslator(sessionId, writer);
const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: false });

rl.on("line", (line) => {
  translator.parseAndEmitLine(line);
});

rl.on("close", () => {
  process.exit(0);
});
