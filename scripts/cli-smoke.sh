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
# channelCount must be 183
echo "$DOC" | grep -q '"channelCount":183' || {
  echo "FAIL: expected channelCount 183 in doctor output" >&2
  exit 1
}

echo "== channels list count =="
LIST="$("${CLI[@]}" channels list --json)"
echo "$LIST" | grep -q '"count":183' || {
  echo "FAIL: expected channels list count 183" >&2
  exit 1
}

echo "== filter mediaGen =="
"${CLI[@]}" channels list --filter mediaGen --json | grep -q mediaGen:extract

echo "== describe appendTryOnStill =="
"${CLI[@]}" channels describe costumes:appendTryOnStill --json | grep -q appendTryOnStill

echo "== describe mediaGen:extract =="
"${CLI[@]}" channels describe mediaGen:extract --json | grep -q mediaGen:extract

echo "== describe scenes:aiFill plot focus =="
DESCRIBE_FILL="$("${CLI[@]}" channels describe scenes:aiFill --json)"
echo "$DESCRIBE_FILL" | grep -q segmentKeys || {
  echo "FAIL: expected scenes:aiFill argsHint to mention segmentKeys" >&2
  exit 1
}
echo "$DESCRIBE_FILL" | grep -q suggestFromStory || {
  echo "FAIL: expected scenes:aiFill argsHint to mention suggestFromStory" >&2
  exit 1
}

echo "== help =="
HELP="$("${CLI[@]}" help)"
echo "$HELP" | grep -q 'actions activity' || {
  echo "FAIL: expected help to list actions namespace" >&2
  exit 1
}
echo "$HELP" | grep -q 'chapters characters' || {
  echo "FAIL: expected help to list chapters namespace" >&2
  exit 1
}

echo "OK: CLI smoke passed (183 channels)."
