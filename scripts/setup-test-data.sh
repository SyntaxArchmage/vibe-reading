#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DATA_DIR="${REPO_ROOT}/test/data"

mkdir -p "$DATA_DIR"

clone_if_missing() {
  local name="$1"
  local url="$2"
  local target="${DATA_DIR}/${name}"

  if [ -d "$target" ]; then
    echo "  [ok]   ${name} already present"
  else
    echo "  [clone] ${name} from ${url}"
    git clone --depth 1 "$url" "$target" 2>&1 | tail -1
  fi
}

echo "[setup-test-data] Data dir: ${DATA_DIR}"
echo ""

clone_if_missing "nano-vllm" "https://github.com/GeeeekExplorer/nano-vllm.git"

echo ""
echo "[setup-test-data] Done."
echo "  Analyze: npx tsx cli/analyze.ts test/data/nano-vllm"
echo "  Verify:  npx tsx cli/harness.ts test/data/nano-vllm"
