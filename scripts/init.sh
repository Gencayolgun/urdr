#!/usr/bin/env bash
#
# init.sh — Initialize Urðr Memory Tree
#
# Usage:
#   ./init.sh                    # Interactive (asks for language, path)
#   ./init.sh --path ~/myproject/memory  # Specify target directory
#   ./init.sh --lang en          # English only (default)
#   ./init.sh --lang tr          # Turkish only
#   ./init.sh --lang both        # Both English and Turkish
#
# Description:
#   Creates a new Urðr memory tree in the specified directory.
#   Copies root templates, personality, and creates initial branch structure.
#

set -euo pipefail

# ── Configuration ──────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
TEMPLATES_DIR="$REPO_ROOT/templates"
PROTOCOLS_DIR="$REPO_ROOT/protocols"
INTEGRATIONS_DIR="$REPO_ROOT/integrations"

# ── Color output ───────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

info()  { echo -e "${BLUE}ℹ${NC} $1"; }
ok()    { echo -e "${GREEN}✓${NC} $1"; }
warn()  { echo -e "${YELLOW}⚠${NC} $1"; }
error() { echo -e "${RED}✗${NC} $1"; }

# ── Defaults ───────────────────────────────────────────────────────
TARGET_DIR=""
LANG="en"
AGENT_NAME=""
USER_NAME=""

# ── Parse arguments ────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --path)
      TARGET_DIR="$2"
      shift 2
      ;;
    --lang)
      LANG="$2"
      shift 2
      ;;
    --agent-name)
      AGENT_NAME="$2"
      shift 2
      ;;
    --user-name)
      USER_NAME="$2"
      shift 2
      ;;
    --help|-h)
      echo "Usage: ./init.sh [options]"
      echo ""
      echo "Options:"
      echo "  --path <dir>       Target directory (default: ./memory)"
      echo "  --lang <en|tr|both> Language (default: en)"
      echo "  --agent-name <name> Agent name for personality template"
      echo "  --user-name <name>  User name for personality template"
      echo "  --help, -h         Show this help"
      exit 0
      ;;
    *)
      error "Unknown option: $1"
      exit 1
      ;;
  esac
done

# ── Interactive prompts ────────────────────────────────────────────
if [[ -z "$TARGET_DIR" ]]; then
  read -rp "Memory directory [./memory]: " TARGET_DIR
  TARGET_DIR="${TARGET_DIR:-./memory}"
fi

if [[ "$LANG" == "en" && -z "$AGENT_NAME" ]]; then
  read -rp "Agent name [Agent]: " AGENT_NAME
  AGENT_NAME="${AGENT_NAME:-Agent}"
fi

if [[ -z "$USER_NAME" ]]; then
  read -rp "Your name [User]: " USER_NAME
  USER_NAME="${USER_NAME:-User}"
fi

# ── Create target directory ────────────────────────────────────────
mkdir -p "$TARGET_DIR"
TARGET_DIR="$(cd "$TARGET_DIR" && pwd)"
ok "Target: $TARGET_DIR"

# ── Copy templates ─────────────────────────────────────────────────
copy_if_exists() {
  local src="$1"
  local dest="$2"
  if [[ -f "$src" ]]; then
    cp "$src" "$dest"
    ok "Created: $(basename "$dest")"
  else
    warn "Template not found: $src"
  fi
}

