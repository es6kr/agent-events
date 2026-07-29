#!/usr/bin/env bash
# Claude Code SessionStart adapter hook emitting UnifiedEvent session.start
# Input (stdin): JSON { session_id, cwd, hook_event_name, ... }
set -euo pipefail

INPUT="${CLAUDE_TOOL_INPUT:-$(cat)}"
SESSION_ID=$(printf '%s' "$INPUT" | jq -r '.session_id // empty' 2>/dev/null)
SESSION_ID="${SESSION_ID:-default-session}"
CWD=$(printf '%s' "$INPUT" | jq -r '.cwd // env.PWD // ""' 2>/dev/null)

LOG_DIR="${HOME}/.local/state/agent-events"
mkdir -p "$LOG_DIR"
TARGET_FILE="${LOG_DIR}/${SESSION_ID}.ndjson"

TS=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

jq -nc --arg ts "$TS" --arg sid "$SESSION_ID" --arg cwd "$CWD" \
  '{v:1, ts:$ts, tool:"claude-code", sessionId:$sid, event:"session.start", share_eligibility:"public", data:{cwd:$cwd}}' \
  >> "$TARGET_FILE"
