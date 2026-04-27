#!/usr/bin/env bash
# Bash equivalent of dev.ps1 — serves the static site on http://localhost:8766.
# Use on Linux/macOS or under Git Bash / WSL on Windows. Requires python3.

set -euo pipefail

PORT="${PORT:-8766}"
ROOT="$(cd "$(dirname "$0")" && pwd)"

cd "$ROOT"
echo "Serving $ROOT on http://localhost:$PORT  (Ctrl+C to stop)"
exec python3 -m http.server "$PORT"
