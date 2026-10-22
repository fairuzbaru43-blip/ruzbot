'use strict';

const fs = require('node:fs');
const path = require('node:path');

function loadEnvFile(filePath = path.resolve(process.cwd(), '.env'), target = process.env) {
  if (!fs.existsSync(filePath)) return target;
  const contents = fs.readFileSync(filePath, 'utf8');
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    const [, key, raw] = match;
    if (Object.prototype.hasOwnProperty.call(target, key)) continue;
    let value = raw.trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    } else {
      value = value.replace(/\s+#.*$/, '').trim();
    }
    target[key] = value;
  }
  return target;
}

module.exports = { loadEnvFile };
