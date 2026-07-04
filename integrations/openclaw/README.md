# OpenClaw + Urðr Integration

Maps Urðr's 4-root tree memory onto OpenClaw's bootstrap file system.

## Architecture

```
OpenClaw Workspace (~/.openclaw/workspace/)
│
├── MEMORY.md              ← Urðr Root-1 (topics) + Root-3 (decisions)
├── IDENTITY.md            ← Urðr agent-personality.md
├── AGENTS.md              ← Urðr protocol references
│
├── memory/                ← Urðr root files & daily notes
│   ├── root-0-index.md    ← Urðr index
│   ├── root-1-topics.md   ← Projects, people, subjects
│   ├── root-2-technical.md ← Systems, APIs, technical
│   ├── root-3-decisions.md ← ADRs, constraints, lessons
│   ├── YYYY-MM-DD.md      ← OpenClaw daily notes (standard)
│   └── protocols/         ← Architecture docs (optional)
│       ├── architecture.md
│       └── cross-cutting.md
│
└── HEARTBEAT.md           ← Optional: heartbeat with Urðr audit
```

## Setup

### Option A: Bootstrap Injection (Recommended)

Add to your `~/.openclaw/openclaw.json`:

```jsonc
{
  "agents": {
    "defaults": {
      "bootstrapTotalMaxChars": 80000,
      "bootstrapFiles": {
        // Inject Urðr index at session start
        "memory/root-0-index.md": {
          "priority": 1
        },
        // Agent personality replaces IDENTITY.md
        "memory/agent-personality.md": {
          "priority": 2
        }
      }
    }
  }
}
```

### Option B: Manual File Setup

Copy Urðr templates into your OpenClaw workspace:

```bash
# Clone Urðr once
git clone https://github.com/natureco-official/urdr.git ~/urdr

# Init memory in OpenClaw workspace
cd ~/.openclaw/workspace
~/urdr/scripts/init.sh --path ./memory --lang en --agent-name "Your Agent Name"

# Symlink roots into place (optional)
ln -sf memory/root-1-topics.md MEMORY.md
ln -sf memory/agent-personality.md IDENTITY.md
```

## File Mapping

| Urðr Root | OpenClaw File | Purpose |
|-----------|---------------|---------|
| Root-0 (index) | `memory/root-0-index.md` | Routing map — injected into bootstrap |
| Root-1 (topics) | `MEMORY.md` via symlink or `memory/root-1-topics.md` | Durable facts, projects, people |
| Root-2 (technical) | `memory/root-2-technical.md` | Systems, APIs, configs |
| Root-3 (decisions) | Included in `MEMORY.md` or `memory/root-3-decisions.md` | ADRs, constraints, lessons |
| Personality | `IDENTITY.md` via `memory/agent-personality.md` | Agent name, vibe, character |
| Protocols | `memory/protocols/*.md` | Architecture rules (loaded on demand) |

## Session Protocol

### On Session Start (OpenClaw loads automatically)

1. OpenClaw reads `MEMORY.md` / `root-0-index.md` from bootstrap
2. Agent reads `## Pending` branch in Root-3
3. Agent loads `IDENTITY.md` / `agent-personality.md`

### On "Remember This"

When you ask OpenClaw to remember something:

```
Standard OpenClaw → writes to MEMORY.md or memory/YYYY-MM-DD.md
Urðr-enhanced       → agent routes to correct root file:
                    • Person/project → Root-1
                    • Technical      → Root-2
                    • Decision/rule  → Root-3
```

### Growth Audit (via Heartbeat)

Add to `HEARTBEAT.md`:

```markdown
## Weekly Memory Audit

Run: ./scripts/check-growth.sh ~/.openclaw/workspace/memory/

Check:
- Any root with 9+ branches? → split
- Any branch with 50+ leaves? → subdivide
- Cross-refs still valid?
```

## Caveats

1. OpenClaw's `MEMORY.md` is designed as a **single curated file**. Urðr's 4-root model distributes content — make sure `root-0-index.md` is in the bootstrap to help the agent navigate.
2. OpenClaw's daily notes (`memory/YYYY-MM-DD.md`) remain unchanged — they're the working layer. Urðr roots are the **curated/persistent layer**.
3. If using `memory_search` with embeddings, add root files to the index:

```bash
openclaw memory index --force
```

---

*Urðr roots your OpenClaw agent's memory in structured, persistent soil.* 🌳
