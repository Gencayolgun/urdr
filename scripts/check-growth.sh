#!/usr/bin/env bash
#
# check-growth.sh — Urðr Memory Growth Audit
#
# Usage:
#   ./check-growth.sh                    # Audit current directory
#   ./check-growth.sh /path/to/memory    # Audit specific directory
#   ./check-growth.sh --verbose          # Show detailed leaf counts
#   ./check-growth.sh --fix              # Auto-fix (add split markers)
#
# Description:
#   Scans all root files in the memory directory and reports:
#   - Branch count per root (warn if > 9)
#   - Largest branches (warn if > 30, error if > 50)
#   - Cross-reference health
#   - Stale entries (> 6 months old)
#

set -euo pipefail

# DEPRECATED (bash-only — does not run on stock Windows). Use the cross-platform,
# feature-complete Node successor instead:  node scripts/lint.mjs [memory-dir]
echo "⚠️  check-growth.sh is deprecated — use: node scripts/lint.mjs" >&2

# ── Configuration ──────────────────────────────────────────────────
MEMORY_DIR="${1:-.}"
VERBOSE=false
FIX_MODE=false
STALE_MONTHS=6

# ── Parse arguments ────────────────────────────────────────────────
for arg in "$@"; do
  case "$arg" in
    --verbose) VERBOSE=true ;;
    --fix) FIX_MODE=true ;;
    --help|-h)
      echo "Usage: ./check-growth.sh [directory] [options]"
      echo ""
      echo "Options:"
      echo "  --verbose    Show detailed leaf counts per branch"
      echo "  --fix        Add split/deprecation markers automatically"
      echo "  --help       Show this help"
      exit 0
      ;;
  esac
done

# ── Color output ───────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

info()  { echo -e "${BLUE}ℹ${NC} $1"; }
ok()    { echo -e "${GREEN}✓${NC} $1"; }
warn()  { echo -e "${YELLOW}⚠${NC} $1"; }
error() { echo -e "${RED}✗${NC} $1"; }

# ── Validate directory ─────────────────────────────────────────────
if [[ ! -d "$MEMORY_DIR" ]]; then
  error "Directory not found: $MEMORY_DIR"
  exit 1
fi

MEMORY_DIR="$(cd "$MEMORY_DIR" && pwd)"
echo ""
echo -e "${BOLD}📊 Urðr Growth Audit — $(date '+%d.%m.%Y')${NC}"
echo -e "${BOLD}   Directory: $MEMORY_DIR${NC}"
echo ""

# ── Find root files ────────────────────────────────────────────────
ROOT_FILES=()
while IFS= read -r -d '' file; do
  ROOT_FILES+=("$file")
done < <(find "$MEMORY_DIR" -maxdepth 1 -type f \( -name "root-*.md" -o -name "kök-*.md" \) -print0 | sort -z)

