#!/usr/bin/env bash
# claw-orchestrator / acpx stdio pipe listener script emitting UnifiedEvent NDJSON lines
set -euo pipefail

SESSION_ID="${1:-claw-orchestrator-session}"
NODE_BIN="${NODE_BIN:-node}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "[claw-orchestrator-adapter] Listening on stdin for ACP JSON-RPC messages (sessionId: $SESSION_ID)..."

exec "$NODE_BIN" "$SCRIPT_DIR/../../dist/adapters/claw-orchestrator/cli.js" "$SESSION_ID"
