#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const glob = require('glob');

const apply = process.argv.includes('--apply');
const root = process.cwd();

function read(file) { return fs.readFileSync(file, 'utf8'); }
function write(file, content) { fs.writeFileSync(file, content, 'utf8'); }

const exts = ['js','ts','jsx','tsx','vue','html','php'];
const ignore = ['**/node_modules/**','**/.git/**','**/dist/**','**/build/**'];

function transformContent(content) {
  let changed = false;
  let out = content;

  // 1) fetch('/something.php', opts?) and fetch('/api/...')
  out = out.replace(/fetch\(\s*(['\"])(\/?[^'\"]*?\.(php|php\?.*?)|api\/[^"]*?)\1\s*(,\s*([\s\S]*?)\s*)?\)/g,
    (m, q, pth, _ext, commaAndOpts, opts) => {
      changed = true;
      const trimmedOpts = opts ? opts.trim() : '';
      if (trimmedOpts) {
        return `apiFetch('${pth}', ${trimmedOpts})`;
      }
      return `apiFetch('${pth}')`;
  });

  // 2) axios.<method>(path, ...)
  // axios.get/delete
  out = out.replace(/axios\.(get|delete)\(\s*(['\"])(\/?[^'\"]+)\2\s*(?:,\s*([^)]+?)\s*)?\)/g,
    (m, method, q, pth, config) => {
      changed = true;
      const cfg = config ? config.trim() : '{}';
      const up = method.toUpperCase();
      return `apiFetch('${pth}', Object.assign(${cfg}, { method: '${up}' }))`;
  });

  // axios.post/put/patch(path, data, config?)
  out = out.replace(/axios\.(post|put|patch)\(\s*(['\"])(\/?[^'\"]+)\2\s*,\s*([^,\)]+?)\s*(?:,\s*([^)]+?)\s*)?\)/g,
    (m, method, q, pth, data, config) => {
      changed = true;
      const cfg = config ? config.trim() : '{}';
      const up = method.toUpperCase();
      return `apiFetch('${pth}', Object.assign(${cfg}, { method: '${up}', body: JSON.stringify(${data.trim()}) }))`;
  });

  // 3) axios('path', config?) -> apiFetch('path', config)
  out = out.replace(/axios\(\s*(['\"])(\/?[^'\"]+)\1\s*(?:,\s*([^)]+?)\s*)?\)/g,
    (m, q, pth, config) => {
      changed = true;
      const cfg = config ? config.trim() : '{}';
      return `apiFetch('${pth}', ${cfg})`;
  });

  return { changed, out };
}

function run() {
  const globPattern = `**/*.{${exts.join(',')}}`;
  const files = glob.sync(globPattern, { ignore, nodir: true });
  if (!files.length) {
    console.log('No files found to scan.');
    return;
  }

  const results = [];
  files.forEach(f => {
    const full = path.join(root, f);
    const content = read(full);
    const { changed, out: transformed } = transformContent(content);
    let out = transformed;
    if (changed) {
      // If apiFetch is used but import missing, insert import to project-root `lib/api`
      if (/\bapiFetch\s*\(/.test(out) || /\bapiFetch\b/.test(out)) {
        const importRegex = /import\s+\{?\s*apiFetch\s*\}?\s+from\s+['"][^'"']+['"];?/;
        if (!importRegex.test(out)) {
          // compute relative path from file dir to repo-root/lib/api
          const rel = path.relative(path.dirname(full), path.join(root, 'lib', 'api')) || './lib/api';
          let relPath = rel.replace(/\\\\/g, '/');
          if (!relPath.startsWith('.')) relPath = './' + relPath;
          const importLine = `import { apiFetch } from '${relPath}';\n`;
          // insert after any existing import block or at top
          const lines = out.split(/\r?\n/);
          let insertAt = 0;
          while (insertAt < lines.length && lines[insertAt].startsWith('import')) insertAt++;
          lines.splice(insertAt, 0, importLine);
          out = lines.join('\n');
        }
      }
      results.push({ file: f, before: content, after: out });
    }
  });

  if (!results.length) {
    console.log('No fetch()/axios patterns matched.');
    return;
  }

  console.log(`Found ${results.length} file(s) with matches:`);
  results.forEach(r => {
    console.log('- ' + r.file);
  });

  if (!apply) {
    console.log('\nDry-run mode (no files modified). To apply changes re-run with --apply');
    return;
  }

  // Apply changes
  results.forEach(r => {
    const full = path.join(root, r.file);
    write(full, r.after);
    console.log('Patched', r.file);
  });
  console.log('\nDone. Run your build/test to verify changes.');
}

run();
