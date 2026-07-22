#!/usr/bin/env bash
# Claude Code PostToolUse adapter hook emitting UnifiedEvent tool.after
set -euo pipefail

SESSION_ID="${CLAUDE_SESSION_ID:-default-session}"
LOG_DIR="${HOME}/.claude/state/agent-events"
mkdir -p "$LOG_DIR"
TARGET_FILE="${LOG_DIR}/${SESSION_ID}.ndjson"

TS=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
TOOL_NAME="${CLAUDE_TOOL_NAME:-unknown}"

cat <<EOF >> "$TARGET_FILE"
{"v":1,"ts":"$TS","tool":"claude-code","sessionId":"$SESSION_ID","event":"tool.after","share_eligibility":"public","data":{"toolName":"$TOOL_NAME","status":"success"}}
EOF
