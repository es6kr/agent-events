#!/usr/bin/env bash
# Claude Code PostToolUse adapter hook emitting UnifiedEvent tool.after
# Input (stdin): JSON { session_id, tool_name, tool_input, tool_response, ... }
set -euo pipefail

INPUT="${CLAUDE_TOOL_INPUT:-$(cat)}"
# Single subprocess spawn (was: 2x jq extract + date + jq build = 4 spawns).
# Each external process on this host costs ~1.2-2.7s (Windows spawn overhead),
# which repeatedly blew the 5s PostToolUse timeout budget — see
# research-claude-hooks-audit.md. printf '%(...)T' is a bash builtin (no spawn).
TS=$(printf '%(%Y-%m-%dT%H:%M:%SZ)T' -1)
_JQ_OUT=$(printf '%s' "$INPUT" | jq -r --arg ts "$TS" '
  (.session_id // "default-session") as $sid |
  (.tool_name // "unknown") as $tool |
  $sid,
  ({v:1, ts:$ts, tool:"claude-code", sessionId:$sid, event:"tool.after", share_eligibility:"public", data:{toolName:$tool, status:"success"}} | tojson)
' 2>/dev/null)
# jq.exe (native Windows binary) emits CRLF; strip CR to avoid a corrupted
# session_id/filename (bash builtin, no spawn).
mapfile -t _FIELDS <<< "${_JQ_OUT//$'\r'/}"
SESSION_ID="${_FIELDS[0]:-default-session}"
EVENT_LINE="${_FIELDS[1]:-}"

LOG_DIR="${LOG_DIR:-${HOME}/.local/state/agent-events}"
[ -d "$LOG_DIR" ] || mkdir -p "$LOG_DIR"
TARGET_FILE="${LOG_DIR}/${SESSION_ID}.ndjson"

[ -n "$EVENT_LINE" ] && printf '%s\n' "$EVENT_LINE" >> "$TARGET_FILE"
