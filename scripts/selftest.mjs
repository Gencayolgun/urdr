#!/usr/bin/env node
/**
 * selftest.mjs — Urðr tooling self-test (cross-platform, LLM-free, zero-dependency)
 *
 * Exercises every tool against a temporary fixture and exits non-zero on any failure.
 * Runs identically on macOS, Windows, and Linux — used by CI (3-OS matrix) and locally.
 *
 * Usage:  node scripts/selftest.mjs
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { searchMemory } from './search.mjs';
import { appendLeaf, insertLeaf, resolveConfinedTarget } from './append.mjs';
import { lintTree } from './lint.mjs';
import { parseMarkdown } from './lib/markdown-model.mjs';
import { acquireLeaseLock, assertLeaseOwned, releaseLeaseLock } from './lib/lock.mjs';

let passed = 0, failed = 0;
function ok(cond, msg) {
  if (cond) { passed++; console.log('  ✓ ' + msg); }
  else { failed++; console.log('  ✗ ' + msg); }
}

function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function runChild(command, args) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: 'ignore', windowsHide: true });
    child.on('error', () => resolve(-1));
    child.on('exit', (code) => resolve(code));
  });
}

const root2 = '# Root-2: Technical\n\n---\n\n## APIs\n\n_No entries yet._\n\n---\n\n## Fixes\n\n_No entries yet._\n\n---\n';

function tmpTree() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'urdr-selftest-'));
  fs.writeFileSync(path.join(dir, 'root-2-technical.md'), root2);
  return dir;
}

console.log('\n  🌳 Urðr self-test\n  ' + '─'.repeat(50));

// ── markdown-model.mjs ─────────────────────────────────────────────
{
  const fixture = [
    '# Root',
    '<!-- ordinary prose',
    '## Not a branch',
    'secret comment text',
    '-->',
    '## English',
    '_No entries yet._',
    '## Turkish',
    '_Henüz kayıt yok._',
    '## Rich',
    '<!-- urdr:id:abc123 -->',
    '**01.01.2026 — Entry — outcome**',
    'continuation line',
    '  - nested detail',
    '',
    '- top-level item',
    '  continuation',
    '  - nested item',
    '',
    '| Key | Value |',
    '| --- | --- |',
    '| a | b |',
    '',
    '> quoted line',
    '> continuation',
    '',
    '```md',
    '## Not a branch either',
    '<!-- code, not a comment -->',
    '```',
    '',
  ].join('\r\n');
  const model = parseMarkdown(fixture);
  ok(model.newline === '\r\n', 'parser: preserves CRLF style');
  ok(model.branches.map((b) => b.name).join('|') === 'English|Turkish|Rich', 'parser: headings in comments/fences are not branches');
  ok(model.metadata.length === 1 && model.metadata[0].value === 'id:abc123', 'parser: Urðr metadata comments parsed and preserved');
  ok(!model.leaves.some((leaf) => /secret comment text/.test(leaf.text)), 'parser: full multiline prose comments ignored');
  ok(model.branches[0].leaves.length === 0 && model.branches[1].leaves.length === 0, 'parser: English and Turkish placeholders are empty branches');
  const rich = model.branches[2].leaves;
  ok(rich.length === 5, 'parser: real entry/list/table/blockquote/fence boundaries');
  ok(rich[0].kind === 'entry' && /nested detail/.test(rich[0].text), 'parser: multiline entry keeps continuation and nested content');
  ok(rich[1].kind === 'list-item' && /nested item/.test(rich[1].text), 'parser: nested list stays in its parent leaf');
  ok(rich[2].kind === 'table' && rich[3].kind === 'blockquote' && rich[4].kind === 'code-fence', 'parser: table, blockquote, and fenced code are leaf units');
  ok(/<!-- code, not a comment -->/.test(rich[4].text), 'parser: fenced code content is preserved');
}

// ── append.mjs ──────────────────────────────────────────────────────
{
  const dir = tmpTree();
  appendLeaf(dir, 'root-2-technical.md', 'APIs', '**01.01.2026 — sqlite — chose SQLite**');
  let c = fs.readFileSync(path.join(dir, 'root-2-technical.md'), 'utf8');
  ok(c.includes('SQLite'), 'append: leaf written');
  ok(!/## APIs[\s\S]*?_No entries yet\._/.test(c.split('## Fixes')[0]), 'append: placeholder replaced in APIs');
  appendLeaf(dir, 'root-2-technical.md', 'APIs', '**02.02.2026 — redis — chose Redis**');
  c = fs.readFileSync(path.join(dir, 'root-2-technical.md'), 'utf8');
  ok(c.includes('SQLite') && c.includes('Redis'), 'append: append-only (keeps siblings)');
  ok((c.match(/^## APIs/gm) || []).length === 1, 'append: file structure intact');
  // wrong branch → throws
  let threw = false;
  try { appendLeaf(dir, 'root-2-technical.md', 'NoSuchBranch', 'x'); } catch { threw = true; }
  ok(threw, 'append: unknown branch rejected');
  fs.rmSync(dir, { recursive: true, force: true });
}

{
  const dir = tmpTree();
  const appendScript = fileURLToPath(new URL('./append.mjs', import.meta.url));
  const writers = Array.from({ length: 6 }, (_, index) => runChild(process.execPath, [appendScript, dir,
    'root-2-technical.md', 'APIs', `**01.01.2026 — concurrent-${index} — retained**`]));
  const statuses = await Promise.all(writers);
  const content = fs.readFileSync(path.join(dir, 'root-2-technical.md'), 'utf8');
  ok(statuses.every((status) => status === 0) && writers.every((_, index) => content.includes(`concurrent-${index}`)),
    'append: concurrent processes retain every leaf');
  fs.rmSync(dir, { recursive: true, force: true });
}

// ── insertLeaf (pure) ───────────────────────────────────────────────
{
  const out = insertLeaf(root2, 'Fixes', '**03.03.2026 — bugfix — patched**');
  ok(out.includes('patched') && out.split('## Fixes')[1].includes('patched'), 'insertLeaf: places under correct branch');
}

// ── append validation and durability ────────────────────────────────
{
  const prose = insertLeaf(root2, 'APIs', '**01.01.2026 — note — prose may contain ## literally**');
  ok(prose.includes('## literally'), 'append: legitimate ## prose is accepted');
  const fenced = insertLeaf(root2, 'APIs', '```md\n## code heading\n```');
  ok(fenced.includes('## code heading'), 'append: heading syntax inside a fence is accepted');
  let headingRejected = false;
  try { insertLeaf(root2, 'APIs', '## Injected branch\ntext'); } catch { headingRejected = true; }
  ok(headingRejected, 'append: actual Markdown heading injection rejected');

  const dir = tmpTree();
  let traversalRejected = false;
  try { resolveConfinedTarget(dir, '../root-2-technical.md'); } catch { traversalRejected = true; }
  ok(traversalRejected, 'append: parent path traversal rejected');
  let absoluteRejected = false;
  try { resolveConfinedTarget(dir, path.join(dir, 'root-2-technical.md')); } catch { absoluteRejected = true; }
  ok(absoluteRejected, 'append: absolute root path rejected');

  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'urdr-selftest-outside-'));
  fs.writeFileSync(path.join(outside, 'escaped.md'), root2);
  let symlinkRejected = false;
  let symlinkSupported = true;
  try {
    fs.symlinkSync(outside, path.join(dir, 'escape'), process.platform === 'win32' ? 'junction' : 'dir');
    try { resolveConfinedTarget(dir, path.join('escape', 'escaped.md')); } catch { symlinkRejected = true; }
  } catch { symlinkSupported = false; }
  ok(!symlinkSupported || symlinkRejected, 'append: realpath confinement rejects symlink/junction escape');
  fs.rmSync(dir, { recursive: true, force: true });
  fs.rmSync(outside, { recursive: true, force: true });
}

{
  for (const stage of ['before-fsync', 'before-rename', 'after-rename', 'before-directory-fsync']) {
    const dir = tmpTree();
    const target = path.join(dir, 'root-2-technical.md');
    let injected = false;
    try { appendLeaf(dir, 'root-2-technical.md', 'APIs', `**01.01.2026 — ${stage} — test**`, { faultAt: stage }); }
    catch (error) { injected = error.message === `fault injection: ${stage}`; }
    const content = fs.readFileSync(target, 'utf8');
    const changed = content.includes(stage);
    ok(injected, `atomic write: ${stage} fault hook fires`);
    ok(stage === 'before-fsync' || stage === 'before-rename' ? !changed : changed, `atomic write: ${stage} has the expected commit boundary`);
    ok(!fs.readdirSync(dir).some((name) => name.includes('.tmp-')), `atomic write: ${stage} cleans temporary files`);
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// ── independent lease keeper ────────────────────────────────────────
{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'urdr-selftest-lock-'));
  const lockDir = path.join(dir, 'writer.lock');
  const first = acquireLeaseLock(lockDir, { timeoutMs: 2000, staleMs: 180, updateMs: 40 });
  sleepSync(360);
  ok(assertLeaseOwned(first), 'lock: subprocess renews while writer event loop is blocked');
  let contended = false;
  try { acquireLeaseLock(lockDir, { timeoutMs: 120, staleMs: 180, updateMs: 40 }); }
  catch (error) { contended = /lock timeout/.test(error.message); }
  ok(contended, 'lock: active owner cannot be stolen');
  releaseLeaseLock(first);

  const abandoned = acquireLeaseLock(lockDir, { timeoutMs: 2000, staleMs: 120, updateMs: 30 });
  process.kill(abandoned.pid);
  sleepSync(220);
  let renewalFailureDetected = false;
  try { assertLeaseOwned(abandoned); } catch (error) { renewalFailureDetected = /keeper stopped|renewal failed/.test(error.message); }
  ok(renewalFailureDetected, 'lock: writer detects lease-keeper renewal failure');
  const successor = acquireLeaseLock(lockDir, { timeoutMs: 2000, staleMs: 120, updateMs: 30 });
  ok(assertLeaseOwned(successor), 'lock: stale lease is recovered after renewal failure');
  releaseLeaseLock(abandoned);
  ok(assertLeaseOwned(successor), 'lock: former owner cannot release successor lease');
  releaseLeaseLock(successor);
  fs.rmSync(dir, { recursive: true, force: true });
}

// ── search.mjs ──────────────────────────────────────────────────────
{
  const dir = tmpTree();
  appendLeaf(dir, 'root-2-technical.md', 'APIs', '**01.01.2026 — sqlite — chose SQLite for storage**');
  appendLeaf(dir, 'root-2-technical.md', 'Fixes', '**02.02.2026 — oauth — fixed refresh loop**');
  const hit = searchMemory(dir, 'oauth');
  ok(hit.count === 1, 'search: finds the leaf');
  ok(hit.results[0].branch === 'Fixes', 'search: branch-aware result');
  ok(searchMemory(dir, 'kubernetes').count === 0, 'search: miss returns empty');
  ok(searchMemory(dir, '').error != null, 'search: empty query guarded');
  fs.writeFileSync(path.join(dir, 'root-2-technical.md'), root2.replace('_No entries yet._',
    '<!-- hidden\ncomment-only-key\n-->\n\n```md\n## fake\ncode-only-key\n```'));
  ok(searchMemory(dir, 'comment-only-key').count === 0, 'search: ordinary multiline comments are ignored');
  const codeHit = searchMemory(dir, 'code-only-key');
  ok(codeHit.count === 1 && codeHit.results[0].branch === 'APIs', 'search: fenced code is searchable without creating a fake branch');
  fs.rmSync(dir, { recursive: true, force: true });
}

// ── lint.mjs ────────────────────────────────────────────────────────
{
  const clean = tmpTree();
  appendLeaf(clean, 'root-2-technical.md', 'APIs', '**01.01.2026 — note — a unique fact about storage**');
  const lc = lintTree(clean);
  ok(lc.findings.filter((f) => f.level === 'error').length === 0, 'lint: clean tree has no errors');
  fs.rmSync(clean, { recursive: true, force: true });

  const turkish = fs.mkdtempSync(path.join(os.tmpdir(), 'urdr-selftest-tr-'));
  fs.writeFileSync(path.join(turkish, 'kök-2-teknik.md'), '# Kök-2\n\n## Sistemler\n\n_Henüz kayıt yok._\n');
  ok(lintTree(turkish).findings.length === 0, 'lint: Turkish placeholder creates no false leaf warnings');
  fs.rmSync(turkish, { recursive: true, force: true });

  const bad = fs.mkdtempSync(path.join(os.tmpdir(), 'urdr-selftest-bad-'));
  // broken bkz + near-duplicate
  fs.writeFileSync(path.join(bad, 'root-3-decisions.md'),
    '# Root-3: Decisions\n\n## Rules\n\n**01.01.2026 — rule — see also bkz: root-9-ghost (Missing)**\n' +
    '**02.02.2026 — never store plaintext secrets in the repo ever**\n' +
    '**03.03.2026 — never store plaintext secrets in the repo ever**\n');
  const lb = lintTree(bad);
  ok(lb.findings.some((f) => f.code === 'broken-ref'), 'lint: catches broken bkz: ref');
  ok(lb.findings.some((f) => f.code === 'duplication'), 'lint: catches near-duplicate');
  fs.rmSync(bad, { recursive: true, force: true });
}

// ── write fidelity (bench core) ─────────────────────────────────────
{
  const dir = tmpTree();
  const leaf = '**04.07.2026 — çğıöşü-fidelity — unicode + **bold** | pipe · dash**';
  appendLeaf(dir, 'root-2-technical.md', 'APIs', leaf);
  const c = fs.readFileSync(path.join(dir, 'root-2-technical.md'), 'utf8');
  ok(c.includes(leaf), 'fidelity: stored == intended (unicode + markdown-hostile chars)');
  fs.rmSync(dir, { recursive: true, force: true });
}

console.log('\n  ' + '─'.repeat(50));
console.log(`  ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
