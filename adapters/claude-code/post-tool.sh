#!/usr/bin/env bash
# Claude Code PostToolUse adapter hook emitting UnifiedEvent tool.after
# Input (stdin): JSON { session_id, tool_name, tool_input, tool_response, ... }
set -euo pipefail

INPUT="${CLAUDE_TOOL_INPUT:-$(cat)}"
SESSION_ID=$(printf '%s' "$INPUT" | jq -r '.session_id // empty' 2>/dev/null)
SESSION_ID="${SESSION_ID:-default-session}"
TOOL_NAME=$(printf '%s' "$INPUT" | jq -r '.tool_name // empty' 2>/dev/null)
TOOL_NAME="${TOOL_NAME:-unknown}"

LOG_DIR="${HOME}/.local/state/agent-events"
mkdir -p "$LOG_DIR"
TARGET_FILE="${LOG_DIR}/${SESSION_ID}.ndjson"

TS=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

jq -nc --arg ts "$TS" --arg sid "$SESSION_ID" --arg tool "$TOOL_NAME" \
  '{v:1, ts:$ts, tool:"claude-code", sessionId:$sid, event:"tool.after", share_eligibility:"public", data:{toolName:$tool, status:"success"}}' \
  >> "$TARGET_FILE"
