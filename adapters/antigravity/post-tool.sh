#!/usr/bin/env bash
# Antigravity PostToolUse adapter hook emitting UnifiedEvent tool.after
set -euo pipefail

SESSION_ID="${ANTIGRAVITY_CONVERSATION_ID:-antigravity-session}"
LOG_DIR="${HOME}/.claude/state/agent-events"
mkdir -p "$LOG_DIR"
TARGET_FILE="${LOG_DIR}/${SESSION_ID}.ndjson"

TS=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
TOOL_NAME="${ANTIGRAVITY_TOOL_NAME:-unknown}"

cat <<EOF >> "$TARGET_FILE"
{"v":1,"ts":"$TS","tool":"antigravity","sessionId":"$SESSION_ID","event":"tool.after","share_eligibility":"public","data":{"toolName":"$TOOL_NAME","status":"success"}}
EOF
