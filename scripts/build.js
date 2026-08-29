'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const outputRoot = path.join(projectRoot, 'dist', 'expressless');
const sourceEntries = [
  'src',
  'demo',
  'public',
  'scripts',
  'docs',
  '.gitignore',
  'AGENTS.md',
  'LICENSE',
  'README.md',
  'STDLIB.md',
  'package.json',
];

if (path.relative(projectRoot, outputRoot).startsWith('..')) {
  throw new Error('Build output must stay inside the project');
}

fs.rmSync(outputRoot, { recursive: true, force: true });
fs.mkdirSync(outputRoot, { recursive: true });

for (const entry of sourceEntries) {
  const source = path.join(projectRoot, entry);
  if (!fs.existsSync(source)) continue;
  copyEntry(source, path.join(outputRoot, entry));
}

const files = listFiles(outputRoot).map((file) => ({
  path: path.relative(outputRoot, file).replaceAll(path.sep, '/'),
  sha256: hash(fs.readFileSync(file)),
}));
const manifest = `${JSON.stringify({ version: 1, files }, null, 2)}\n`;
fs.writeFileSync(path.join(outputRoot, 'manifest.json'), manifest);

console.log(`Built ${files.length} files in dist/expressless`);
console.log(`Manifest SHA-256: ${hash(Buffer.from(manifest))}`);

function copyEntry(source, destination) {
  if (path.basename(source) === 'BUILD_PROOF.md') return;
  const stats = fs.statSync(source);
  if (stats.isDirectory()) {
    fs.mkdirSync(destination, { recursive: true });
    for (const child of fs.readdirSync(source).sort()) {
      copyEntry(path.join(source, child), path.join(destination, child));
    }
    return;
  }

  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
}

function listFiles(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const resolved = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...listFiles(resolved));
    if (entry.isFile()) files.push(resolved);
  }
  return files.sort((left, right) => left.localeCompare(right));
}

function hash(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}
