#!/usr/bin/env bash
# Antigravity PostToolUse adapter hook emitting UnifiedEvent tool.after
# Input (stdin): JSON { conversationId, toolCall: { name, ... }, ... }
# Output (stdout): JSON {} — PostToolUse has no decision to make
set -euo pipefail

INPUT="$(cat)"
SESSION_ID=$(printf '%s' "$INPUT" | jq -r '.conversationId // "antigravity-session"' 2>/dev/null)
TOOL_NAME=$(printf '%s' "$INPUT" | jq -r '.toolCall.name // "unknown"' 2>/dev/null)

LOG_DIR="${HOME}/.claude/state/agent-events"
mkdir -p "$LOG_DIR"
TARGET_FILE="${LOG_DIR}/${SESSION_ID}.ndjson"

TS=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

jq -nc --arg ts "$TS" --arg sid "$SESSION_ID" --arg tool "$TOOL_NAME" \
  '{v:1, ts:$ts, tool:"antigravity", sessionId:$sid, event:"tool.after", share_eligibility:"public", data:{toolName:$tool, status:"success"}}' \
  >> "$TARGET_FILE"

echo '{}'
