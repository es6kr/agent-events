#!/usr/bin/env bash
# Antigravity PreToolUse adapter hook emitting UnifiedEvent tool.before
# Input (stdin): JSON { conversationId, toolCall: { name, ... }, ... }
# Output (stdout): JSON { decision } — must always allow, this hook only logs
set -euo pipefail

INPUT="$(cat)"
SESSION_ID=$(printf '%s' "$INPUT" | jq -r '.conversationId // empty' 2>/dev/null)
SESSION_ID="${SESSION_ID:-antigravity-session}"
TOOL_NAME=$(printf '%s' "$INPUT" | jq -r '.toolCall.name // empty' 2>/dev/null)
TOOL_NAME="${TOOL_NAME:-unknown}"

LOG_DIR="${HOME}/.local/state/agent-events"
mkdir -p "$LOG_DIR"
TARGET_FILE="${LOG_DIR}/${SESSION_ID}.ndjson"

TS=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

jq -nc --arg ts "$TS" --arg sid "$SESSION_ID" --arg tool "$TOOL_NAME" \
  '{v:1, ts:$ts, tool:"antigravity", sessionId:$sid, event:"tool.before", share_eligibility:"public", data:{toolName:$tool}}' \
  >> "$TARGET_FILE"

echo '{"decision":"allow"}'
