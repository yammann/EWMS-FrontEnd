// يحوّل الاستيرادات النسبية العابرة للطبقات/الميزات إلى مسارات مستعارة (@core / @shared / @features)
// يُبقي استيرادات الميزة نفسها نسبية. تشغيل: node scripts/codemod-aliases.mjs
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('src/app');
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith('.ts') ? [path.join(d, e.name)] : []);
const featureOf = f => { const r = path.relative(root, f).split(path.sep); return r[0] === 'features' ? r[1] : null; };
let changed = 0;

for (const file of walk(root)) {
  let src = fs.readFileSync(file, 'utf8');
  const out = src.replace(/(from\s+|import\(\s*)'(\.{1,2}\/[^']*)'/g, (m, pre, spec) => {
    const abs = path.resolve(path.dirname(file), spec);
    const rel = path.relative(root, abs).split(path.sep);
    let alias = null;
    if (rel[0] === 'core') alias = '@core/' + rel.slice(1).join('/');
    else if (rel[0] === 'shared') alias = '@shared/' + rel.slice(1).join('/');
    else if (rel[0] === 'features' && featureOf(file) !== rel[1]) alias = '@features/' + rel.slice(1).join('/');
    if (!alias) return m;
    // استيراد داخل الطبقة نفسها بمسار قصير يبقى نسبياً (./x) — هنا فقط العابر
    if (spec.startsWith('./') && (rel[0] === 'core' || rel[0] === 'shared') && path.relative(root, file).split(path.sep)[0] === rel[0]) return m;
    return `${pre}'${alias}'`;
  });
  if (out !== src) { fs.writeFileSync(file, out); changed++; }
}
console.log('files changed:', changed);
