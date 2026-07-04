#!/usr/bin/env bash
#
# migrate.sh — Urðr Memory Migration Tool
#
# Usage:
#   ./migrate.sh split <root-file> <branch>         # Split a branch into sub-branches
#   ./migrate.sh move <source> <target> <entries>   # Move entries between branches
#   ./migrate.sh merge <target> <source>             # Merge source branch into target
#   ./migrate.sh new-root <name> <source-root> <branches>  # Create new root
#   ./migrate.sh audit-then-fix                     # Run check-growth then auto-fix
#
# Description:
#   Helps restructure Urðr memory trees when branches grow too large
#   or when information needs to be reorganized.
#

set -euo pipefail

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

# ── Help ───────────────────────────────────────────────────────────
show_help() {
  echo "Usage: ./migrate.sh <command> [options]"
  echo ""
  echo "Commands:"
  echo "  split <file> <branch>            Split a branch into sub-branches"
  echo "  move <source> <target> <entries> Move entries between branches"
  echo "  merge <target> <source>          Merge source branch into target"
  echo "  new-root <name> <from> <branches> Create a new root from existing branches"
  echo "  audit-then-fix                   Run growth audit and auto-fix"
  echo ""
  echo "Examples:"
  echo "  ./migrate.sh split root-1-topics.md '## Projects'"
  echo "  ./migrate.sh merge '## Projects / Web' '## Projects / Web App'"
  echo "  ./migrate.sh new-root design root-2-technical '## CSS,## Design Tokens'"
  echo "  ./migrate.sh audit-then-fix"
  exit 0
}

