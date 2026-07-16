import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

function sleepSync(ms) {
  try { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); }
  catch { const until = Date.now() + ms; while (Date.now() < until) {} }
}

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return null; }
}

function writeJsonAtomic(file, value) {
  const tmp = `${file}.${process.pid}.${crypto.randomUUID()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value));
  fs.renameSync(tmp, file);
}

function processExists(pid) {
  try { process.kill(pid, 0); return true; }
  catch (error) { return error.code === 'EPERM'; }
}

function leaseIsFresh(lease, staleMs) {
  return lease && Number.isFinite(lease.updatedAt) && Date.now() - lease.updatedAt <= staleMs;
}

function tryRemoveStale(lockDir, token, staleMs) {
  const leaseFile = path.join(lockDir, 'lease.json');
  const observed = readJson(leaseFile);
  if (leaseIsFresh(observed, staleMs)) return false;
  if (!observed) {
    try { if (Date.now() - fs.statSync(lockDir).mtimeMs <= staleMs) return false; }
    catch { return false; }
  }

  const quarantine = `${lockDir}.stale-${token}`;
  try { fs.renameSync(lockDir, quarantine); }
  catch (error) {
    if (error.code === 'ENOENT' || error.code === 'EEXIST' || error.code === 'EPERM') return false;
    throw error;
  }

  const finalLease = readJson(path.join(quarantine, 'lease.json'));
  if (leaseIsFresh(finalLease, staleMs)) {
    try { fs.renameSync(quarantine, lockDir); }
    catch {}
    return false;
  }
  fs.rmSync(quarantine, { recursive: true, force: true });
  return true;
}

function keeperAcquire(lockDir, token, parentPid, staleMs) {
  const guardDir = `${lockDir}.guard`;
  let guarded = false;
  for (let attempt = 0; attempt < 2 && !guarded; attempt++) {
    try {
      fs.mkdirSync(guardDir);
      guarded = true;
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      try {
        if (Date.now() - fs.statSync(guardDir).mtimeMs > staleMs) fs.rmSync(guardDir, { recursive: true, force: true });
        else return null;
      } catch { return null; }
    }
  }
  if (!guarded) return null;

  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        fs.mkdirSync(lockDir);
        const lease = { token, keeperPid: process.pid, parentPid, updatedAt: Date.now() };
        writeJsonAtomic(path.join(lockDir, 'lease.json'), lease);
        return lease;
      } catch (error) {
        if (error.code !== 'EEXIST') throw error;
        if (!tryRemoveStale(lockDir, token, staleMs)) return null;
      }
    }
    return null;
  } finally {
    fs.rmSync(guardDir, { recursive: true, force: true });
  }
}

function keeperRelease(lockDir, token) {
  const lease = readJson(path.join(lockDir, 'lease.json'));
  if (lease?.token !== token) return false;
  fs.rmSync(lockDir, { recursive: true, force: true });
  return true;
}

function runKeeper({ lockDir, token, statusFile, releaseFile, parentPid, staleMs, updateMs }) {
  let lease;
  try { lease = keeperAcquire(lockDir, token, parentPid, staleMs); }
  catch (error) {
    writeJsonAtomic(statusFile, { state: 'error', message: error.message });
    process.exit(1);
  }
  if (!lease) {
    writeJsonAtomic(statusFile, { state: 'busy' });
    process.exit(3);
  }

  writeJsonAtomic(statusFile, { state: 'acquired', pid: process.pid });
  const interval = setInterval(() => {
    const current = readJson(path.join(lockDir, 'lease.json'));
    if (current?.token !== token) {
      clearInterval(interval);
      process.exit(4);
    }
    if (!processExists(parentPid)) {
      keeperRelease(lockDir, token);
      clearInterval(interval);
      process.exit(0);
    }
    const release = readJson(releaseFile);
    if (release?.token === token) {
      keeperRelease(lockDir, token);
      clearInterval(interval);
      process.exit(0);
    }
    try {
      lease.updatedAt = Date.now();
      writeJsonAtomic(path.join(lockDir, 'lease.json'), lease);
    } catch {
      clearInterval(interval);
      process.exit(5);
    }
  }, updateMs);
}

export function acquireLeaseLock(lockDir, opts = {}) {
  const timeoutMs = opts.timeoutMs ?? 30000;
  const staleMs = opts.staleMs ?? 30000;
  const updateMs = opts.updateMs ?? Math.max(25, Math.min(1000, Math.floor(staleMs / 3)));
  if (updateMs >= staleMs) throw new Error('lock updateMs must be less than staleMs');

  const absoluteLockDir = path.resolve(lockDir);
  const start = Date.now();
  for (;;) {
    const token = crypto.randomUUID();
    const statusFile = `${absoluteLockDir}.status-${token}.json`;
    const releaseFile = `${absoluteLockDir}.release-${token}.json`;
    const child = spawn(process.execPath, [fileURLToPath(import.meta.url), '--lease-keeper',
      absoluteLockDir, token, statusFile, releaseFile, String(process.pid), String(staleMs), String(updateMs)], {
      stdio: 'ignore',
      windowsHide: true,
    });
    child.on('error', () => {});

    let status = null;
    const attemptDeadline = Math.min(start + timeoutMs, Date.now() + 2000);
    while (Date.now() <= attemptDeadline) {
      status = readJson(statusFile);
      if (status) break;
      sleepSync(5);
    }
    try { fs.rmSync(statusFile, { force: true }); } catch {}

    if (status?.state === 'acquired') {
      return { lockDir: absoluteLockDir, token, releaseFile, pid: status.pid, staleMs, updateMs };
    }
    if (status?.state === 'error') throw new Error(`lock keeper failed: ${status.message}`);
    try { child.kill(); } catch {}
    try { fs.rmSync(releaseFile, { force: true }); } catch {}
    if (Date.now() - start >= timeoutMs) throw new Error(`lock timeout: ${absoluteLockDir}`);
    sleepSync(5 + Math.floor(Math.random() * 15));
  }
}

export function assertLeaseOwned(handle) {
  const lease = readJson(path.join(handle.lockDir, 'lease.json'));
  if (lease?.token !== handle.token) throw new Error('lock ownership lost');
  if (!processExists(handle.pid)) throw new Error('lock lease keeper stopped');
  if (!leaseIsFresh(lease, handle.staleMs)) throw new Error('lock lease renewal failed');
  return true;
}

export function releaseLeaseLock(handle, opts = {}) {
  if (!handle) return;
  writeJsonAtomic(handle.releaseFile, { token: handle.token });
  const deadline = Date.now() + (opts.timeoutMs ?? 2000);
  while (Date.now() <= deadline) {
    const lease = readJson(path.join(handle.lockDir, 'lease.json'));
    if (!lease || lease.token !== handle.token) break;
    sleepSync(5);
  }
  try { fs.rmSync(handle.releaseFile, { force: true }); } catch {}
}

function isMain() {
  try { return fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(process.argv[1] || '.'); }
  catch { return false; }
}

if (isMain() && process.argv[2] === '--lease-keeper') {
  const [, , , lockDir, token, statusFile, releaseFile, parentPid, staleMs, updateMs] = process.argv;
  runKeeper({
    lockDir,
    token,
    statusFile,
    releaseFile,
    parentPid: Number(parentPid),
    staleMs: Number(staleMs),
    updateMs: Number(updateMs),
  });
}
