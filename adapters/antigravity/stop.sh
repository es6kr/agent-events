#!/usr/bin/env bash
# Antigravity Stop adapter hook emitting UnifiedEvent session.end
# Input (stdin): JSON { conversationId, ... }
# Output (stdout): JSON {} — passive logger, must NOT force continuation.
# `{"decision":"continue"}` tells Antigravity to keep looping after Stop fires
# again immediately, re-firing this hook — an infinite loop (confirmed live,
# 2026-07-30). Omitting "decision" (or `{}`) lets the turn actually end.
set -euo pipefail

INPUT="$(cat)"
SESSION_ID=$(printf '%s' "$INPUT" | jq -r '.conversationId // empty' 2>/dev/null)
SESSION_ID="${SESSION_ID:-antigravity-session}"

LOG_DIR="${HOME}/.local/state/agent-events"
mkdir -p "$LOG_DIR"
TARGET_FILE="${LOG_DIR}/${SESSION_ID}.ndjson"

TS=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

jq -nc --arg ts "$TS" --arg sid "$SESSION_ID" \
  '{v:1, ts:$ts, tool:"antigravity", sessionId:$sid, event:"session.end", share_eligibility:"public", data:{reason:"stop"}}' \
  >> "$TARGET_FILE"

echo '{}'
