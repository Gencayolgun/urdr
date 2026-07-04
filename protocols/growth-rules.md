# Urðr Growth Rules — Memory Tree Maintenance

> **Purpose:** Defines when and how the Urðr memory tree should grow, split, and reorganize. A memory system that never prunes becomes a junk drawer. A system that prunes too aggressively loses historical context.
>
> **Scope:** Branch splitting, root creation, deprecation, and periodic audit procedures.

---

## 1. Growth Philosophy

The Urðr memory tree is designed to grow **organically but deliberately** — like a real tree. Branches extend when there's new information. They split when they get too heavy. Old branches don't die; they become part of the trunk.

**Three watchwords:** *Disciplined growth. Regular pruning. Never delete.*

---

## 2. Branch-Level Rules

### 2.1 When to Create a New Branch

| Condition | Action |
|-----------|--------|
| New topic doesn't fit existing branches | Create `## New Branch` in the correct root |
| Existing branch heading is misleading | Rename or split |
| A topic becomes its own category (3+ related leaves) | Promote to dedicated branch |

### 2.2 When to Split a Branch

| Threshold | Action |
|-----------|--------|
| Branch reaches **30 leaves** | Review — consider splitting if topics are diverse |
| Branch reaches **50 leaves** | **Must split** — create sub-branches |
| Branch covers 3+ distinct sub-topics | Split into sub-branches regardless of leaf count |

### 2.3 How to Split

```
Original: ## Projects
           - leaf 1 (Web App)
           - leaf 2 (Mobile App)
           - leaf 3 (CLI Tool)
           - leaf 4 (Web App)
           - leaf 5 (Mobile App)
           ...

After split:
## Projects / Web App
## Projects / Mobile App
## Projects / CLI Tools
## Projects (retained for cross-project notes only)
```

**Rules:**
- Keep the original branch for **cross-cutting notes** that don't fit sub-branches
- Move each leaf to its correct sub-branch
- Add a note at the top of the original branch: *"See sub-branches below for detailed entries"*
- NEVER delete the original heading — it becomes the container for general notes

---

## 3. Root-Level Rules

### 3.1 When to Create a New Root

| Condition | Action |
|-----------|--------|
| A root reaches **9+ branches** | Create a new root file |
| A domain becomes distinct enough to separate (e.g., "Design" splits from "Technical") | Create new root |
| Cross-reference density between two domains is low (they don't overlap much) | Consider separating |

### 3.2 How to Create a New Root

```
1. Create new file: root-4-<name>.md
2. Move relevant branches from the source root
3. Update root-0 (index) with new root entry
4. Add bkz: references from source root to new root
5. Update AGENTS.md if the root mapping changes significantly
```

### 3.3 Root Identity Guidelines

| Root | Scope | Typical Branch Count |
|------|-------|---------------------|
| Root-0 | Index only | Fixed (not for content) |
| Root-1 | Broad topics | 5-9 |
| Root-2 | Technical | 5-9 |
| Root-3 | Decisions | 5-9 |
| Root-4+ | New domains | 3-7 (start small) |

---

## 4. Deprecation Rules

### 4.1 What to Deprecate

- Decisions that have been superseded (move from Decision Log → Deprecated)
- Project entries for completed/dead projects (mark as [Archived])
- Technical notes for deprecated systems/versions (add deprecation notice)

### 4.2 What NOT to Deprecate

- **Nothing is ever deleted.** All information has potential historical reference value.
- Old decisions explain why the current state exists — keep them.
- Failed experiments are valuable lessons — keep them.

### 4.3 How to Deprecate

```
**04.07.2026 — [DEPRECATED] Old decision about X**
- Superseded by: [link to new decision]
- Reason: [why it was replaced]
- Historical context preserved for reference
```

---

## 5. Weekly Audit Procedure

Run this every week (or when the tree feels messy):

### 5.1 Check Branch Health

```
For each root file:
  1. Count branches (## headings)
  2. If any root has 9+ branches → flag for splitting
  3. For each branch:
     a. Estimate leaf count
     b. If 30-49 leaves → review for potential split
     c. If 50+ leaves → flag for immediate split
```

### 5.2 Check Cross-Reference Health

```
For each bkz: reference found:
  1. Does the target still exist?
  2. Is the reference still accurate?
  3. If no → update or remove
```

### 5.3 Check Stale Information

```
For entries older than 6 months:
  1. Is the information still accurate?
  2. If outdated → add [STALE] marker and update if possible
  3. If still accurate → add ✓ marker (confirms it's been reviewed)
```

---

## 6. Automated Growth Checking

The `check-growth.sh` script automates the audit:

```bash
# Run from the memory directory
./check-growth.sh

# Output:
# 📊 Urðr Growth Audit — 04.07.2026
# 
# Root-1 (root-1-topics.md):
#   Branches: 7 ✅ (within limit)
#   Largest branch: Projects (43 leaves) ⚠️ nearing split threshold
# 
# Root-2 (root-2-technical.md):
#   Branches: 11 ❌ exceeds 9 — consider splitting
#   Largest branch: APIs (62 leaves) ❌ must split
# 
# Root-3 (root-3-decisions.md):
#   Branches: 4 ✅
#   Largest branch: Decision Log (12 leaves) ✅
# 
# Recommendations:
#   - Split Root-2 into Root-2 (Core) + Root-4 (Web)
#   - Split "APIs" branch into sub-branches
```

---

## 7. Migration Protocol

When restructuring is needed, use `migrate.sh` or follow these steps:

### 7.1 Moving a Branch to a New Root

```
1. Copy branch content from source root
2. Paste into target root
3. Add migration note at original location:
   "**MIGRATED to root-4/design on 04.07.2026 — bkz: <target-path>**"
4. Update root-0 index
5. Update any cross-references pointing to old location
```

### 7.2 Merging Two Branches

```
1. Choose the surviving branch (the one with the better name)
2. Move all leaves from the retired branch into the survivor
3. At the retired branch location:
   "**MERGED into <survivor-branch> on 04.07.2026**"
4. Update root-0 index if needed
```

### 7.3 Rolling Back a Bad Restructure

```
1. Revert to the last git commit
2. Restore the original structure
3. Re-apply changes one by one, verifying after each
```

---

## 8. Quick Reference

```
┌──────────────────────────────────────────────────────────────┐
│                     URDR GROWTH RULES                         │
├──────────────────────────────────────────────────────────────┤
│ BRANCHES:                                                     │
│   30 leaves → review for split                               │
│   50 leaves → MUST split                                     │
│   3+ sub-topics → split regardless of count                  │
│                                                              │
│ ROOTS:                                                        │
│   9+ branches → create new root                              │
│   New domain → create new root                               │
│   Max practical roots: 6                                     │
│                                                              │
│ DEPRECATION:                                                  │
│   NEVER delete anything                                      │
│   Superseded → move to Deprecated branch                     │
│   Outdated → add [STALE] marker                              │
│                                                              │
│ AUDIT (weekly):                                               │
│   1. Count branches per root                                 │
│   2. Check leaf counts                                       │
│   3. Verify cross-references                                 │
│   4. Mark stale entries                                      │
│                                                              │
│ MIGRATION:                                                    │
│   1. Copy content to new location                            │
│   2. Leave MIGRATED note at old location                     │
│   3. Update root-0 index                                     │
│   4. Fix cross-references                                    │
│   5. Commit to git                                           │
└──────────────────────────────────────────────────────────────┘
```

---

*Grow deliberately. Prune carefully. Never forget.* 🌳
