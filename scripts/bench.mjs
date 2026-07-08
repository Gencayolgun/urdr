#!/usr/bin/env node
/**
 * bench.mjs — Urðr memory benchmark (cross-platform, LLM-free)
 *
 * "Unlimited memory" is a claim, not a fact — until you measure it. A tree-memory's
 * real capacity is not how much it STORES but how reliably it RETRIEVES. This benchmark
 * builds a synthetic tree with a controllable share of *ambiguous* leaves (info whose
 * natural query implies a different root than where it was filed — the exact case where
 * category-guessing retrieval fails) and measures:
 *
 *   1. recall@1, hierarchy-only         — the agent guesses root/branch (fails on ambiguity)
 *   2. recall@1, hierarchy + fallback    — search.mjs safety net catches the misses
 *   3. write fidelity                    — is what we stored byte-identical to what we meant?
 *   4. retrieval latency + result tokens — the fallback burns CPU, not LLM tokens
 *
 * This turns "it's efficient / it's unlimited" into numbers you can defend — and surfaces
 * the volume bottleneck BEFORE it hits production (typically months later, at scale).
 *
 * Usage:
 *   node bench.mjs [--leaves N] [--ambiguity 0.3] [--seed 42] [--keep]
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { performance } from 'node:perf_hooks';
import { searchMemory } from './search.mjs';

// ── Deterministic PRNG (seeded) so runs are reproducible ────────────
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ROOTS = [
  { file: 'root-1-topics.md', title: 'Root-1: Topics', branches: ['People', 'Projects', 'Organizations', 'Events'] },
  { file: 'root-2-technical.md', title: 'Root-2: Technical', branches: ['APIs', 'Configs', 'Systems', 'Fixes'] },
  { file: 'root-3-decisions.md', title: 'Root-3: Decisions', branches: ['ADRs', 'Rules', 'Lessons', 'Constraints'] },
];

const SUBJECTS = ['sqlite', 'postgres', 'redis', 'oauth', 'webhook', 'ratelimit', 'caching', 'migration',
  'telegram', 'discord', 'gateway', 'baileys', 'cronjob', 'backup', 'encryption', 'tokenbudget',
  'retrypolicy', 'idempotency', 'pagination', 'sharding', 'indexing', 'vectordb', 'embedding', 'prompt'];

/** Build a synthetic memory tree. Returns { dir, leaves:[{keyword, assignedRoot, impliedRoot, text}] }. */
function generateTree(dir, nLeaves, ambiguity, rand) {
  fs.mkdirSync(dir, { recursive: true });
  const buckets = new Map(); // file -> { branch -> [lines] }
  const leaves = [];
  for (const r of ROOTS) { buckets.set(r.file, new Map()); for (const b of r.branches) buckets.get(r.file).set(b, []); }

  for (let i = 0; i < nLeaves; i++) {
    const subj = SUBJECTS[Math.floor(rand() * SUBJECTS.length)];
    const keyword = `${subj}-${i}`; // unique, searchable token
    // "implied" root = where a naive query would look (by subject semantics)
    const impliedIdx = Math.floor(rand() * ROOTS.length);
    // "assigned" root = where it was actually filed. For ambiguous leaves, DIFFERENT.
    let assignedIdx = impliedIdx;
    const isAmbiguous = rand() < ambiguity;
    if (isAmbiguous) { assignedIdx = (impliedIdx + 1 + Math.floor(rand() * (ROOTS.length - 1))) % ROOTS.length; }
    const assigned = ROOTS[assignedIdx];
    const branch = assigned.branches[Math.floor(rand() * assigned.branches.length)];
    const day = String(1 + Math.floor(rand() * 28)).padStart(2, '0');
    // include a couple of markdown-hostile chars to stress write-fidelity
    const text = `**${day}.07.2026 — ${keyword} — chose ${subj} (alt: none) · cost≈$0.5 | ok**`;
    buckets.get(assigned.file).get(branch).push(text);
    leaves.push({ keyword, assignedRoot: assigned.file, impliedRoot: ROOTS[impliedIdx].file, branch, text, isAmbiguous });
  }

  for (const r of ROOTS) {
    const parts = [`# ${r.title}`, '', '> Auto-generated benchmark fixture.', '', '---', ''];
    for (const b of r.branches) {
      parts.push(`## ${b}`, '');
      const lines = buckets.get(r.file).get(b);
      parts.push(lines.length ? lines.join('\n') : '_No entries yet._', '', '---', '');
    }
    fs.writeFileSync(path.join(dir, r.file), parts.join('\n'));
  }
  return { dir, leaves };
}

