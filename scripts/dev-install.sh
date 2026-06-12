#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SKILLS_DIR="${HOME}/.cursor/skills"

mkdir -p "$SKILLS_DIR"

link_skill() {
  local name="$1"
  local src="${REPO_ROOT}/skills/${name}"
  local dst="${SKILLS_DIR}/${name}"

  if [ ! -d "$src" ]; then
    echo "  [skip] skills/${name} not found in repo"
    return
  fi

  if [ -L "$dst" ]; then
    local current
    current="$(readlink -f "$dst")"
    if [ "$current" = "$(readlink -f "$src")" ]; then
      echo "  [ok]   ${name} → already linked"
      return
    fi
    rm "$dst"
  elif [ -e "$dst" ]; then
    echo "  [warn] ${dst} exists and is not a symlink — skipping"
    return
  fi

  ln -s "$src" "$dst"
  echo "  [link] ${name} → ${dst}"
}

echo "[dev-install] Repo: ${REPO_ROOT}"
echo "[dev-install] Linking skills to ${SKILLS_DIR}/"
echo ""

for skill_dir in "${REPO_ROOT}"/skills/*/; do
  [ -d "$skill_dir" ] || continue
  skill_name="$(basename "$skill_dir")"
  link_skill "$skill_name"
done

echo ""

cd "${REPO_ROOT}/cli" && npm install --silent 2>/dev/null
echo "[dev-install] CLI deps installed"

cd "${REPO_ROOT}/viewer" && npm install --silent 2>/dev/null
echo "[dev-install] Viewer deps installed"

echo ""
echo "[dev-install] Done. Skills are now live-linked."
echo "  Edit skills/ in the repo → subagents see changes immediately."
echo ""
echo "  Test with subagent:"
echo "    Target: ${REPO_ROOT}/test/fixture"
echo "    Skill:  /learn-code or /teach-me"
echo ""
echo "  Uninstall: rm ${SKILLS_DIR}/learn-code ${SKILLS_DIR}/teach-me"
