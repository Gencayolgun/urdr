#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { importMarkdown } from './lib/transaction.mjs';
import { checkDocumentation } from './lib/doc-check.mjs';
import { lintTree, validateTargetBranch } from './lint.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
let passed = 0;
function test(name, body) { body(); passed++; console.log(`  ✓ ${name}`); }
function temp() { return fs.mkdtempSync(path.join(os.tmpdir(), 'urdr-rock3-')); }
function write(dir, file, body) { fs.writeFileSync(path.join(dir, file), body); }

test('stable-ID graph detects a two-hop bkz chain', () => {
  const dir = temp();
  write(dir, 'root-1-topics.md', '# Root-1\n\n## Projects\n\n- project bridge (bkz: Root-2 / APIs)\n');
  write(dir, 'root-2-technical.md', '# Root-2\n\n## APIs\n\n- API bridge (bkz: Root-3 / Decisions)\n');
  write(dir, 'root-3-decisions.md', '# Root-3\n\n## Decisions\n\n- canonical decision\n');
  importMarkdown(dir);
  assert.ok(lintTree(dir).findings.some((finding) => finding.code === 'reference-chain'));
  fs.rmSync(dir, { recursive: true, force: true });
});

test('token index finds cross-root duplicates and excludes bkz leaves', () => {
  const dir = temp();
  const phrase = 'never store plaintext secrets inside source repositories';
  write(dir, 'root-1-topics.md', `# Root-1\n\n## Projects\n\n- ${phrase}\n`);
  write(dir, 'root-2-technical.md', `# Root-2\n\n## Security\n\n- ${phrase}\n`);
  write(dir, 'root-3-decisions.md', `# Root-3\n\n## Rules\n\n- ${phrase} (bkz: Root-2 / Security)\n`);
  const duplicate = lintTree(dir).findings.filter((finding) => finding.code === 'duplication');
  assert.equal(duplicate.length, 1);
  assert.match(duplicate[0].msg, /root-1-topics.*root-2-technical/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('growth thresholds trigger at 9, 30, and 50 exactly', () => {
  const dir = temp();
  const branches = Array.from({ length: 9 }, (_, i) => `## B${i}\n\n- leaf ${i}`).join('\n\n');
  write(dir, 'root-1-topics.md', `# Root-1\n\n${branches}\n`);
  const warnLeaves = Array.from({ length: 30 }, (_, i) => `- warning leaf ${i}`).join('\n');
  write(dir, 'root-2-technical.md', `# Root-2\n\n## Many\n\n${warnLeaves}\n`);
  const errorLeaves = Array.from({ length: 50 }, (_, i) => `- error leaf ${i}`).join('\n');
  write(dir, 'root-3-decisions.md', `# Root-3\n\n## Too Many\n\n${errorLeaves}\n`);
  const findings = lintTree(dir).findings;
  assert.ok(findings.some((f) => f.code === 'root-branches'));
  assert.ok(findings.some((f) => f.code === 'branch-leaves' && f.level === 'warn'));
  assert.ok(findings.some((f) => f.code === 'branch-leaves' && f.level === 'error'));
  fs.rmSync(dir, { recursive: true, force: true });
});

test('migration target validation rejects a missing branch', () => {
  const dir = temp();
  write(dir, 'root-2-technical.md', '# Root-2\n\n## APIs\n\n- item\n');
  assert.equal(validateTargetBranch(dir, 'root-2-technical.md', 'APIs').name, 'APIs');
  assert.throws(() => validateTargetBranch(dir, 'root-2-technical.md', 'Missing'), /does not exist/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('--fail-on-warn matches the golden warning policy', () => {
  const dir = temp();
  const phrase = 'persistent unique policy words shared between roots';
  write(dir, 'root-1-topics.md', `# Root-1\n\n## A\n\n- ${phrase}\n`);
  write(dir, 'root-2-technical.md', `# Root-2\n\n## B\n\n- ${phrase}\n`);
  const run = spawnSync(process.execPath, [path.join(here, 'lint.mjs'), dir, '--json', '--fail-on-warn'], { encoding: 'utf8' });
  const output = JSON.parse(run.stdout);
  const actual = { errors: output.errors, warnings: output.warnings, codes: output.findings.map((finding) => finding.code) };
  const golden = JSON.parse(fs.readFileSync(path.join(here, 'fixtures', 'lint-warning-golden.json'), 'utf8'));
  assert.equal(run.status, 1);
  assert.deepEqual(actual, golden);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('documentation checker detects a broken local link', () => {
  const dir = temp();
  write(dir, 'README.md', '[missing](docs/not-there.md)\n');
  assert.deepEqual(checkDocumentation(dir).map((finding) => finding.code), ['missing-doc-target']);
  fs.rmSync(dir, { recursive: true, force: true });
});

console.log(`\n  ${passed} Rock 3 tests passed`);
