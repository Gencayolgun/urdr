import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { atomicReplaceFile } from '../append.mjs';
import { acquireLeaseLock, assertLeaseOwned, releaseLeaseLock } from './lock.mjs';

export const EVENT_SCHEMA_VERSION = 1;
export const PROVENANCE_FIELDS = Object.freeze([
  'creator', 'timestamp', 'source', 'confidence', 'verification_state',
  'verifier', 'validity_interval',
]);
export const EVENT_LOG_RELATIVE_PATH = path.join('.urdr', 'events.jsonl');
export const EVENT_HEAD_RELATIVE_PATH = path.join('.urdr', 'event-head.json');

function canonicalValue(value) {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value && typeof value === 'object') {
    const result = {};
    for (const key of Object.keys(value).sort()) {
      if (value[key] !== undefined) result[key] = canonicalValue(value[key]);
    }
    return result;
  }
  return value;
}

export function canonicalJson(value) {
  return JSON.stringify(canonicalValue(value));
}

export function hashContent(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
}

export function hashEvent(record) {
  const unsigned = { ...record };
  delete unsigned.hash;
  return hashContent(canonicalJson(unsigned));
}

export function eventLogPaths(memoryDir) {
  const memory = path.resolve(memoryDir);
  const urdrDir = path.join(memory, '.urdr');
  return {
    memory,
    urdrDir,
    logFile: path.join(memory, EVENT_LOG_RELATIVE_PATH),
    headFile: path.join(memory, EVENT_HEAD_RELATIVE_PATH),
    lockDir: path.join(urdrDir, 'event-log.lock'),
  };
}

