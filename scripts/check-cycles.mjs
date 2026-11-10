// يكشف الاعتماد الدائري بين ملفات src/app (استيراد ثابت فقط؛ import() الكسول لا يُحسب). تشغيل: npm run check:cycles
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('src/app');
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith('.ts') && !e.name.endsWith('.spec.ts') ? [path.join(d, e.name)] : []);
const files = walk(root);
const set = new Set(files);

function resolve(spec, from) {
  let base;
  if (spec.startsWith('.')) base = path.resolve(path.dirname(from), spec);
  else if (spec.startsWith('@core/')) base = path.join(root, 'core', spec.slice(6));
  else if (spec.startsWith('@shared/')) base = path.join(root, 'shared', spec.slice(8));
  else if (spec.startsWith('@features/')) base = path.join(root, 'features', spec.slice(10));
  else return null;
  return [base + '.ts', path.join(base, 'index.ts')].find(c => set.has(c)) ?? null;
}

const graph = new Map();
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  const deps = new Set();
  for (const m of src.matchAll(/(?:import|export)\s+(?!type\b)(?:[^'";]*?from\s*)?'([^']+)'/g)) {
    const t = resolve(m[1], f);
    if (t && t !== f) deps.add(t);
  }
  graph.set(f, [...deps]);
}

const state = new Map(), stack = [], cycles = [];
function dfs(n) {
  state.set(n, 1); stack.push(n);
  for (const d of graph.get(n) ?? []) {
    if (state.get(d) === 1) cycles.push([...stack.slice(stack.indexOf(d)), d]);
    else if (!state.has(d)) dfs(d);
  }
  stack.pop(); state.set(n, 2);
}
for (const f of files) if (!state.has(f)) dfs(f);

// دورات على مستوى الميزات (ميزة تستورد أخرى وتستوردها الأخرى): تمرّ من فحص الملفات لكنها تربط الميزتين بعروة واحدة
const featureOf = f => { const parts = path.relative(root, f).split(path.sep); return parts[0] === 'features' ? parts[1] : null; };
const featureGraph = new Map();
for (const [f, deps] of graph) {
  const from = featureOf(f);
  if (!from) continue;
  for (const d of deps) { const to = featureOf(d); if (to && to !== from) (featureGraph.get(from) ?? featureGraph.set(from, new Set()).get(from)).add(to); }
}
const featureCycles = new Set();
const walkFeature = (n, trail) => { for (const m of featureGraph.get(n) ?? []) { const at = trail.indexOf(m); if (at >= 0) featureCycles.add([...trail.slice(at), m].join(' → ')); else if (trail.length < 8) walkFeature(m, [...trail, m]); } };
for (const n of featureGraph.keys()) walkFeature(n, [n]);
// كل دورة تظهر بعدد مداخل بعدد عقدها: تُوحَّد بالمجموعة
const unique = new Map(); for (const c of featureCycles) unique.set([...new Set(c.split(' → '))].sort().join(','), c);

if (cycles.length) {
  console.error(`وُجدت ${cycles.length} دورة اعتماد:`);
  for (const c of cycles) console.error('  ' + c.map(f => path.relative(root, f)).join(' → '));
  process.exit(1);
}
if (unique.size) {
  console.error(`وُجدت ${unique.size} دورة بين الميزات (أنشئ اعتماداً باتجاه واحد: انقل المشترك إلى core/shared أو إلى الميزة التي تملكه):`);
  for (const c of unique.values()) console.error('  ' + c);
  process.exit(1);
}
console.log(`لا دورات اعتماد (${files.length} ملفاً، ${featureGraph.size} ميزة تستورد غيرها).`);