case "$LANG" in
  en)
    info "Installing English templates..."
    copy_if_exists "$TEMPLATES_DIR/root-0-index.md" "$TARGET_DIR/root-0-index.md"
    copy_if_exists "$TEMPLATES_DIR/root-1-topics.md" "$TARGET_DIR/root-1-topics.md"
    copy_if_exists "$TEMPLATES_DIR/root-2-technical.md" "$TARGET_DIR/root-2-technical.md"
    copy_if_exists "$TEMPLATES_DIR/root-3-decisions.md" "$TARGET_DIR/root-3-decisions.md"
    copy_if_exists "$TEMPLATES_DIR/agent-personality.md" "$TARGET_DIR/agent-personality.md"
    ;;
  tr)
    info "Installing Turkish templates..."
    copy_if_exists "$TEMPLATES_DIR/kök-0-indeks.md" "$TARGET_DIR/kök-0-indeks.md"
    copy_if_exists "$TEMPLATES_DIR/kök-1-konular.md" "$TARGET_DIR/kök-1-konular.md"
    copy_if_exists "$TEMPLATES_DIR/kök-2-teknik.md" "$TARGET_DIR/kök-2-teknik.md"
    copy_if_exists "$TEMPLATES_DIR/kök-3-kararlar.md" "$TARGET_DIR/kök-3-kararlar.md"
    copy_if_exists "$TEMPLATES_DIR/agent-personality.md" "$TARGET_DIR/agent-personality.md"
    ;;
  both)
    info "Installing both English and Turkish templates..."
    copy_if_exists "$TEMPLATES_DIR/root-0-index.md" "$TARGET_DIR/root-0-index.md"
    copy_if_exists "$TEMPLATES_DIR/root-1-topics.md" "$TARGET_DIR/root-1-topics.md"
    copy_if_exists "$TEMPLATES_DIR/root-2-technical.md" "$TARGET_DIR/root-2-technical.md"
    copy_if_exists "$TEMPLATES_DIR/root-3-decisions.md" "$TARGET_DIR/root-3-decisions.md"
    copy_if_exists "$TEMPLATES_DIR/kök-0-indeks.md" "$TARGET_DIR/kök-0-indeks.md"
    copy_if_exists "$TEMPLATES_DIR/kök-1-konular.md" "$TARGET_DIR/kök-1-konular.md"
    copy_if_exists "$TEMPLATES_DIR/kök-2-teknik.md" "$TARGET_DIR/kök-2-teknik.md"
    copy_if_exists "$TEMPLATES_DIR/kök-3-kararlar.md" "$TARGET_DIR/kök-3-kararlar.md"
    copy_if_exists "$TEMPLATES_DIR/agent-personality.md" "$TARGET_DIR/agent-personality.md"
    ;;
esac

# ── Customize personality ──────────────────────────────────────────
PERSONALITY_FILE="$TARGET_DIR/agent-personality.md"
if [[ -f "$PERSONALITY_FILE" ]]; then
  if [[ -n "$AGENT_NAME" ]]; then
    sed -i '' "s/\[Agent Name\]/$AGENT_NAME/g" "$PERSONALITY_FILE" 2>/dev/null || \
    sed -i "s/\[Agent Name\]/$AGENT_NAME/g" "$PERSONALITY_FILE"
    ok "Personality: agent name set to '$AGENT_NAME'"
  fi
  if [[ -n "$USER_NAME" ]]; then
    sed -i '' "s/\[User Name\]/$USER_NAME/g" "$PERSONALITY_FILE" 2>/dev/null || \
    sed -i "s/\[User Name\]/$USER_NAME/g" "$PERSONALITY_FILE"
    ok "Personality: user name set to '$USER_NAME'"
  fi
fi

# ── Copy protocols (optional) ──────────────────────────────────────
if [[ -d "$PROTOCOLS_DIR" ]]; then
  mkdir -p "$TARGET_DIR/protocols"
  cp "$PROTOCOLS_DIR"/*.md "$TARGET_DIR/protocols/" 2>/dev/null && \
    ok "Protocols copied to $TARGET_DIR/protocols/"
fi

# ── Initialize git ─────────────────────────────────────────────────
if [[ ! -d "$TARGET_DIR/.git" ]]; then
  git -C "$TARGET_DIR" init -q
  git -C "$TARGET_DIR" add -A
  git -C "$TARGET_DIR" commit -m "initial: Urðr memory tree initialized" -q
  ok "Git repository initialized"
fi

# ── Summary ────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}══════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Urðr Memory Tree Initialized${NC}"
echo -e "${GREEN}══════════════════════════════════════════════════════${NC}"
echo ""
echo "  Location: $TARGET_DIR"
echo "  Language: $LANG"
echo "  Roots:    $(ls "$TARGET_DIR"/root-*.md "$TARGET_DIR"/kök-*.md 2>/dev/null | wc -l | tr -d ' ')"
echo "  Agent:    ${AGENT_NAME:-default}"
echo ""
echo "  Quick start:"
echo "    cd $TARGET_DIR"
echo "    ls *.md           # See your roots"
echo "    code root-0-index.md  # Start organizing"
echo ""
echo -e "${BLUE}  Urðr remembers. You focus on building.${NC} 🌳"
echo ""
