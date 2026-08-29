'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const projectRoot = path.resolve(__dirname, '..');
const sourceRoots = ['src', 'demo', 'public', 'scripts', 'test'];
const failures = [];

for (const relativeRoot of sourceRoots) {
  const root = path.join(projectRoot, relativeRoot);
  if (!fs.existsSync(root)) continue;

  for (const file of findJavaScriptFiles(root)) lintFile(file);
}

if (failures.length > 0) {
  for (const failure of failures) console.error(failure);
  process.exitCode = 1;
} else {
  console.log('Lint passed: syntax, whitespace, and import boundaries are clean.');
}

function findJavaScriptFiles(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const resolved = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...findJavaScriptFiles(resolved));
    if (entry.isFile() && entry.name.endsWith('.js')) files.push(resolved);
  }
  return files.sort();
}

function lintFile(file) {
  const source = fs.readFileSync(file, 'utf8');
  const relative = path.relative(projectRoot, file);

  try {
    new vm.Script(source, { filename: relative });
  } catch (error) {
    failures.push(`${relative}: ${error.message}`);
  }

  source.split(/\r?\n/).forEach((line, index) => {
    if (/\s+$/.test(line)) failures.push(`${relative}:${index + 1}: trailing whitespace`);
    if (line.includes('\t')) failures.push(`${relative}:${index + 1}: tab character`);
  });

  for (const match of source.matchAll(/require\(\s*(['"])([^'"]+)\1\s*\)/g)) {
    const specifier = match[2];
    if (!specifier.startsWith('node:') && !specifier.startsWith('.')) {
      failures.push(`${relative}: bare import is not allowed: ${specifier}`);
    }
  }
}
