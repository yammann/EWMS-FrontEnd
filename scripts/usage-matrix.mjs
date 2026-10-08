import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve('src/app');
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith('.ts') && !e.name.endsWith('.spec.ts') ? [path.join(d, e.name)] : []);
const feat = f => { const r = path.relative(root, f).split(path.sep); return r[0] === 'features' ? r[1] : r[0]; };
const use = {};
for (const f of walk(root)) {
  const s = fs.readFileSync(f, 'utf8');
  for (const m of s.matchAll(/'@core\/(services|models|utils|constants)\/([^']+)'/g)) {
    const k = `${m[1]}/${m[2]}`; (use[k] ??= new Set()).add(feat(f));
  }
}
for (const [k, v] of Object.entries(use).sort()) console.log(k.padEnd(40), [...v].join(', '));
