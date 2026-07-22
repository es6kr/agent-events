#!/usr/bin/env bash
# claw-orchestrator / acpx stdio pipe listener script emitting UnifiedEvent NDJSON lines
set -euo pipefail

SESSION_ID="${1:-claw-orchestrator-session}"
NODE_BIN="${NODE_BIN:-node}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "[claw-orchestrator-adapter] Listening on stdin for ACP JSON-RPC messages (sessionId: $SESSION_ID)..."

exec "$NODE_BIN" -e "
const readline = require('readline');
const path = require('path');
const { ClawOrchestratorACPTranslator } = require(path.join('$SCRIPT_DIR', '../../dist/adapters/claw-orchestrator/acp-parser'));

const translator = new ClawOrchestratorACPTranslator('$SESSION_ID');
const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: false });

rl.on('line', (line) => {
  translator.parseAndEmitLine(line);
});

rl.on('close', () => {
  process.exit(0);
});
"
