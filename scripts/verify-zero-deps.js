'use strict';

const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
const failures = [];

for (const field of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']) {
  if (Object.keys(manifest[field] || {}).length > 0) failures.push(`${field} must be empty`);
}

for (const forbidden of ['node_modules', 'package-lock.json', 'npm-shrinkwrap.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lock', 'bun.lockb']) {
  if (fs.existsSync(path.join(projectRoot, forbidden))) failures.push(`${forbidden} must not exist`);
}

for (const rootName of ['src', 'demo', 'public', 'scripts', 'test']) {
  const root = path.join(projectRoot, rootName);
  if (!fs.existsSync(root)) continue;
  for (const file of findJavaScriptFiles(root)) inspectImports(file);
}

inspectBrowserAssets(path.join(projectRoot, 'public'));

if (failures.length > 0) {
  for (const failure of failures) console.error(`Zero-dependency violation: ${failure}`);
  process.exitCode = 1;
} else {
  console.log('Zero-dependency verification passed.');
  console.log('Manifest empty; no install artifacts; all imports are built-in or relative.');
}

function findJavaScriptFiles(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const resolved = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...findJavaScriptFiles(resolved));
    if (entry.isFile() && entry.name.endsWith('.js')) files.push(resolved);
  }
  return files;
}

function inspectImports(file) {
  const source = fs.readFileSync(file, 'utf8');
  const relative = path.relative(projectRoot, file);
  const imports = [
    ...source.matchAll(/require\(\s*(['"])([^'"]+)\1\s*\)/g),
    ...source.matchAll(/\bfrom\s+(['"])([^'"]+)\1/g),
  ];

  for (const match of imports) {
    const specifier = match[2];
    if (!specifier.startsWith('node:') && !specifier.startsWith('.')) {
      failures.push(`${relative} imports bare specifier ${specifier}`);
    }
  }
}

function inspectBrowserAssets(directory) {
  if (!fs.existsSync(directory)) return;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const resolved = path.join(directory, entry.name);
    if (entry.isDirectory()) inspectBrowserAssets(resolved);
    if (!entry.isFile() || !/\.(?:css|html|js)$/.test(entry.name)) continue;

    const source = fs.readFileSync(resolved, 'utf8');
    if (/(?:src|href)=["']https?:\/\//i.test(source) || /@import\s+(?:url\()?['"]?https?:\/\//i.test(source)) {
      failures.push(`${path.relative(projectRoot, resolved)} loads a remote browser dependency`);
    }
  }
}
