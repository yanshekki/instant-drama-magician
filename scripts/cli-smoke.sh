#!/usr/bin/env bash
# Smoke-test instant-drama CLI surface (no real AI calls).
# Usage: from repo root → bash scripts/cli-smoke.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
CLI=(npx tsx src/cli/bin.ts)

echo "== version =="
"${CLI[@]}" version

echo "== doctor =="
DOC="$("${CLI[@]}" doctor --json)"
echo "$DOC" | head -c 400
echo "…"
# channelCount must be 158
echo "$DOC" | grep -q '"channelCount":158' || {
  echo "FAIL: expected channelCount 158 in doctor output" >&2
  exit 1
}

echo "== channels list count =="
LIST="$("${CLI[@]}" channels list --json)"
echo "$LIST" | grep -q '"count":158' || {
  echo "FAIL: expected channels list count 158" >&2
  exit 1
}

echo "== filter mediaGen =="
"${CLI[@]}" channels list --filter mediaGen --json | grep -q mediaGen:extract

echo "== describe appendTryOnStill =="
"${CLI[@]}" channels describe costumes:appendTryOnStill --json | grep -q appendTryOnStill

echo "== describe mediaGen:extract =="
"${CLI[@]}" channels describe mediaGen:extract --json | grep -q mediaGen:extract

echo "== help =="
"${CLI[@]}" help >/dev/null

echo "OK: CLI smoke passed (158 channels)."
