import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MARKDOWN_LINK_RE = /\[[^\]]*\]\((?!https?:|mailto:|#)([^)\s]+)(?:\s+"[^"]*")?\)/g;
const TOOL_PATH_RE = /`((?:scripts|protocols|examples|integrations)\/[A-Za-z0-9._/-]+)`/g;

function markdownFiles(root) {
  const result = [];
  const visit = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === '.urdr') continue;
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) visit(file);
      else if (/\.md$/i.test(entry.name) && !['PLAN.md', 'ISSUES.md', 'SAME-PAGE-LOG.md'].includes(entry.name)) result.push(file);
    }
  };
  visit(root);
  return result;
}

export function checkDocumentation(repoDir) {
  const root = path.resolve(repoDir);
  const findings = [];
  for (const file of markdownFiles(root)) {
    const text = fs.readFileSync(file, 'utf8');
    const references = [
      ...[...text.matchAll(MARKDOWN_LINK_RE)].map((match) => match[1]),
      ...[...text.matchAll(TOOL_PATH_RE)].map((match) => match[1]),
    ];
    for (const raw of new Set(references)) {
      const clean = decodeURIComponent(raw.split('#')[0]);
      if (!clean || /[<{*]/.test(clean)) continue;
      const target = raw.startsWith('/') ? path.join(root, clean.replace(/^\/+/, ''))
        : raw.startsWith('scripts/') || raw.startsWith('protocols/') || raw.startsWith('examples/') || raw.startsWith('integrations/')
          ? path.join(root, clean) : path.resolve(path.dirname(file), clean);
      if (!fs.existsSync(target)) findings.push({ file: path.relative(root, file), target: raw, code: 'missing-doc-target' });
    }
  }
  return findings;
}

function isMain() {
  try { return fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(process.argv[1] || '.'); }
  catch { return false; }
}
if (isMain()) {
  const root = process.argv[2] || process.cwd();
  const findings = checkDocumentation(root);
  for (const finding of findings) console.error(`${finding.file}: missing documentation target: ${finding.target}`);
  if (!findings.length) console.log('Documentation references are healthy.');
  process.exit(findings.length ? 1 : 0);
}