if [[ ${#ROOT_FILES[@]} -eq 0 ]]; then
  error "No root files found in $MEMORY_DIR"
  echo "  Looked for: root-*.md or kök-*.md"
  exit 1
fi

# ── Colors for health status ──────────────────────────────────────
health_color() {
  local count="$1"
  local warn_at="$2"
  local error_at="$3"

  if [[ "$count" -ge "$error_at" ]]; then
    echo -e "${RED}$count${NC}"
  elif [[ "$count" -ge "$warn_at" ]]; then
    echo -e "${YELLOW}$count${NC}"
  else
    echo -e "${GREEN}$count${NC}"
  fi
}

# ── Analyze each root ──────────────────────────────────────────────
TOTAL_WARNINGS=0
TOTAL_ERRORS=0
RECOMMENDATIONS=()

for root_file in "${ROOT_FILES[@]}"; do
  filename=$(basename "$root_file")
  root_name="${filename%.*}"

  echo -e "${BOLD}📁 $filename${NC}"

  # Count branches (## headings)
  branch_lines=$(grep -c '^## ' "$root_file" 2>/dev/null || echo 0)
  branch_count=$(grep '^## ' "$root_file" 2>/dev/null | wc -l | tr -d ' ')

  echo -e "  Branches: $(health_color "$branch_count" 7 9)"

  # Skip branch analysis for root-0 (it's an index)
  if [[ "$filename" == *"index"* ]] || [[ "$filename" == *"indeks"* ]]; then
    echo "  (index file — branch analysis skipped)"
    echo ""
    continue
  fi

  # Analyze each branch
  LARGEST_BRANCH=""
  LARGEST_COUNT=0
  LARGEST_PATTERN=""

  while IFS= read -r branch_line; do
    branch_name=$(echo "$branch_line" | sed 's/^## //')
    # Count lines until next ## heading or end of file
    leaf_count=$(awk "/^## /{if(found) exit} found{count++} /^## ${branch_name}$/{found=1}" "$root_file" 2>/dev/null | wc -l | tr -d ' ')
    leaf_count="${leaf_count:-0}"

    if [[ "$leaf_count" -gt "$LARGEST_COUNT" ]]; then
      LARGEST_COUNT="$leaf_count"
      LARGEST_BRANCH="$branch_name"
    fi

    if [[ "$leaf_count" -ge 50 ]]; then
      echo -e "  ${RED}  ✗ $branch_name: $leaf_count leaves (MUST split)${NC}"
      TOTAL_ERRORS=$((TOTAL_ERRORS + 1))
      RECOMMENDATIONS+=("Split \"$branch_name\" in $filename ($leaf_count leaves)")
    elif [[ "$leaf_count" -ge 30 ]]; then
      echo -e "  ${YELLOW}  ⚠ $branch_name: $leaf_count leaves (nearing limit)${NC}"
      TOTAL_WARNINGS=$((TOTAL_WARNINGS + 1))
      if $VERBOSE; then
        RECOMMENDATIONS+=("Review \"$branch_name\" in $filename ($leaf_count leaves)")
      fi
    elif $VERBOSE; then
      echo -e "  ${GREEN}  ✓ $branch_name: $leaf_count leaves${NC}"
    fi
  done < <(grep '^## ' "$root_file" | grep -v '/')  # exclude sub-branches

  if [[ -n "$LARGEST_BRANCH" ]]; then
    echo -e "  Largest: \"$LARGEST_BRANCH\" ($LARGEST_COUNT leaves)"
  fi

  # Check for missing bkz: cross-references
  bkz_count=$(grep -c 'bkz:' "$root_file" 2>/dev/null || echo 0)
  echo -e "  Cross-refs: $bkz_count"

  echo ""
done

# ── Check for stale entries ────────────────────────────────────────
echo -e "${BOLD}🔍 Stale Entry Check (>${STALE_MONTHS} months)${NC}"
cutoff_date=$(date -j -v-${STALE_MONTHS}m '+%d.%m.%Y' 2>/dev/null || date -d "-${STALE_MONTHS} months" '+%d.%m.%Y' 2>/dev/null || echo "unknown")
info "Cutoff: entries before $cutoff_date"

STALE_COUNT=0
for root_file in "${ROOT_FILES[@]}"; do
  # Find date patterns like **DD.MM.YYYY
  while IFS= read -r line; do
    # Extract date from pattern **DD.MM.YYYY
    entry_date=$(echo "$line" | grep -o '\*\*[0-9]\{2\}\.[0-9]\{2\}\.[0-9]\{4\}' | tr -d '*' || true)
    if [[ -n "$entry_date" ]]; then
      # Simple comparison (not perfect but catches obvious stale entries)
      entry_year="${entry_date:6:4}"
      entry_month="${entry_date:3:2}"
      current_year=$(date '+%Y')
      current_month=$(date '+%m')
      years_ago=$((current_year - entry_year))
      months_ago=$((years_ago * 12 + (10#$current_month - 10#$entry_month)))
      if [[ "$months_ago" -gt "$STALE_MONTHS" ]]; then
        if $VERBOSE; then
          echo -e "  ${YELLOW}⚠ $entry_date: $(basename "$root_file")${NC}"
        fi
        STALE_COUNT=$((STALE_COUNT + 1))
      fi
    fi
  done < <(grep '\*\*[0-9]\{2\}\.[0-9]\{2\}\.[0-9]\{4\}' "$root_file" 2>/dev/null || true)
done

if [[ "$STALE_COUNT" -gt 0 ]]; then
  echo -e "  ${YELLOW}⚠ $STALE_COUNT potentially stale entries found${NC}"
else
  ok "No stale entries detected"
fi

echo ""

# ── Summary ────────────────────────────────────────────────────────
echo -e "${BOLD}📋 Summary${NC}"
echo -e "  Roots scanned: ${#ROOT_FILES[@]}"
echo -e "  Warnings: $(health_color "$TOTAL_WARNINGS" 1 5)"
echo -e "  Errors:   $(health_color "$TOTAL_ERRORS" 1 3)"

if [[ ${#RECOMMENDATIONS[@]} -gt 0 ]]; then
  echo ""
  echo -e "${BOLD}💡 Recommendations${NC}"
  for rec in "${RECOMMENDATIONS[@]}"; do
    echo -e "  • $rec"
  done
fi

echo ""
if [[ "$TOTAL_ERRORS" -eq 0 && "$TOTAL_WARNINGS" -eq 0 ]]; then
  ok "Memory tree is healthy! 🌳"
elif [[ "$TOTAL_ERRORS" -eq 0 ]]; then
  echo -e "${YELLOW}Minor warnings — review recommended.${NC} 🌳"
else
  echo -e "${RED}Action needed — errors must be resolved.${NC} 🌳"
fi
echo ""
