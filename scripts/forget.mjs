#!/usr/bin/env node
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { forgetMemoryLeaf, resumeForgottenArtifactScrubs } from './lib/forgetting.mjs';

function isMain() {
  try { return fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(process.argv[1] || '.'); }
  catch { return false; }
}

if (isMain()) {
  const args = process.argv.slice(2);
  const memoryDir = args.find((arg) => !arg.startsWith('--'));
  const idIndex = args.indexOf('--id');
  const reasonIndex = args.indexOf('--reason');
  const generationsIndex = args.indexOf('--max-generations');
  const recoveryIndex = args.indexOf('--recovery-max-age-days');
  const resume = args.includes('--resume-scrub');
  if (!memoryDir || (!resume && (idIndex < 0 || !args[idIndex + 1]))) {
    console.error('Usage: node scripts/forget.mjs <memory-dir> (--id <stable-id> [--reason text] | --resume-scrub) [--max-generations n] [--recovery-max-age-days n]');
    process.exitCode = 2;
  } else try {
    const retention = {};
    if (generationsIndex >= 0) retention.maxGenerations = Number(args[generationsIndex + 1]);
    if (recoveryIndex >= 0) retention.recoveryMaxAgeDays = Number(args[recoveryIndex + 1]);
    const options = {
      reason: reasonIndex >= 0 ? args[reasonIndex + 1] : null,
      retention,
    };
    console.log(JSON.stringify(resume
      ? resumeForgottenArtifactScrubs(memoryDir, options)
      : forgetMemoryLeaf(memoryDir, args[idIndex + 1], options), null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
