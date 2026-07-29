#!/usr/bin/env bash
# Antigravity Stop adapter hook emitting UnifiedEvent session.end
# Input (stdin): JSON { conversationId, ... }
# Output (stdout): JSON { decision } — must always continue, this hook only logs
set -euo pipefail

INPUT="$(cat)"
SESSION_ID=$(printf '%s' "$INPUT" | jq -r '.conversationId // "antigravity-session"' 2>/dev/null)

LOG_DIR="${HOME}/.claude/state/agent-events"
mkdir -p "$LOG_DIR"
TARGET_FILE="${LOG_DIR}/${SESSION_ID}.ndjson"

TS=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

jq -nc --arg ts "$TS" --arg sid "$SESSION_ID" \
  '{v:1, ts:$ts, tool:"antigravity", sessionId:$sid, event:"session.end", share_eligibility:"public", data:{reason:"stop"}}' \
  >> "$TARGET_FILE"

echo '{"decision":"continue"}'
