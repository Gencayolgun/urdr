# Basic Setup Example

This example shows a minimal Urðr memory tree for a solo developer working on a personal project.

## Scenario

You're building a web application called "TaskFlow" — a task management app. You use Claude Code as your AI coding assistant.

## Step 1: Initialize Memory

```bash
# Clone Urðr
git clone https://github.com/gencay/urdr.git
cd urdr

# Initialize with English templates
./scripts/init.sh --path ~/projects/taskflow/.memory --lang en
```

## Step 2: Configure Your AI Agent

**For Claude Code**, create `.claude/CLAUDE.md` in your project:

```markdown
# CLAUDE.md

This project uses Urðr memory.
See .memory/ for persistent context.

Memory roots:
- .memory/root-0-index.md
- .memory/root-1-topics.md
- .memory/root-2-technical.md
- .memory/root-3-decisions.md

On session start:
1. Check .memory/root-3-decisions.md → ## Pending
2. Check .memory/root-0-index.md for new entries
3. Load .memory/agent-personality.md
```

## Step 3: Add Your First Entries

### root-1-topics.md — Project info

```markdown
## Projects

**04.07.2026 — TaskFlow v1 started.**
- Goal: Personal task management with kanban boards
- Stack: Next.js + SQLite + Tailwind
- Status: In development (backend done, frontend in progress)
```

### root-2-technical.md — Setup notes

```markdown
## Systems

**04.07.2026 — Next.js 15.2.4 installed.**
- Using App Router + server components
- Node v26.4.0, npm 11.x

## Databases

**04.07.2026 — SQLite schema designed.**
- Tables: users, projects, tasks, tags
- ORM: Drizzle ORM
- Migration: drizzle-kit
```

### root-3-decisions.md — Decisions

```markdown
## Decision Log

**04.07.2026 — Chose SQLite over PostgreSQL.**
- Context: Single-user desktop app
- Alternatives: PostgreSQL (overkill, ops burden)
- Decision: SQLite via Drizzle ORM
- Consequences: Simpler deploy; no scaling to multi-user without migration
- Status: Accepted
```

## Step 4: Use Memory in Conversations

**You ask:** "Why did we choose SQLite?"

**Agent reads Root-3 / Decision Log → finds the entry → answers.**

**Agent learns something new:**
"You just installed the `drizzle-kit` push command — I'll save that to Root-2 / Databases."

## Step 5: Weekly Audit

```bash
cd ~/projects/taskflow/.memory
./scripts/check-growth.sh
```

---

This is a minimal setup. As your project grows, your memory tree grows with it — branches split, new roots form, and your AI agent always knows the full context.
