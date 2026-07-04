# Urðr Cross-Cutting Protocol

> **Context:** This document addresses the **cross-cutting (relational / inter-branch)** information problem in the Urðr tree-memory architecture.
>
> **Problem:** Some information naturally belongs to multiple roots (e.g., a technical decision that affects projects, a rule that impacts multiple systems). Where does it go?
>
> **Scope:** Default behavior, when to open a separate branch, pitfalls, and implementation protocol.
>
> **Prerequisite:** Readers should understand the 4-root tree structure from `architecture.md`.

---

## 0. Problem Definition

The basic tree assumption: every piece of information falls into a **single root-branch-leaf** triplet. But some information types naturally span **multiple roots**:

- A technical decision that affects a project timeline (decision in R3, project in R1)
- A rule that impacts multiple systems (rule in R3, systems in R2)
- A decision with both technical AND behavioral consequences (R2 + R3)
- A project spanning multiple technical systems (R1 project + multiple R2 branches)

This "cross-cutting" information strains flat categorization. This document establishes the **placement policy**.

---

## 1. Core Principle — "Single Primary, Multiple bkz:"

The tree structure allows **one primary** residence point. All other connections are **references only**. This rule applies to cross-cutting information as well:

```
PRIMARY (living location)  →  one root-branch-leaf (most executable)
      ↓
bkz: (see also) references →  other relevant roots (single line each)
```

**Purpose:** Information is updated from **one point**. Non-primary roots carry **bridges, not content**. Contradiction and drift do not occur.

---

## 2. Default Behavior — bkz: Reference

**When information belongs to multiple roots:**

```
1. First, choose the "most executable" (most concrete, most actionable) root as PRIMARY.
2. If it spreads across multiple branches in the same root → primary in closest branch, bkz: to others.
3. For other relevant roots → add a single-line "bkz:" reference only.
```

### 2.1 How to Choose the "Most Executable Root"

| Information Type | Primary Root | bkz: Refs |
|-----------------|-------------|-----------|
| Technical decision → project impact | Root-2 (Technical) | Root-1 (Topics), Root-3 (Decisions) |
| Rule affecting multiple systems | Root-3 (Decisions) | Relevant Root-2 branches |
| Decision with technical AND behavioral effects | Root-2 (Technical) | Root-3 (pattern / rationale) |
| Project-specific technical note | Root-1 (Topics) | Root-2 (relevant technical ref) |
| Lesson applying to multiple systems | Root-3 (Decisions) | Relevant Root-1 / Root-2 branches |

**Decision rule:** Concrete beats abstract.
- "How to?" (R2) > "What to?" (R1) > "Why?" (R3)

However, if the information is **rationale-heavy** (the technical/project side is just context, the real value is "why"), Root-3 can be primary. In that case, Root-3 / decision-log is the correct address.

---

## 3. Example Scenario — Multi-Root Information

**Scenario:** User decides to "migrate to Technology X." This decision:
- Has project timeline impact → Root-1 project branch is relevant
- Is a technical decision → Root-2 (Technical)
- Has a rationale that forms a "recurring pattern" → could go to Root-3 / lessons-learned

**Placement result:**

```
Root-2 / Technical Decisions branch (PRIMARY):
  **04.07.2026 — Migration to Technology X.**
  - Rationale, alternatives, rollback plan
  - bkz: Root-1 / <relevant-project>
  - bkz: Root-3 / decision-log

Root-1 / <project-branch>:
  - Technology X integration (bkz: Root-2 / technical-decisions)

Root-3 / decision-log:
  - 04.07.2026 — Technology X decision: project timeline affected
  - bkz: Root-2 / technical-decisions (PRIMARY)
```

**Critical:** Primary content lives in one place. Root-1 and Root-3 entries are **short, bridge-only**. Updates come from Root-2; the others just point.

---

## 4. When to Open a Separate "Cross-Cutting Notes" Branch

**Rule:** Only open a new branch when ALL of the following conditions are met:

1. **Recurring pattern** — This type of cross-cutting information arrives **regularly** (not a one-off).
2. **Structural mismatch** — Doesn't fit into any existing branch (would distort the existing category).
3. **Accumulation signal** — At least **3 leaves** of this type have accumulated, forming critical mass.
4. **Root-3 doesn't cover it** — Existing R3 branches (decision-log, lessons-learned, behavior-patterns) don't accommodate it.