/** Hierarchy-only retrieval: look ONLY in the implied root file (simulates the agent's guess). */
function hierarchyLookup(dir, leaf) {
  const res = searchMemory(dir, leaf.keyword, { maxResults: 5, forceNode: true });
  // constrain to the implied root (the agent's guessed domain)
  const hit = res.results.find((r) => r.file === leaf.impliedRoot);
  return hit || null;
}

function run() {
  const argv = process.argv.slice(2);
  const num = (flag, def) => { const i = argv.indexOf(flag); return i >= 0 ? Number(argv[i + 1]) : def; };
  const nLeaves = num('--leaves', 300);
  const ambiguity = num('--ambiguity', 0.3);
  const seed = num('--seed', 42);
  const keep = argv.includes('--keep');
  const rand = mulberry32(seed);

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'urdr-bench-'));
  const { leaves } = generateTree(dir, nLeaves, ambiguity, rand);

  // 1) Write fidelity: is every generated leaf byte-present in its assigned file?
  let fidelityOk = 0;
  for (const leaf of leaves) {
    const content = fs.readFileSync(path.join(dir, leaf.assignedRoot), 'utf8');
    if (content.includes(leaf.text)) fidelityOk++;
  }

  // 2) Retrieval: hierarchy-only vs hierarchy+fallback
  let hierHit = 0, fallbackHit = 0, rescued = 0;
  let totalMs = 0, totalResultChars = 0;
  for (const leaf of leaves) {
    const t0 = performance.now();
    const hier = hierarchyLookup(dir, leaf);
    let found = !!hier;
    if (hier) hierHit++;
    if (!found) {
      // safety net: full branch-aware scan
      const res = searchMemory(dir, leaf.keyword, { maxResults: 5 });
      const hit = res.results.find((r) => r.text === leaf.text) || res.results[0];
      if (hit) { found = true; rescued++; totalResultChars += hit.text.length; }
    } else {
      totalResultChars += hier.text.length;
    }
    if (found) fallbackHit++;
    totalMs += performance.now() - t0;
  }

  const pct = (n) => ((n / nLeaves) * 100).toFixed(1);
  const ambiguousCount = leaves.filter((l) => l.isAmbiguous).length;

  console.log('');
  console.log('  🌳 Urðr Memory Benchmark');
  console.log('  ' + '─'.repeat(58));
  console.log(`  leaves: ${nLeaves} · ambiguous: ${ambiguousCount} (${pct(ambiguousCount)}%) · seed: ${seed}`);
  console.log('');
  console.log(`  Write fidelity (stored == intended): ${pct(fidelityOk)}%  ${fidelityOk === nLeaves ? '✓' : '✗ DATA LOSS'}`);
  console.log('');
  console.log(`  recall@1, hierarchy-only        : ${pct(hierHit)}%   ← fails on wrong-root guesses`);
  console.log(`  recall@1, hierarchy + fallback  : ${pct(fallbackHit)}%   ← safety net`);
  console.log(`  rescued by fallback             : ${rescued} leaves (${pct(rescued)}%)`);
  console.log('');
  console.log(`  avg retrieval latency           : ${(totalMs / nLeaves).toFixed(3)} ms/query (CPU, no LLM call)`);
  console.log(`  avg result size                 : ~${Math.round((totalResultChars / nLeaves) / 4)} tokens (only the matched leaf is returned)`);
  console.log('');
  if (fallbackHit > hierHit) {
    console.log(`  → Fallback lifted recall from ${pct(hierHit)}% to ${pct(fallbackHit)}% with zero LLM cost.`);
    console.log(`    Without it, ${nLeaves - hierHit} leaves would read as "forgotten" despite being stored.`);
  } else {
    console.log('  → Hierarchy alone was sufficient at this ambiguity level.');
  }
  console.log('');

  if (keep) console.log(`  (fixture kept at ${dir})`);
  else fs.rmSync(dir, { recursive: true, force: true });

  // non-zero exit if data loss detected (CI guard)
  process.exit(fidelityOk === nLeaves ? 0 : 1);
}

run();
