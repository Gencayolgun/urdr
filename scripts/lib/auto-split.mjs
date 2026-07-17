import { parseMarkdown } from './markdown-model.mjs';

const STOP = new Set([
  'the', 'and', 'for', 'with', 'from', 'into', 'that', 'this', 'then', 'than',
  've', 'bir', 'ile', 'için', 'ama', 'daha', 'bkz', 'root', 'urdr',
]);

export function keywordTokens(text) {
  return [...new Set(String(text).toLocaleLowerCase()
    .replace(/\b\d{2}\.\d{2}\.\d{4}\b/g, ' ')
    .split(/[^\p{L}\p{N}-]+/u)
    .filter((token) => token.length > 2 && !STOP.has(token)))].sort();
}

function round(value) { return Number(value.toFixed(3)); }
function jaccard(left, right) {
  if (!left.size || !right.size) return 0;
  let common = 0;
  for (const token of left) if (right.has(token)) common++;
  return common / (left.size + right.size - common);
}
function title(token) { return token.charAt(0).toLocaleUpperCase() + token.slice(1); }

/** Deterministic, evidence-bearing keyword clustering. No random seed or model is used. */
export function proposeBranchSplit(input, opts = {}) {
  const leaves = input.leaves.map((leaf, index) => ({
    id: leaf.id || `line-${leaf.line || index + 1}`,
    index: leaf.index ?? index,
    text: String(leaf.text),
    tokens: new Set(keywordTokens(leaf.text)),
  })).sort((a, b) => a.index - b.index || a.id.localeCompare(b.id));
  if (leaves.length < 2) return null;

  const memberships = new Map();
  for (const leaf of leaves) for (const token of leaf.tokens) {
    const ids = memberships.get(token) || [];
    ids.push(leaf.id);
    memberships.set(token, ids);
  }
  const candidates = [...memberships]
    .filter(([, ids]) => ids.length >= 2 && ids.length < leaves.length)
    .map(([token, ids]) => ({ token, ids: new Set(ids), score: ids.length * (1 - ids.length / leaves.length) }))
    .sort((a, b) => b.score - a.score || b.ids.size - a.ids.size || a.token.localeCompare(b.token));

  const seeds = [];
  const wanted = Math.max(2, Math.min(opts.maxClusters || 4, Math.ceil(leaves.length / (opts.targetSize || 20))));
  for (const candidate of candidates) {
    if (seeds.every((seed) => jaccard(candidate.ids, seed.ids) < 0.5)) seeds.push(candidate);
    if (seeds.length === wanted) break;
  }
  if (seeds.length < 2) return null;

  const groups = seeds.map((seed) => ({ seed: seed.token, leaves: [] }));
  const pending = [];
  for (const leaf of leaves) {
    const direct = groups.map((group, index) => ({ index, hit: leaf.tokens.has(group.seed) ? 1 : 0 }))
      .sort((a, b) => b.hit - a.hit || groups[a.index].seed.localeCompare(groups[b.index].seed));
    if (direct[0].hit) groups[direct[0].index].leaves.push(leaf);
    else pending.push(leaf);
  }
  for (const leaf of pending) {
    const ranked = groups.map((group, index) => ({
      index,
      similarity: group.leaves.length
        ? group.leaves.reduce((sum, member) => sum + jaccard(leaf.tokens, member.tokens), 0) / group.leaves.length
        : 0,
      size: group.leaves.length,
    })).sort((a, b) => b.similarity - a.similarity || a.size - b.size || groups[a.index].seed.localeCompare(groups[b.index].seed));
    groups[ranked[0].index].leaves.push(leaf);
  }

  const clusters = groups.filter((group) => group.leaves.length).map((group) => {
    const frequency = new Map();
    for (const leaf of group.leaves) for (const token of leaf.tokens) frequency.set(token, (frequency.get(token) || 0) + 1);
    const evidence = [...frequency].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 3)
      .map(([keyword, count]) => ({ keyword, count }));
    let pairs = 0;
    let similarity = 0;
    for (let i = 0; i < group.leaves.length; i++) for (let j = i + 1; j < group.leaves.length; j++) {
      similarity += jaccard(group.leaves[i].tokens, group.leaves[j].tokens);
      pairs++;
    }
    const coverage = group.leaves.filter((leaf) => leaf.tokens.has(group.seed)).length / group.leaves.length;
    return {
      name: `${input.branch} / ${title(group.seed)}`,
      keyword: group.seed,
      leafIds: group.leaves.map((leaf) => leaf.id),
      evidence,
      confidence: round(0.6 * coverage + 0.4 * (pairs ? similarity / pairs : 1)),
    };
  }).sort((a, b) => a.keyword.localeCompare(b.keyword));
  if (clusters.length < 2) return null;
  return {
    type: 'branch.split', file: input.file, branch: input.branch,
    algorithm: 'deterministic-keyword-jaccard-v1',
    leafCount: leaves.length,
    confidence: round(clusters.reduce((sum, cluster) => sum + cluster.confidence * cluster.leafIds.length, 0) / leaves.length),
    clusters,
  };
}

export function applySplitProposal(content, proposal) {
  const model = parseMarkdown(content);
  const branch = model.branches.find((item) => item.name === proposal.branch);
  if (!branch) throw new Error(`split branch no longer exists: ${proposal.file} / ${proposal.branch}`);
  const byId = new Map(branch.leaves.map((leaf) => [leaf.id, leaf]));
  const expected = proposal.clusters.flatMap((cluster) => cluster.leafIds);
  if (expected.length !== branch.leaves.length || expected.some((id) => !byId.has(id))) {
    throw new Error(`split proposal leaves no longer match: ${proposal.file} / ${proposal.branch}`);
  }
  const blocks = new Map();
  for (const [id, leaf] of byId) {
    const start = Math.min(leaf.startLine, ...(leaf.metadata || []).map((item) => item.startLine));
    blocks.set(id, model.lines.slice(start - 1, leaf.endLine).join(model.newline).trim());
  }
  const replacement = proposal.clusters.map((cluster) => [
    `## ${cluster.name}`,
    ...cluster.leafIds.map((id) => blocks.get(id)),
  ].join(`${model.newline}${model.newline}`)).join(`${model.newline}${model.newline}`);
  const lines = [...model.lines];
  lines.splice(branch.startLine - 1, branch.endLine - branch.startLine + 1, ...replacement.split(model.newline));
  return lines.join(model.newline);
}
