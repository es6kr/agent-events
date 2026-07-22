#!/usr/bin/env bash
# Claude Code Stop adapter hook emitting UnifiedEvent session.end
set -euo pipefail

SESSION_ID="${CLAUDE_SESSION_ID:-default-session}"
LOG_DIR="${HOME}/.claude/state/agent-events"
mkdir -p "$LOG_DIR"
TARGET_FILE="${LOG_DIR}/${SESSION_ID}.ndjson"

TS=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

cat <<EOF >> "$TARGET_FILE"
{"v":1,"ts":"$TS","tool":"claude-code","sessionId":"$SESSION_ID","event":"session.end","share_eligibility":"public","data":{"reason":"stop"}}
EOF