function readHead(headFile) {
  try { return JSON.parse(fs.readFileSync(headFile, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

function appendDurably(file, line) {
  const fd = fs.openSync(file, fs.constants.O_CREAT | fs.constants.O_APPEND | fs.constants.O_WRONLY, 0o600);
  try {
    fs.writeFileSync(fd, `${line}\n`, 'utf8');
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
}

function writeHead(paths, record, lock, opts) {
  const head = {
    schemaVersion: EVENT_SCHEMA_VERSION,
    hash: record.hash,
    sequence: record.sequence,
  };
  atomicReplaceFile(paths.headFile, `${canonicalJson(head)}\n`, lock, opts);
}

export function readEventLog(memoryDir) {
  const paths = eventLogPaths(memoryDir);
  let source = '';
  try { source = fs.readFileSync(paths.logFile, 'utf8'); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    const head = readHead(paths.headFile);
    const errors = head ? [{ code: 'log-truncated', expectedSequence: head.sequence, actualSequence: 0 }] : [];
    return { ...paths, records: [], errors, warnings: [], tailIssue: errors[0] || null, integrity: errors.length === 0, head };
  }

  const errors = [];
  const warnings = [];
  const records = [];
  const hasFinalNewline = source.endsWith('\n');
  const lines = source.split('\n');
  if (lines.at(-1) === '') lines.pop();
  let previousHash = null;

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index].replace(/\r$/, '');
    let record;
    try { record = JSON.parse(line); }
    catch (error) {
      const tail = index === lines.length - 1;
      const issue = { code: tail ? (hasFinalNewline ? 'corrupted-tail' : 'truncated-tail') : 'corrupted-record', line: index + 1, message: error.message };
      (tail ? warnings : errors).push(issue);
      break;
    }
    const expectedSequence = records.length + 1;
    if (record.sequence !== expectedSequence || record.prevHash !== previousHash || record.hash !== hashEvent(record)) {
      errors.push({ code: 'hash-chain-corruption', line: index + 1, sequence: record.sequence });
      break;
    }
    if (record.schemaVersion > EVENT_SCHEMA_VERSION) {
      warnings.push({ code: 'unsupported-schema-version', line: index + 1, version: record.schemaVersion });
    }
    records.push(record);
    previousHash = record.hash;
  }

  const head = readHead(paths.headFile);
  const last = records.at(-1) || null;
  if (head && (head.sequence !== (last?.sequence ?? 0) || head.hash !== (last?.hash ?? null))) {
    const anchoredRecord = records[head.sequence - 1];
    if (head.sequence < (last?.sequence ?? 0) && anchoredRecord?.hash === head.hash) {
      warnings.push({ code: 'unanchored-tail', anchoredSequence: head.sequence, actualSequence: last.sequence });
    } else {
      const code = head.sequence > (last?.sequence ?? 0) ? 'log-truncated' : 'head-mismatch';
      errors.push({ code, expectedSequence: head.sequence, actualSequence: last?.sequence ?? 0 });
    }
  } else if (!head && records.length > 0) {
    warnings.push({ code: 'missing-head-anchor' });
  }

  const tailIssue = [...errors, ...warnings].find((item) => /tail|hash-chain|truncated/.test(item.code)) || null;

  return { ...paths, records, errors, warnings, tailIssue, integrity: errors.length === 0, head };
}

function recoverIncompleteTail(paths, log) {
  if (log.tailIssue?.code !== 'truncated-tail' || !log.integrity) return log;
  const source = fs.readFileSync(paths.logFile, 'utf8');
  const complete = source.slice(0, source.lastIndexOf('\n') + 1);
  const fd = fs.openSync(paths.logFile, 'r+');
  try {
    fs.ftruncateSync(fd, Buffer.byteLength(complete));
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  return readEventLog(paths.memory);
}

export function appendTransaction(memoryDir, transactionId, operations, opts = {}) {
  if (!transactionId) throw new Error('transaction id is required');
  if (!Array.isArray(operations) || operations.length === 0) throw new Error('transaction requires at least one operation');
  const paths = eventLogPaths(memoryDir);
  fs.mkdirSync(paths.urdrDir, { recursive: true });
  const ownedLock = opts.lock || acquireLeaseLock(paths.lockDir, opts.lockOptions);
  const release = !opts.lock;
  try {
    assertLeaseOwned(ownedLock);
    const current = recoverIncompleteTail(paths, readEventLog(memoryDir));
    if (!current.integrity) throw new Error(`event log integrity failure: ${current.errors.map((item) => item.code).join(', ')}`);
    let sequence = current.records.at(-1)?.sequence ?? 0;
    let prevHash = current.records.at(-1)?.hash ?? null;
    const appended = [];
    const timestamp = opts.timestamp || new Date().toISOString();

    for (const operation of operations) {
      const record = {
        schemaVersion: EVENT_SCHEMA_VERSION,
        kind: 'operation',
        operation,
        prevHash,
        sequence: ++sequence,
        timestamp,
        transactionId,
      };
      record.hash = hashEvent(record);
      appendDurably(paths.logFile, canonicalJson(record));
      writeHead(paths, record, ownedLock, opts);
      appended.push(record);
      prevHash = record.hash;
    }

    if (opts.beforeCommit) opts.beforeCommit({ records: appended, transactionId });

    const commit = {
      schemaVersion: EVENT_SCHEMA_VERSION,
      kind: 'commit',
      operationHashes: appended.map((record) => record.hash),
      prevHash,
      sequence: ++sequence,
      timestamp,
      transactionId,
    };
    commit.hash = hashEvent(commit);
    appendDurably(paths.logFile, canonicalJson(commit));
    writeHead(paths, commit, ownedLock, opts);
    return { records: appended, commit };
  } finally {
    if (release) releaseLeaseLock(ownedLock);
  }
}

export function readCommittedState(memoryDir) {
  const log = readEventLog(memoryDir);
  const pending = new Map();
  const committedTransactions = new Map();
  const operations = [];

  for (const record of log.records) {
    if (record.schemaVersion !== EVENT_SCHEMA_VERSION) continue;
    if (record.kind === 'operation') {
      const list = pending.get(record.transactionId) || [];
      list.push(record);
      pending.set(record.transactionId, list);
    } else if (record.kind === 'commit') {
      const list = pending.get(record.transactionId) || [];
      if (canonicalJson(list.map((item) => item.hash)) !== canonicalJson(record.operationHashes)) continue;
      operations.push(...list);
      committedTransactions.set(record.transactionId, record);
      pending.delete(record.transactionId);
    }
  }

  const leaves = new Map();
  const leafChanges = new Map();
  const forgottenLeaves = new Set();
  const edges = new Map();
  const checkpoints = new Map();
  for (const record of operations) {
    const operation = record.operation || {};
    if (operation.type === 'leaf.upsert') {
      if (forgottenLeaves.has(operation.leaf.id)) continue;
      leaves.set(operation.leaf.id, { ...operation.leaf, sequence: record.sequence });
      leafChanges.set(operation.leaf.id, record.sequence);
    } else if (operation.type === 'leaf.provenance') {
      const leaf = leaves.get(operation.id);
      if (leaf) {
        const provenance = Object.fromEntries(PROVENANCE_FIELDS
          .filter((key) => Object.hasOwn(operation.provenance || {}, key))
          .map((key) => [key, operation.provenance[key]]));
        leaves.set(operation.id, { ...leaf, ...provenance, sequence: record.sequence });
        leafChanges.set(operation.id, record.sequence);
      }
    } else if (operation.type === 'leaf.delete' || operation.type === 'leaf.forget') {
      leaves.delete(operation.id);
      leafChanges.set(operation.id, record.sequence);
      if (operation.type === 'leaf.forget') forgottenLeaves.add(operation.id);
    }
    else if (operation.type === 'edge.upsert') edges.set(operation.edge.id, { ...operation.edge, sequence: record.sequence });
    else if (operation.type === 'edge.delete') edges.delete(operation.id);
    else if (operation.type === 'view.checkpoint') checkpoints.set(operation.file, { ...operation, sequence: record.sequence });
  }

  return { ...log, operations, committedTransactions, leaves, leafChanges, forgottenLeaves, edges, checkpoints };
}