if [[ $# -eq 0 || "$1" == "--help" || "$1" == "-h" ]]; then
  show_help
fi

COMMAND="$1"
shift

# ── Command: split ─────────────────────────────────────────────────
split_branch() {
  local file="$1"
  local branch="$2"

  if [[ ! -f "$file" ]]; then
    error "File not found: $file"
    exit 1
  fi

  # Check if branch exists
  if ! grep -q "^$branch$" "$file"; then
    error "Branch not found: $branch in $file"
    exit 1
  fi

  echo -e "${BOLD}🌿 Splitting branch: $branch${NC}"
  echo "  File: $file"
  echo ""

  # Find sub-topics in the branch
  echo -e "${YELLOW}Scanning branch content for sub-topics...${NC}"
  echo ""

  # Extract the branch content between this branch and the next ##
  awk -v branch="$branch" '
    $0 ~ branch {found=1; next}
    /^## / && found {exit}
    found {print}
  ' "$file" | sort | uniq -c | sort -rn | head -20

  echo ""
  echo "Enter sub-branch names (one per line, empty line to finish):"
  SUB_BRANCHES=()
  while true; do
    read -rp "  Sub-branch name: " sub
    [[ -z "$sub" ]] && break
    SUB_BRANCHES+=("$sub")
  done

  if [[ ${#SUB_BRANCHES[@]} -eq 0 ]]; then
    warn "No sub-branches specified. Aborting."
    exit 0
  fi

  # Backup the file
  cp "$file" "$file.bak"
  ok "Backup created: $file.bak"

  # Insert sub-branches after the parent branch
  local insert_line
  insert_line=$(grep -n "^$branch$" "$file" | head -1 | cut -d: -f1)

  # Build insertion content
  local insert_content=""
  for sub in "${SUB_BRANCHES[@]}"; do
    # Check if already has leading ##
    if [[ "$sub" == "## "* ]]; then
      insert_content="${insert_content}${sub}\n\n_No entries yet._\n\n"
    else
      insert_content="${insert_content}## ${branch} / ${sub}\n\n_No entries yet._\n\n"
    fi
  done

  # Add migration note
  local date_marker
  date_marker=$(date '+%d.%m.%Y')
  insert_content="${insert_content}<!-- Migrated into sub-branches on ${date_marker} -->\n\n"

  # Insert after the branch line
  sed -i '' "${insert_line}a\\
${insert_content}" "$file"

  ok "Sub-branches created under $branch"
  ok "Please review $file and move existing entries to appropriate sub-branches."
  ok "Backup available at $file.bak"
}

# ── Command: move ──────────────────────────────────────────────────
move_entries() {
  local source="$1"
  local target="$2"
  shift 2
  local entries=("$@")

  if [[ ! -f "$source" ]]; then
    error "Source file not found: $source"
    exit 1
  fi

  if [[ ! -f "$target" ]]; then
    error "Target file not found: $target"
    exit 1
  fi

  echo -e "${BOLD}📦 Moving entries${NC}"
  echo "  From: $source"
  echo "  To:   $target"
  echo ""

  local date_marker
  date_marker=$(date '+%d.%m.%Y')

  for entry in "${entries[@]}";  do
    # Check if entry exists in source
    if grep -qF "$entry" "$source"; then
      # Copy to target (append)
      grep -F "$entry" "$source" >> "$target"
      # Remove from source (replace with migration note)
      sed -i '' "s/.*$entry.*/**MOVED to $(basename $target) on ${date_marker} — bkz: $(basename $target)**/" "$source"
      ok "Moved: $entry"
    else
      warn "Entry not found in source: $entry"
    fi
  done

  ok "Move complete. Review both files for accuracy."
}

# ── Command: merge ─────────────────────────────────────────────────
merge_branches() {
  local target="$1"
  local source="$2"

  # This is a simplified merge — real merge needs manual review
  warn "Merge requires manual review. This tool prepares the merge."
  echo ""
  echo -e "${BOLD}🔗 Preparing merge${NC}"
  echo "  Target: $target"
  echo "  Source: $source"
  echo ""

  # For now, just add a merge note
  local date_marker
  date_marker=$(date '+%d.%m.%Y')

  echo "To merge:"
  echo "  1. Copy entries from $source into $target"
  echo "  2. Add merge note to $source:"
  echo "     **MERGED into $target on ${date_marker}**"
  echo "  3. Resolve any duplicate entries"
  echo ""
  echo "This cannot be fully automated — context matters."
}

# ── Command: new-root ──────────────────────────────────────────────
new_root() {
  local name="$1"
  local source_root="$2"
  local branches="$3"

  if [[ -z "$name" || -z "$source_root" || -z "$branches" ]]; then
    error "Usage: ./migrate.sh new-root <name> <source-root> <branches>"
    error "Example: ./migrate.sh new-root design root-2-technical '## CSS,## Design Tokens'"
    exit 1
  fi

  if [[ ! -f "$source_root" ]]; then
    error "Source root not found: $source_root"
    exit 1
  fi

  local new_file="root-${name}.md"
  if [[ -f "$new_file" ]]; then
    error "Target file already exists: $new_file"
    exit 1
  fi

  echo -e "${BOLD}🌱 Creating new root: $new_file${NC}"
  echo "  Source: $source_root"
  echo "  Branches: $branches"
  echo ""

  local date_marker
  date_marker=$(date '+%d.%m.%Y')

  # Create new root file
  cat > "$new_file" << EOF
# Root-${name^}: ${name^}

> **Purpose:** [Describe the purpose of this root]
> **Created:** ${date_marker} (migrated from ${source_root})
> **Update:** [When to update this root]

---

EOF

  # Copy branches from source
  IFS=',' read -ra BRANCH_LIST <<< "$branches"
  for branch in "${BRANCH_LIST[@]}"; do
    branch=$(echo "$branch" | xargs)  # trim
    # Extract content from source
    awk -v branch="$branch" '
      $0 ~ "^"branch"$" {found=1; print; next}
      /^## / && found && $0 !~ /^## .*\/.*/ {exit}
      found {print}
    ' "$source_root" >> "$new_file"

    # Add migration note to source
    sed -i '' "/^${branch}$/a\\
**MIGRATED to ${new_file} on ${date_marker} — bkz: ${new_file}**" "$source_root"

    ok "Migrated branch: $branch"
  done

  # Add new root marker to root-0-index.md
  local index_file="root-0-index.md"
  if [[ -f "$index_file" ]]; then
    echo "" >> "$index_file"
    echo "### Added: ${date_marker}" >> "$index_file"
    echo "- **Root-${name^}** — \`${new_file}\` — [purpose]" >> "$index_file"
    ok "Added reference to $index_file (please update the purpose text)"
  fi

  ok "New root created: $new_file"
  echo ""
  echo "Next steps:"
  echo "  1. Update the purpose description in $new_file"
  echo "  2. Update root-0-index.md with accurate description"
  echo "  3. Update any cross-references that point to the migrated branches"
}

# ── Command: audit-then-fix ───────────────────────────────────────
audit_then_fix() {
  echo -e "${BOLD}🔍 Running growth audit...${NC}"
  echo ""

  # Run the audit script
  "$(dirname "$0")/check-growth.sh" --verbose

  echo ""
  echo -e "${YELLOW}Auto-fix not yet implemented. Manual review required.${NC}"
  echo "Recommended actions:"
  echo "  ./migrate.sh split <file> '<branch>'   # Split overgrown branches"
  echo "  ./migrate.sh merge <target> <source>    # Merge related branches"
  echo "  ./migrate.sh new-root <name> <from> <branches>  # Create new root"
}

# ── Route commands ─────────────────────────────────────────────────
case "$COMMAND" in
  split)
    if [[ $# -lt 2 ]]; then
      error "Usage: ./migrate.sh split <file> '<branch>'"
      exit 1
    fi
    split_branch "$1" "$2"
    ;;
  move)
    if [[ $# -lt 3 ]]; then
      error "Usage: ./migrate.sh move <source> <target> <entry1> [entry2 ...]"
      exit 1
    fi
    move_entries "$@"
    ;;
  merge)
    if [[ $# -lt 2 ]]; then
      error "Usage: ./migrate.sh merge <target> <source>"
      exit 1
    fi
    merge_branches "$1" "$2"
    ;;
  new-root)
    if [[ $# -lt 3 ]]; then
      error "Usage: ./migrate.sh new-root <name> <source-root> '<branch1,branch2>'"
      exit 1
    fi
    new_root "$1" "$2" "$3"
    ;;
  audit-then-fix)
    audit_then_fix
    ;;
  *)
    error "Unknown command: $COMMAND"
    echo ""
    show_help
    ;;
esac
