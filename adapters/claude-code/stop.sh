#!/usr/bin/env bash
# Claude Code Stop adapter hook emitting UnifiedEvent session.end
# Input (stdin): JSON { session_id, transcript_path, stop_hook_active }
# Always allows (exit 0) — this hook only logs, never blocks Stop.
set -euo pipefail

INPUT="${CLAUDE_TOOL_INPUT:-$(cat)}"
SESSION_ID=$(printf '%s' "$INPUT" | jq -r '.session_id // empty' 2>/dev/null)
SESSION_ID="${SESSION_ID:-default-session}"

LOG_DIR="${HOME}/.local/state/agent-events"
mkdir -p "$LOG_DIR"
TARGET_FILE="${LOG_DIR}/${SESSION_ID}.ndjson"

TS=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

jq -nc --arg ts "$TS" --arg sid "$SESSION_ID" \
  '{v:1, ts:$ts, tool:"claude-code", sessionId:$sid, event:"session.end", share_eligibility:"public", data:{reason:"stop"}}' \
  >> "$TARGET_FILE"

exit 0
