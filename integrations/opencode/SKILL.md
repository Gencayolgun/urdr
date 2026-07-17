# OpenCode Skill: Urðr Memory System

> **Name:** urdr-memory
> **Description:** Loads the Urðr tree-structured memory system for OpenCode agents. Provides persistent, organized, fast-retrieval memory across sessions.
> **Activate when:** Loading memory on session start, saving important information, or retrieving cross-session context.

---

## Files

### Memory Roots (loaded at session start)
- `root-0-index.md` — routing map
- `root-1-topics.md` — people, projects, subjects
- `root-2-technical.md` — systems, APIs, technical refs
- `root-3-decisions.md` — ADRs, constraints, lessons

### Personality
- `agent-personality.md` — agent identity, character, boundaries

### Protocols (loaded on demand)
- `protocols/architecture.md` — tree structure specification
- `protocols/cross-cutting.md` — cross-domain placement rules
- `protocols/growth-rules.md` — when and how to grow/split
- `protocols/hard-error-protocol.md` — error recovery

---

## Session Start Protocol

```yaml
steps:
  - action: read
    path: "{memory_dir}/root-0-index.md"
    purpose: "Understand the routing map"

  - action: read
    path: "{memory_dir}/root-3-decisions.md"
    branch: "## Pending"
    purpose: "Check for pending items"

  - action: read
    path: "{memory_dir}/agent-personality.md"
    purpose: "Adopt the agent persona"

  - action: read
    path: "{protocol_dir}/architecture.md"
    purpose: "Understand memory system rules"
    condition: "if first session or protocol not cached"
```

---

## Memory Operations

### `memory_write(subject, content)`

```yaml
parameters:
  subject: "string — determines root and branch"
  content: "string — the information to store"

logic:
  - step: "Identify subject → which root?"
    mapping:
      - "people/projects/broad topics → Root-1"
      - "technical/systems/installs → Root-2"
      - "decisions/rules/lessons → Root-3"
  - step: "Find or create branch"
    rule: "Scan ## headings. If no match, create new branch."
  - step: "Check cross-cutting"
    rule: "If info spans 2+ roots → single primary + bkz: refs"
  - step: "Write dated leaf"
    format: "**DD.MM.YYYY — Event — Outcome**"
```

### `memory_read(query)`

```yaml
parameters:
  query: "string — what to find"

logic:
  - step: "Identify subject (extract keywords)"
  - step: "Select root (domain mapping above)"
  - step: "Pick branch (scan ## headings)"
  - step: "Read leaf (specific entry)"
  fallback: "node scripts/search.mjs \"<keyword>\" <memory-dir>"
```

---

## OpenCode Configuration

Add to your `opencode.jsonc`:

```jsonc
{
  "memory": {
    "roots": [
      "~/.config/opencode/memory/root-0-index.md",
      "~/.config/opencode/memory/root-1-topics.md",
      "~/.config/opencode/memory/root-2-technical.md",
      "~/.config/opencode/memory/root-3-decisions.md"
    ],
    "personality": "~/.config/opencode/instructions/agent-personality.md",
    "protocols": [
      "~/.config/opencode/protocols/architecture.md",
      "~/.config/opencode/protocols/cross-cutting.md"
    ]
  }
}
```

---

## Maintenance

```yaml
weekly_audit:
  - "Run node scripts/lint.mjs <memory-dir>"
  - "Review and split overgrown branches"
  - "Verify cross-references (bkz: still valid?)"
  - "Mark stale entries [STALE] if > 6 months unverified"

backup:
  - "Daily: git commit -m 'auto: daily memory backup'"
  - "Weekly: git push origin main"
  - "Monthly: verify restore from backup"
```

---

*Urðr remembers, so your OpenCode agent doesn't start from zero every session.* 🌳