**Justified example:**
- "Every deployment decision has cost + risk + UX dimensions" — if this **3-dimension pattern** repeats for every decision → a "Decision Dimensions" branch can be opened (under Root-3).

**Unjustified example:**
- One-off technical decision for a single project → `bkz:` is sufficient. No new branch.
- A single connection between two decisions → `bkz:` is sufficient.
- A vague "General cross-cutting notes" heading → do NOT open.

---

## 5. Pitfall — The "Cross-Cutting Notes Junk Drawer"

**Risk:** A separate branch becomes a labeled version of the "couldn't categorize this" box. Classic Evernote / OneNote trap.

**Symptoms (stay alert):**
- Branch contains **10+ unrelated topics**
- Entries labeled "cross-cutting" are actually **unrelated to each other**
- "Where does this really belong?" is asked **frequently**
- Branch becomes the **default fallback** for every new piece of information

**Prevention:**
- Before opening, check the 4 conditions in Section 4
- After opening, review branch growth **monthly**
- If branch reaches **30+ leaves** → split into sub-groups
- Every 6 months, ask "is this branch still necessary?" If not, close it and distribute content to primary locations

---

## 6. Implementation Protocol — Decision Tree

```
┌──────────────────────────────────────────────────────────────┐
│ STEP 1: DOES THIS INFO BELONG TO A SINGLE ROOT?              │
│   Yes → place in correct root + branch (done)                 │
│   No (2+ roots seem relevant)  → go to STEP 2                │
│                                                              │
│ STEP 2: SELECT THE MOST EXECUTABLE ROOT                       │
│   Rule: "Concrete beats abstract."                            │
│   - How to? → Root-2                                         │
│   - What to? → Root-1                                        │
│   - Why?    → Root-3 (if rationale is the primary value)      │
│                                                              │
│ STEP 3: WRITE PRIMARY CONTENT + ADD bkz: REFERENCES           │
│   → Full content in selected root-branch                      │
│   → Add bkz: lines to other relevant root-branch paths        │
│                                                              │
│ STEP 4: WRITE SINGLE-LINE bkz: NOTES IN OTHER ROOTS           │
│   → Example: "X integration (bkz: Root-2 / technical-decisions)"│
│   → Keep short — bridge, not content                          │
│                                                              │
│ STEP 5: IS THIS TYPE OF INFO RECURRING?                       │
│   No (one-off) → bkz: is sufficient, don't open branch        │
│   Yes (3+ leaves, structural mismatch, R3 doesn't cover)      │
│     → Section 4 checks passed? → open new branch              │
│     → Section 4 checks failed → keep using bkz:, don't open   │
└──────────────────────────────────────────────────────────────┘
```

**Performance note:** This decision tree should execute in **2-5 seconds**. Over-thinking makes memory placement harder. When in doubt, **write to the most executable root and add bkz:** — fast and slightly wrong beats slow and perfect.

---

## 7. Quick Reference — Single Page Summary

```
Default:            Single root primary, bkz: to others
Decision rule:      "Concrete beats abstract" (R2 → R1 → R3)
Separate branch:    Only for recurring patterns
                    (3+ leaves + structural mismatch + R3 doesn't cover)
Pitfall:            "Couldn't categorize this" junk drawer
Tool:               bkz: (single-line bridge reference)
Discipline:         Branch 30+ leaves → split; 6-month "still needed?" check
```

---

## 8. Root Relocation Protocol (Rare)

When an entry no longer fits its current root (category change, root became full, etc.):

```
1. Remove from old root
2. Place primary content in new root
3. Add "bkz: <new-root>/<new-branch>" note to old location
4. If old root had bkz: refs from other roots, update those too
```

**Frequency:** Should be very rare. If relocation happens often, the initial placement rule is being applied incorrectly — review root selection logic.

---

## 9. Closing Note

This policy maintains the **"everything in one place"** principle even in cross-cutting scenarios. Single primary, no duplication, passive references — together they ensure **consistency**.

**Root-3 is already the relational domain:** Decision-log, lessons-learned, behavior-patterns, and constraints branches are inherently cross-cutting. A new "cross-cutting notes" branch is the **last resort** — for information that doesn't fit these four and is structurally recurring.

As the architecture evolves, so does this policy. But the core principle is fixed:

> **Information lives in one primary root. All other connections are bridges, not content.**

---

*Urðr's roots run deep — and they don't tangle.* 🌳
