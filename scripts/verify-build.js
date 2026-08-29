'use strict';

const crypto = require('node:crypto');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const buildScript = path.join(__dirname, 'build.js');
const manifest = path.join(projectRoot, 'dist', 'expressless', 'manifest.json');

const first = buildAndHash();
const second = buildAndHash();

if (first !== second) {
  console.error(`Build is not reproducible:\nfirst:  ${first}\nsecond: ${second}`);
  process.exitCode = 1;
} else {
  console.log(`Reproducible build verified: ${first}`);
}

function buildAndHash() {
  childProcess.execFileSync(process.execPath, [buildScript], {
    cwd: projectRoot,
    stdio: 'ignore',
  });
  return crypto.createHash('sha256').update(fs.readFileSync(manifest)).digest('hex');
}
