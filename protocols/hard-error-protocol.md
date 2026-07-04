# Urðr Hard Error Protocol

> **Purpose:** When memory goes wrong — contradictory information, missing entries, corrupted files, or agent confusion — this protocol provides step-by-step recovery procedures.
>
> **Scope:** Error types, recovery steps, prevention measures.
>
> **Core principle:** When in doubt, **preserve the information and fix the structure.** Data loss is never acceptable.

---

## 1. Error Classification

| Severity | Type | Example | Response |
|----------|------|---------|----------|
| 🔴 Critical | Data loss | File corrupted, leaves deleted | Stop. Restore from git/backup. |
| 🟠 High | Contradiction | Same fact in 2 places with different values | Identify primary, reconcile, fix. |
| 🟡 Medium | Misplaced | Entry in wrong root or branch | Move to correct location, leave bkz:. |
| 🟢 Low | Overgrown | Branch > 50 leaves | Split branch (standard growth procedure). |
| 🔵 Informational | Stale | Entry > 6 months unverified | Review and mark ✓ or [STALE]. |

---

## 2. 🔴 Critical Recovery — Data Loss

### Symptoms
- File won't parse
- Sections are truncated
- Entire branches missing
- Agent reports "file not found"

### Recovery Steps

```
1. STOP all memory operations immediately
2. Check git status:
   git status
   git log --oneline -5
3. Restore from git:
   git checkout -- <affected-file>
   # OR for full restore:
   git reset --hard <last-known-good-commit>
4. If git history is also corrupted → check:
   ~/.Trash/ (macOS)
   ~/.local/share/Trash/ (Linux)
   backup directory if configured
5. After recovery, run check-growth.sh to verify integrity
6. Add preventive measure: configure automated git commits
```

### If No Backup Exists

```
1. Reconstruct from any remaining fragments
2. Check agent chat history for context
3. Rebuild from scratch using templates
4. Add backup configuration IMMEDIATELY (see Section 6)
```

---

## 3. 🟠 High Recovery — Contradictory Information

### Symptoms
- Same decision recorded differently in two places
- Conflicting technical specifications
- Outdated information that contradicts current state

### Recovery Steps

```
1. Identify all locations where the fact appears
   rg "search-term" /path/to/memory/
2. Determine which is the PRIMARY source:
   - Check dates (most recent typically wins)
   - Check context (was this superseded?)
   - Check the Decision Log in Root-3
3. Reconcile:
   a. Update PRIMARY to the correct value
   b. Add deprecation note to all secondary locations:
      "**DEPRECATED on DD.MM.YYYY — see <primary-location>**"
   c. If the contradiction reveals a new lesson:
      Add entry to Root-3 / Lessons Learned
4. Verify: grep for the old value to ensure no stale references remain
```

### Prevention
- Always use the Single Primary rule (see cross-cutting.md)
- Always date entries
- Always mark superseded decisions as [DEPRECATED]

---

## 4. 🟡 Medium Recovery — Misplaced Information

### Symptoms
- Entry in wrong root (e.g., technical decision in Root-1 instead of Root-2)
- Entry in wrong branch (e.g., project note dumped into "Misc")
- Cross-reference points to non-existent location

### Recovery Steps

```
1. Identify the correct root and branch
2. Move the entry:
   a. Copy content to correct location
   b. At the original location, add:
      "**MOVED to <correct-location> on DD.MM.YYYY — bkz: <path>**"
   c. NEVER delete the original entry — leave a bridge
3. Update any cross-references that pointed to the old location
4. If the error was caused by ambiguous branch names:
   Rename branches for clarity
```

### Prevention
- Keep branch names specific and unambiguous
- When in doubt about placement, ask: "Is this a what/how/why?"
  - What? → Root-1 (Topics)
  - How? → Root-2 (Technical)
  - Why? → Root-3 (Decisions)

---

## 5. 🟢 Low Recovery — Overgrown Branches

### Symptoms
- Branch takes multiple scrolls to read
- Agent struggles to find specific entries
- Branch covers 3+ distinct sub-topics

### Recovery Steps

```
1. Analyze the branch content:
   - How many distinct sub-topics exist?
   - What natural groupings emerge?
2. Create sub-branches:
   ## Parent Branch
   ## Parent Branch / Sub-group A
   ## Parent Branch / Sub-group B
3. Sort entries into sub-branches
4. Keep the parent branch for entries that span all sub-groups
5. Update root-0 index if the change affects discoverability
```

