import * as readline from "readline";
import { ClawOrchestratorACPTranslator } from "./acp-parser";

const sessionId = process.argv[2] || "claw-orchestrator-session";
const translator = new ClawOrchestratorACPTranslator(sessionId);
const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: false });

rl.on("line", (line) => {
  translator.parseAndEmitLine(line);
});

rl.on("close", () => {
  process.exit(0);
});