### Prevention
- Monitor branch size during weekly audit
- Split proactively at 30 leaves (don't wait for 50)
- Create sub-branches early when a topic diversifies

---

## 6. 🔵 Informational — Stale Data

### Symptoms
- Entry mentions outdated version numbers
- Decision context no longer applies
- "Pending" item was resolved but never updated

### Recovery Steps

```
1. Mark stale entries:
   "**[STALE — DD.MM.YYYY — needs review]** original content..."
2. If you know the correct information:
   Update the entry and remove the [STALE] marker
3. If unsure:
   Leave [STALE] marker and add to Root-3 / Pending for review
4. After review:
   Update or deprecate, then remove [STALE]
```

### Prevention
- Add a "last reviewed" marker: `✓ DD.MM.YYYY`
- Review entries older than 6 months during weekly audit
- For rapidly changing information (API versions, prices), add TTL notes

---

## 7. Agent Confusion Recovery

### Symptoms
- Agent asks "where should I look for this?" repeatedly
- Agent places new information in wrong locations
- Agent fails to find known information

### Recovery Steps

```
1. Check if the agent loaded the personality and architecture files:
   - Is agent-personality.md in the instructions path?
   - Is AGENTS.md accessible?
2. Re-read the architecture protocol to the agent:
   "Read protocols/architecture.md and summarize the 4 roots"
3. If the agent still struggles:
   - Simplify by adding more explicit hints in root-0 index
   - Add a "Quick Find" table at the top of each root
   - Consider renaming branches for clarity
4. If the problem is session continuity:
   - Ensure memory roots are in the correct path
   - Check that the agent's config points to the right files
```

### Prevention
- Include memory loading in the agent's session-start hook
- Add a `.cursorrules` / `CLAUDE.md` / `SKILL.md` that references Urðr
- Test with a new agent session quarterly to verify discoverability

---

## 8. Backup Configuration

### Recommended Setup

```bash
# Automatic git commits (cron: daily)
0 22 * * * cd ~/.config/opencode/memory && \
  git add -A && \
  git commit -m "auto: daily memory backup $(date +%Y-%m-%d)" || true

# Push to remote (weekly)
0 10 * * 1 cd ~/.config/opencode/memory && git push origin main

# Or use a simple tarball backup
0 0 * * 0 tar -czf ~/backups/memory-$(date +%Y-%m-%d).tar.gz \
  ~/.config/opencode/memory/
```

### What to Backup
- All root files (`root-*.md`)
- Personality files
- Protocol documents (for reference)
- `.git` directory (for version history)

### Recovery Test
- Monthly: verify you can restore from backup
- Test: delete a root file and restore from git
- Document any restoration issues

---

## 9. Emergency Contact

If the memory system is part of a team workflow:

| Role | Contact | When |
|------|---------|------|
| Memory steward | [Name] | Any structural change |
| Backup admin | [Name] | Backup failures |
| All users | [Channel/group] | Major restructuring announcements |

---

## 10. Quick Reference Card

```
┌──────────────────────────────────────────────────────────────┐
│                  URDR HARD ERROR PROTOCOL                      │
├──────────────────────────────────────────────────────────────┤
│ 🔴 DATA LOSS:                                                │
│   Stop → git restore → verify integrity → configure backups  │
│                                                              │
│ 🟠 CONTRADICTION:                                            │
│   Find all copies → identify primary → reconcile → deprecate │
│                                                              │
│ 🟡 MISPLACED:                                                │
│   Find correct location → move → leave bridge → update refs  │
│                                                              │
│ 🟢 OVERGROWN:                                                │
│   Analyze → create sub-branches → sort → update index        │
│                                                              │
│ 🔵 STALE:                                                    │
│   Mark [STALE] → review → update or keep as historical       │
│                                                              │
│ 🤖 AGENT CONFUSION:                                          │
│   Re-read architecture → simplify index → check config       │
│                                                              │
│ 💾 BACKUP (mandatory):                                        │
│   Daily git commits → weekly push → monthly restore test     │
│                                                              │
│ NEVER:                                                        │
│   Delete information. Delete nothing. Ever.                   │
└──────────────────────────────────────────────────────────────┘
```

---

*Errors happen. Data loss is optional. Backup your roots.* 🌳
